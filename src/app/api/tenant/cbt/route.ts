import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { recordAuditLog } from '@/lib/audit';
import { computeTotal } from '@/lib/grading';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const examId = searchParams.get('examId');

  if (!slug) {
    return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
  }

  const access = await requireTenantAccess(slug, ['school_admin', 'teacher', 'student', 'parent']);
  if (!access.authorized || !access.tenant) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
  }

  const hasFeature = await access.tenant.hasFeature('feature_cbt_exams');
  if (!hasFeature) {
    return NextResponse.json(
      { error: 'CBT Online Exams module is not enabled for your subscription plan' },
      { status: 403 }
    );
  }

  const userRole = access.user?.role;

  // Resolve current student details if student
  let currentStudent: { id: string; name: string; admissionNumber: string | null } | null = null;
  if (userRole === 'student' && access.user?.studentId) {
    const s = await prisma.student.findUnique({
      where: { id: access.user.studentId },
      select: { id: true, name: true, admissionNumber: true },
    });
    if (s) currentStudent = s;
  }

  if (examId) {
    const isStudentOrParent = userRole === 'student' || userRole === 'parent';
    if (userRole !== 'student') {
      return NextResponse.json({ error: 'Only the enrolled student can open this exam.' }, { status: 403 });
    }
    const exam = await prisma.cbtExam.findFirst({
      where: {
        id: examId,
        tenantId: access.tenant.id,
        isPublished: true,
      },
      include: {
        subject: true,
        classLevel: true,
        term: { include: { session: true } },
        questions: isStudentOrParent
          ? {
              select: {
                id: true,
                questionText: true,
                optionA: true,
                optionB: true,
                optionC: true,
                optionD: true,
                points: true,
                orderIndex: true,
              },
              orderBy: { orderIndex: 'asc' },
            }
          : { orderBy: { orderIndex: 'asc' } },
        attempts: {
          where: userRole === 'student' && access.user?.studentId ? { studentId: access.user.studentId } : undefined,
          include: userRole === 'student' ? {} : { student: true },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (!access.user?.studentId) {
      return NextResponse.json({ error: 'Student portal account is not linked to a student record.' }, { status: 403 });
    }
    const [enrollment, studentRecord] = await Promise.all([
      prisma.enrollment.findFirst({
        where: {
          studentId: access.user.studentId,
          classLevelId: exam.classLevelId,
          sessionId: exam.term.sessionId,
          status: 'active',
        },
        select: { id: true },
      }),
      prisma.student.findUnique({
        where: { id: access.user.studentId },
        select: { id: true, guardianContactInfo: true },
      }),
    ]);
    if (!enrollment) {
      return NextResponse.json({ error: 'This exam is not assigned to your currently enrolled class.' }, { status: 403 });
    }

    // Verify subject is in student's departmental track or core offerings
    const { getTenantCurriculum, resolveStudentSubjectIds } = await import('@/lib/curriculum');
    const tenantCurriculum = await getTenantCurriculum(access.tenant.id);
    const allowedSubjectIds = resolveStudentSubjectIds({
      classLevelId: exam.classLevelId,
      classLevel: exam.classLevel,
      curriculum: tenantCurriculum,
      studentContactInfo: studentRecord?.guardianContactInfo,
    });
    if (!allowedSubjectIds.includes(exam.subjectId)) {
      return NextResponse.json(
        { error: 'This exam is for a subject outside your assigned department track.' },
        { status: 403 }
      );
    }

    const questionsCount = exam.questions.length;
    const wantStart = searchParams.get('start') === 'true';
    let attempt = exam.attempts?.[0] || null;

    if (attempt?.submittedAt) {
      return NextResponse.json({
        exam: { ...exam, questions: [] },
        questionsCount,
        examStarted: true,
        isSubmitted: true,
        resultScore: attempt.score,
        remainingSeconds: 0,
        currentStudent,
        userRole,
        hasFeature: true,
      });
    }

    if (!attempt && wantStart) {
      attempt = await prisma.cbtStudentAttempt.upsert({
        where: {
          examId_studentId: {
            examId: exam.id,
            studentId: access.user.studentId,
          },
        },
        update: {},
        create: {
          examId: exam.id,
          studentId: access.user.studentId,
          score: 0,
          maxScore: exam.totalMarks,
          startedAt: new Date(),
        },
      });
    }

    if (!attempt) {
      // Do not expose exam questions before the student officially starts the timed attempt
      return NextResponse.json({
        exam: { ...exam, questions: [] },
        questionsCount,
        examStarted: false,
        isSubmitted: false,
        remainingSeconds: exam.durationMins * 60,
        currentStudent,
        userRole,
        hasFeature: true,
      });
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    const remainingSeconds = Math.max(0, exam.durationMins * 60 - elapsedSeconds);

    return NextResponse.json({
      exam,
      questionsCount,
      examStarted: true,
      isSubmitted: false,
      remainingSeconds,
      currentStudent,
      userRole,
      hasFeature: true,
    });
  }

  // 1. Resolve student enrolled class level if student
  let studentClassLevelId: string | null = null;
  if (userRole === 'student' && access.user?.studentId) {
    const activeEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: access.user.studentId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });
    studentClassLevelId = activeEnrollment?.classLevelId || null;
  }

  // 2. Resolve teacher assigned classes & subjects if teacher
  let teacherAssignments: { classLevelId: string; subjectId: string }[] = [];
  if (userRole === 'teacher' && access.user?.staffId) {
    teacherAssignments = await prisma.teachingAssignment.findMany({
      where: {
        staffId: access.user.staffId,
      },
      select: { classLevelId: true, subjectId: true },
    });
  }

  // 3. Query exams strictly scoped to role
  let whereExams: any = { tenantId: access.tenant.id };

  if (userRole === 'student') {
    whereExams = {
      tenantId: access.tenant.id,
      isPublished: true,
      classLevelId: studentClassLevelId || '__NONE__',
    };
  } else if (userRole === 'teacher') {
    whereExams = {
      tenantId: access.tenant.id,
      OR: teacherAssignments.length > 0 ? teacherAssignments.map((a) => ({
        classLevelId: a.classLevelId,
        subjectId: a.subjectId,
      })) : [{ id: '__NONE__' }],
    };
  }

  const exams = await prisma.cbtExam.findMany({
    where: whereExams,
    include: {
      subject: true,
      classLevel: true,
      term: { include: { session: true } },
      questions: userRole === 'student' ? { select: { id: true, points: true } } : true,
      attempts: {
        where: userRole === 'student' && access.user?.studentId ? { studentId: access.user.studentId } : undefined,
        include: userRole === 'student' ? {} : { student: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 4. Return scoped subjects and classLevels for teachers
  let subjects: any[] = [];
  let classLevels: any[] = [];

  if (userRole === 'teacher') {
    const assignedSubjectIds = Array.from(new Set(teacherAssignments.map((a) => a.subjectId)));
    const assignedClassLevelIds = Array.from(new Set(teacherAssignments.map((a) => a.classLevelId)));

    subjects = await prisma.subject.findMany({
      where: { tenantId: access.tenant.id, id: { in: assignedSubjectIds } },
    });
    classLevels = await prisma.classLevel.findMany({
      where: { id: { in: assignedClassLevelIds } },
      orderBy: { orderIndex: 'asc' },
    });
  } else {
    subjects = await prisma.subject.findMany({ where: { tenantId: access.tenant.id } });
    classLevels = await prisma.classLevel.findMany({ orderBy: { orderIndex: 'asc' } });
  }

  const terms = await prisma.term.findMany({
    where: { session: { tenantId: access.tenant.id } },
    include: { session: true },
  });

  return NextResponse.json({ exams, subjects, classLevels, terms, userRole, currentStudent, hasFeature: true });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, slug, examData, questionData, examId, questionId, isPublished } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin', 'teacher']);
    if (!access.authorized || !access.tenant || !access.user) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const hasFeature = await access.tenant.hasFeature('feature_cbt_exams');
    if (!hasFeature) {
      return NextResponse.json({ error: 'CBT Online Exams module disabled' }, { status: 403 });
    }

    if (action === 'create_exam') {
      const { title, subjectId, classLevelId, termId, durationMins, totalMarks } = examData;

      if (!title?.trim() || !subjectId || !classLevelId || !termId || Number(totalMarks) !== 60) {
        return NextResponse.json({ error: 'Enter a title, subject, class and term. CBT terminal exams must be set to 60 marks.' }, { status: 400 });
      }
      const [subject, classLevel, term] = await Promise.all([
        prisma.subject.findFirst({ where: { id: subjectId, tenantId: access.tenant.id }, select: { id: true } }),
        prisma.classLevel.findUnique({ where: { id: classLevelId }, select: { id: true } }),
        prisma.term.findFirst({ where: { id: termId, session: { tenantId: access.tenant.id } }, select: { id: true, sessionId: true } }),
      ]);
      if (!subject || !classLevel || !term) {
        return NextResponse.json({ error: 'The selected subject, class or term is invalid for this school.' }, { status: 400 });
      }

      // Verify that teachers can only create exams/tests for their assigned classes and subjects
      if (access.user.role === 'teacher') {
        const isAssigned = await prisma.teachingAssignment.findFirst({
          where: {
            staffId: access.user.staffId || '__NONE__',
            classLevelId,
            subjectId,
            sessionId: term.sessionId,
          },
        });
        if (!isAssigned) {
          return NextResponse.json(
            { error: 'Forbidden: You are only allowed to create tests and exams for classes and subjects assigned to you.' },
            { status: 403 }
          );
        }
      }

      const exam = await prisma.cbtExam.create({
        data: {
          tenantId: access.tenant.id,
          title,
          subjectId,
          classLevelId,
          termId,
          durationMins: parseInt(durationMins) || 45,
          totalMarks: 60,
        },
      });

      await recordAuditLog({
        tenantId: access.tenant.id,
        actorId: access.user.id,
        actorName: access.user.staffProfile?.name || access.user.username,
        actorRole: access.user.role,
        action: 'create_cbt_exam',
        entityType: 'cbt_exam',
        entityId: exam.id,
        details: { title, subjectId, classLevelId, termId },
      });

      return NextResponse.json({ exam });
    }

    if (action === 'add_question') {
      const { examId: targetExamId, questionText, optionA, optionB, optionC, optionD, correctOption, points } = questionData;
      const questionPoints = Number(points);
      if (!questionText?.trim() || !optionA?.trim() || !optionB?.trim() || !optionC?.trim() || !optionD?.trim() ||
          !['A', 'B', 'C', 'D'].includes(String(correctOption).toUpperCase()) ||
          !Number.isInteger(questionPoints) || questionPoints < 1 || questionPoints > 60) {
        return NextResponse.json({ error: 'Enter the question, four answer options, a valid correct option, and points between 1 and 60.' }, { status: 400 });
      }
      
      // Verify exam belongs to tenant and teacher permission
      const targetExam = await prisma.cbtExam.findFirst({
        where: { id: targetExamId, tenantId: access.tenant.id },
      });
      if (!targetExam) {
        return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
      }

      if (access.user.role === 'teacher') {
        const isAssigned = await prisma.teachingAssignment.findFirst({
          where: {
            staffId: access.user.staffId || '__NONE__',
            classLevelId: targetExam.classLevelId,
            subjectId: targetExam.subjectId,
          },
        });
        if (!isAssigned) {
          return NextResponse.json({ error: 'Forbidden: You cannot modify this exam' }, { status: 403 });
        }
      }

      const count = await prisma.cbtQuestion.count({ where: { examId: targetExamId } });

      const question = await prisma.cbtQuestion.create({
        data: {
          examId: targetExamId,
          questionText,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          points: questionPoints,
          orderIndex: count + 1,
        },
      });
      return NextResponse.json({ question });
    }

    if (action === 'toggle_publish') {
      const targetExam = await prisma.cbtExam.findFirst({
        where: { id: examId, tenantId: access.tenant.id },
      });
      if (!targetExam) {
        return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
      }

      if (access.user.role === 'teacher') {
        const isAssigned = await prisma.teachingAssignment.findFirst({
          where: {
            staffId: access.user.staffId || '__NONE__',
            classLevelId: targetExam.classLevelId,
            subjectId: targetExam.subjectId,
          },
        });
        if (!isAssigned) {
          return NextResponse.json({ error: 'Forbidden: You cannot publish this exam' }, { status: 403 });
        }
      }

      const exam = await prisma.cbtExam.update({
        where: { id: examId },
        data: { isPublished },
      });
      return NextResponse.json({ exam });
    }

    if (action === 'import_scores') {
      const targetExam = await prisma.cbtExam.findFirst({
        where: { id: examId, tenantId: access.tenant.id },
        include: {
          attempts: { where: { submittedAt: { not: null } } },
          term: { select: { sessionId: true } },
        },
      });
      if (!targetExam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          classLevelId: targetExam.classLevelId,
          subjectId: targetExam.subjectId,
          sessionId: targetExam.term.sessionId,
          ...(access.user.role === 'teacher' ? { staffId: access.user.staffId || '__NONE__' } : {}),
        },
        select: { staffId: true },
      });
      if (!assignment) {
        return NextResponse.json({ error: 'Assign a teacher to this class, subject and session before importing CBT scores.' }, { status: 422 });
      }

      let components = await prisma.assessmentComponent.findMany({
        where: { tenantId: access.tenant.id, termId: targetExam.termId },
        orderBy: { orderIndex: 'asc' },
      });
      if (components.length === 0) {
        components = await prisma.assessmentComponent.findMany({
          where: { tenantId: access.tenant.id, termId: null },
          orderBy: { orderIndex: 'asc' },
        });
      }
      const examComponent = components.find((component) => /exam/i.test(component.name));
      if (!examComponent || examComponent.maxScore !== 60) {
        return NextResponse.json({ error: 'This school needs an Exam result component with a 60-mark maximum before CBT scores can be imported.' }, { status: 422 });
      }
      if (targetExam.totalMarks > examComponent.maxScore || targetExam.totalMarks < 1) {
        return NextResponse.json({ error: 'The CBT score maximum does not match the school Exam component.' }, { status: 422 });
      }
      if (targetExam.attempts.length === 0) {
        return NextResponse.json({ error: 'There are no submitted CBT attempts to import.' }, { status: 422 });
      }

      let importedCount = 0;
      await prisma.$transaction(async (tx) => {
        for (const attempt of targetExam.attempts) {
          const enrollment = await tx.enrollment.findFirst({
            where: {
              studentId: attempt.studentId,
              classLevelId: targetExam.classLevelId,
              sessionId: targetExam.term.sessionId,
              status: 'active',
              student: { tenantId: access.tenant!.id },
            },
            select: { id: true },
          });
          if (!enrollment) continue;

          const existing = await tx.resultEntry.findUnique({
            where: { studentId_subjectId_termId: { studentId: attempt.studentId, subjectId: targetExam.subjectId, termId: targetExam.termId } },
          });
          if (existing && ['form_teacher_reviewed', 'published'].includes(existing.status)) {
            throw new Error('Some results are already reviewed or published. Reopen them before importing CBT marks.');
          }

          const scoreData = { ...((existing?.scoreData as Record<string, any>) || {}) };
          const previousImport = scoreData.cbtExamId === targetExam.id;
          const currentExamMark = scoreData[examComponent.id] ?? scoreData[examComponent.name] ?? scoreData[examComponent.name.toLowerCase()];
          if (currentExamMark !== undefined && currentExamMark !== null && currentExamMark !== '' && !previousImport) {
            throw new Error(`A manual Exam mark already exists for a student in ${targetExam.classLevelId}. Clear or review that mark before importing CBT scores.`);
          }

          scoreData[examComponent.id] = Math.min(attempt.score, examComponent.maxScore);
          scoreData.cbtExamId = targetExam.id;
          scoreData.total = computeTotal(scoreData, components);
          await tx.resultEntry.upsert({
            where: { studentId_subjectId_termId: { studentId: attempt.studentId, subjectId: targetExam.subjectId, termId: targetExam.termId } },
            update: { scoreData, teacherId: assignment.staffId },
            create: {
              studentId: attempt.studentId,
              subjectId: targetExam.subjectId,
              termId: targetExam.termId,
              teacherId: assignment.staffId,
              scoreData,
              status: 'not_started',
            },
          });
          importedCount++;
        }
      });

      if (importedCount === 0) {
        return NextResponse.json({ error: 'No submitted attempts belong to an active enrollment in this class and session.' }, { status: 422 });
      }

      return NextResponse.json({ success: true, importedCount, message: `Imported ${importedCount} CBT mark${importedCount === 1 ? '' : 's'} into the Exam component. The teacher can review and submit them with the CA marks.` });
    }

    if (action === 'delete_exam') {
      const targetExamId = examId || body.id;
      if (!targetExamId) {
        return NextResponse.json({ error: 'Missing examId' }, { status: 400 });
      }

      const targetExam = await prisma.cbtExam.findFirst({
        where: { id: targetExamId, tenantId: access.tenant.id },
      });
      if (!targetExam) {
        return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
      }

      if (access.user.role === 'teacher') {
        const isAssigned = await prisma.teachingAssignment.findFirst({
          where: {
            staffId: access.user.staffId || '__NONE__',
            classLevelId: targetExam.classLevelId,
            subjectId: targetExam.subjectId,
          },
        });
        if (!isAssigned) {
          return NextResponse.json({ error: 'Forbidden: You are not assigned to this class and subject.' }, { status: 403 });
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.cbtStudentAttempt.deleteMany({ where: { examId: targetExamId } });
        await tx.cbtQuestion.deleteMany({ where: { examId: targetExamId } });
        await tx.cbtExam.delete({ where: { id: targetExamId } });
      });

      await recordAuditLog({
        tenantId: access.tenant.id,
        actorId: access.user.id,
        actorName: access.user.staffProfile?.name || access.user.username,
        actorRole: access.user.role,
        action: 'delete_cbt_exam',
        entityType: 'cbt_exam',
        entityId: targetExamId,
        details: { title: targetExam.title, subjectId: targetExam.subjectId, classLevelId: targetExam.classLevelId },
      });

      return NextResponse.json({ success: true, message: `Exam "${targetExam.title}" deleted successfully.` });
    }

    if (action === 'delete_question') {
      const targetQId = questionId || body.id;
      if (!targetQId) {
        return NextResponse.json({ error: 'Missing questionId' }, { status: 400 });
      }

      const db = getTenantDb(access.tenant.id);
      const question = await db.cbtQuestion.findUnique({
        where: { id: targetQId },
        include: { exam: true },
      });
      if (!question || question.exam.tenantId !== access.tenant.id) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }

      if (access.user.role === 'teacher') {
        const isAssigned = await prisma.teachingAssignment.findFirst({
          where: {
            staffId: access.user.staffId || '__NONE__',
            classLevelId: question.exam.classLevelId,
            subjectId: question.exam.subjectId,
          },
        });
        if (!isAssigned) {
          return NextResponse.json({ error: 'Forbidden: You cannot modify this exam' }, { status: 403 });
        }
      }

      await db.cbtQuestion.delete({ where: { id: targetQId } });

      return NextResponse.json({ success: true, message: 'Question deleted successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'CBT action failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const examId = searchParams.get('examId');
    const questionId = searchParams.get('questionId');

    if (!slug) {
      return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin', 'teacher']);
    if (!access.authorized || !access.tenant || !access.user) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const hasFeature = await access.tenant.hasFeature('feature_cbt_exams');
    if (!hasFeature) {
      return NextResponse.json({ error: 'CBT Online Exams module disabled' }, { status: 403 });
    }

    // 1. Delete single question
    if (questionId) {
      const db = getTenantDb(access.tenant.id);
      const question = await db.cbtQuestion.findUnique({
        where: { id: questionId },
        include: { exam: true },
      });
      if (!question || question.exam.tenantId !== access.tenant.id) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }

      if (access.user.role === 'teacher') {
        const isAssigned = await prisma.teachingAssignment.findFirst({
          where: {
            staffId: access.user.staffId || '__NONE__',
            classLevelId: question.exam.classLevelId,
            subjectId: question.exam.subjectId,
          },
        });
        if (!isAssigned) {
          return NextResponse.json({ error: 'Forbidden: You cannot modify this exam' }, { status: 403 });
        }
      }

      await db.cbtQuestion.delete({ where: { id: questionId } });
      return NextResponse.json({ success: true, message: 'Question deleted successfully.' });
    }

    // 2. Delete entire exam
    if (examId) {
      const targetExam = await prisma.cbtExam.findFirst({
        where: { id: examId, tenantId: access.tenant.id },
      });
      if (!targetExam) {
        return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
      }

      if (access.user.role === 'teacher') {
        const isAssigned = await prisma.teachingAssignment.findFirst({
          where: {
            staffId: access.user.staffId || '__NONE__',
            classLevelId: targetExam.classLevelId,
            subjectId: targetExam.subjectId,
          },
        });
        if (!isAssigned) {
          return NextResponse.json({ error: 'Forbidden: You are not assigned to this class and subject.' }, { status: 403 });
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.cbtStudentAttempt.deleteMany({ where: { examId } });
        await tx.cbtQuestion.deleteMany({ where: { examId } });
        await tx.cbtExam.delete({ where: { id: examId } });
      });

      await recordAuditLog({
        tenantId: access.tenant.id,
        actorId: access.user.id,
        actorName: access.user.staffProfile?.name || access.user.username,
        actorRole: access.user.role,
        action: 'delete_cbt_exam',
        entityType: 'cbt_exam',
        entityId: examId,
        details: { title: targetExam.title, subjectId: targetExam.subjectId, classLevelId: targetExam.classLevelId },
      });

      return NextResponse.json({ success: true, message: `Exam "${targetExam.title}" deleted successfully.` });
    }

    return NextResponse.json({ error: 'Provide either examId or questionId parameter' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete CBT resource' }, { status: 500 });
  }
}
