import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';

export async function GET(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = auth.user.tenantId;
    const role = auth.user.role;
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get('assignmentId');
    const classLevelId = searchParams.get('classLevelId');
    const subjectId = searchParams.get('subjectId');

    // Detail view of submissions for a specific assignment (admin/teacher)
    if (assignmentId && (role === 'school_admin' || role === 'teacher')) {
      const assignment = await prisma.studentAssignment.findFirst({
        where: { id: assignmentId, tenantId },
        include: {
          classLevel: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
          submissions: {
            include: {
              student: { select: { id: true, name: true, admissionNumber: true } },
            },
            orderBy: { submittedAt: 'desc' },
          },
        },
      });
      if (!assignment) {
        return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      }
      return NextResponse.json({ assignment });
    }

    // Student / Parent view
    if (role === 'student' || role === 'parent') {
      let targetStudentId = auth.user.studentId || null;
      if (role === 'parent') {
        const requestedStudentId = searchParams.get('studentId');
        const guardian = await prisma.guardian.findFirst({
          where: { tenantId, userAccount: { id: auth.user.id } },
          include: { students: { select: { studentId: true } } },
        });
        const linkedIds = guardian?.students.map((s) => s.studentId) || [];
        if (requestedStudentId && linkedIds.includes(requestedStudentId)) {
          targetStudentId = requestedStudentId;
        } else {
          targetStudentId = linkedIds[0] || null;
        }
      }

      if (!targetStudentId) {
        return NextResponse.json({ assignments: [] });
      }

      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: targetStudentId,
          status: 'active',
          session: { tenantId },
        },
        orderBy: { createdAt: 'desc' },
        select: { classLevelId: true },
      });

      if (!enrollment) {
        return NextResponse.json({ assignments: [] });
      }

      const assignments = await prisma.studentAssignment.findMany({
        where: {
          tenantId,
          classLevelId: enrollment.classLevelId,
          isPublished: true,
        },
        include: {
          classLevel: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
          submissions: {
            where: { studentId: targetStudentId },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      });

      return NextResponse.json({
        studentId: targetStudentId,
        assignments: assignments.map((a) => ({
          id: a.id,
          title: a.title,
          instructions: a.instructions,
          attachmentUrl: a.attachmentUrl,
          dueDate: a.dueDate ? a.dueDate.toISOString() : null,
          maxScore: a.maxScore,
          createdAt: a.createdAt.toISOString(),
          classLevel: a.classLevel,
          subject: a.subject,
          teacherName: a.staff?.name || 'Teacher',
          mySubmission: a.submissions[0]
            ? {
                id: a.submissions[0].id,
                content: a.submissions[0].content,
                attachmentUrl: a.submissions[0].attachmentUrl,
                score: a.submissions[0].score,
                feedback: a.submissions[0].feedback,
                status: a.submissions[0].status,
                submittedAt: a.submissions[0].submittedAt.toISOString(),
                gradedAt: a.submissions[0].gradedAt ? a.submissions[0].gradedAt.toISOString() : null,
              }
            : null,
        })),
      });
    }

    // Admin / Teacher list view
    const where: Record<string, any> = { tenantId };
    if (classLevelId) where.classLevelId = classLevelId;
    if (subjectId) where.subjectId = subjectId;
    if (role === 'teacher' && auth.user.staffId) {
      where.createdByStaffId = auth.user.staffId;
    }

    const assignments = await prisma.studentAssignment.findMany({
      where,
      include: {
        classLevel: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        instructions: a.instructions,
        attachmentUrl: a.attachmentUrl,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        maxScore: a.maxScore,
        isPublished: a.isPublished,
        createdAt: a.createdAt.toISOString(),
        classLevel: a.classLevel,
        subject: a.subject,
        teacherName: a.staff?.name || 'School Admin',
        submissionCount: a._count.submissions,
      })),
    });
  } catch (error: any) {
    console.error('[GET /api/tenant/homework]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load homework' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = auth.user.tenantId;
    const role = auth.user.role;
    const body = await req.json();

    // Student submitting homework
    if (body.action === 'submit' || role === 'student') {
      if (role !== 'student' || !auth.user.studentId) {
        return NextResponse.json({ error: 'Only logged-in students can submit homework' }, { status: 403 });
      }
      const assignmentId = String(body.assignmentId || '').trim();
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      const attachmentUrl = typeof body.attachmentUrl === 'string' && body.attachmentUrl.trim() ? body.attachmentUrl.trim() : null;

      if (!assignmentId || (!content && !attachmentUrl)) {
        return NextResponse.json({ error: 'Please write an answer or attach a file before submitting.' }, { status: 400 });
      }

      const assignment = await prisma.studentAssignment.findFirst({
        where: { id: assignmentId, tenantId, isPublished: true },
      });
      if (!assignment) {
        return NextResponse.json({ error: 'Homework assignment not found' }, { status: 404 });
      }

      const existing = await prisma.studentAssignmentSubmission.findUnique({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: auth.user.studentId,
          },
        },
      });
      if (existing && existing.status === 'graded') {
        return NextResponse.json({ error: 'This submission has already been graded and cannot be edited.' }, { status: 409 });
      }

      const submission = await prisma.studentAssignmentSubmission.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: auth.user.studentId,
          },
        },
        update: {
          content: content || null,
          attachmentUrl,
          submittedAt: new Date(),
        },
        create: {
          tenantId,
          assignmentId,
          studentId: auth.user.studentId,
          content: content || null,
          attachmentUrl,
          status: 'submitted',
        },
      });

      return NextResponse.json({ success: true, submission });
    }

    // Admin / Teacher creating homework
    if (role !== 'school_admin' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const title = String(body.title || '').trim();
    const classLevelId = String(body.classLevelId || '').trim();
    const subjectId = String(body.subjectId || '').trim();
    const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : null;
    const maxScore = Math.max(1, Math.min(1000, Number(body.maxScore) || 100));
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;

    if (!title || !classLevelId || !subjectId) {
      return NextResponse.json({ error: 'Title, class level, and subject are required.' }, { status: 400 });
    }
    if (dueDate && isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }

    const [subject, classLevel] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, tenantId } }),
      prisma.classLevel.findFirst({ where: { id: classLevelId, OR: [{ tenantId }, { tenantId: null }] } }),
    ]);
    if (!subject || !classLevel) {
      return NextResponse.json({ error: 'Selected subject or class level is invalid for this school.' }, { status: 404 });
    }

    const created = await prisma.studentAssignment.create({
      data: {
        tenantId,
        classLevelId,
        subjectId,
        termId: typeof body.termId === 'string' && body.termId ? body.termId : null,
        createdByStaffId: auth.user.staffId || null,
        title,
        instructions,
        dueDate,
        maxScore,
        isPublished: body.isPublished !== false,
      },
    });

    await recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: role,
      action: 'HOMEWORK_CREATED',
      entityType: 'StudentAssignment',
      entityId: created.id,
      details: { title, classLevel: classLevel.name, subject: subject.name, maxScore },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, assignment: created }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/tenant/homework]', error);
    return NextResponse.json({ error: error?.message || 'Failed to save homework' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId;
    const body = await req.json();

    // Grade a student submission
    if (body.action === 'grade') {
      const submissionId = String(body.submissionId || '').trim();
      const score = Number(body.score);
      const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : null;

      if (!submissionId || isNaN(score) || score < 0) {
        return NextResponse.json({ error: 'Valid submissionId and numeric score are required.' }, { status: 400 });
      }

      const submission = await prisma.studentAssignmentSubmission.findFirst({
        where: { id: submissionId, tenantId },
        include: { assignment: { select: { maxScore: true } } },
      });
      if (!submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }
      if (score > submission.assignment.maxScore) {
        return NextResponse.json({ error: `Score cannot exceed max score (${submission.assignment.maxScore}).` }, { status: 400 });
      }

      const graded = await prisma.studentAssignmentSubmission.update({
        where: { id: submission.id },
        data: {
          score,
          feedback,
          status: 'graded',
          gradedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, submission: graded });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('[PATCH /api/tenant/homework]', error);
    return NextResponse.json({ error: error?.message || 'Failed to grade submission' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Homework id is required' }, { status: 400 });
    }

    const existing = await prisma.studentAssignment.findFirst({
      where: {
        id,
        tenantId,
        ...(auth.user.role === 'teacher' && auth.user.staffId ? { createdByStaffId: auth.user.staffId } : {}),
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Homework assignment not found or unauthorized' }, { status: 404 });
    }

    await prisma.studentAssignment.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/tenant/homework]', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete homework' }, { status: 500 });
  }
}
