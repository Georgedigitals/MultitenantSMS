import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantAccess } from '@/lib/auth/tenant-access';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { examId, answers, slug } = body;

    if (!examId || !slug || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['student']);
    if (!access.authorized || !access.tenant || !access.user?.studentId) {
      return NextResponse.json({ error: 'Sign in with your student portal account to submit this exam.' }, { status: 401 });
    }

    const exam = await prisma.cbtExam.findFirst({
      where: { id: examId, tenantId: access.tenant.id, isPublished: true },
      include: { questions: true, term: { select: { sessionId: true } } },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // The verified tenant session determines the student. Never accept an ID
    // supplied by the browser for a protected assessment submission.
    const studentRecord = await prisma.student.findFirst({
      where: {
        tenantId: exam.tenantId,
        id: access.user.studentId,
      },
    });

    if (!studentRecord) {
      return NextResponse.json(
        { error: 'Student record not found for this school. Please check your Student ID or Admission Number.' },
        { status: 404 }
      );
    }

    const resolvedStudentId = studentRecord.id;

    // Verify student is enrolled in the class assigned to this test/exam
    const isEnrolledInClass = await prisma.enrollment.findFirst({
      where: {
        studentId: resolvedStudentId,
        classLevelId: exam.classLevelId,
        sessionId: exam.term.sessionId,
        status: 'active',
      },
    });

    if (!isEnrolledInClass) {
      return NextResponse.json(
        { error: 'Forbidden: You can only take tests and exams assigned to your enrolled class.' },
        { status: 403 }
      );
    }

    // Verify subject is in student's departmental track or core offerings
    const { getTenantCurriculum, resolveStudentSubjectIds } = await import('@/lib/curriculum');
    const tenantCurriculum = await getTenantCurriculum(access.tenant.id);
    const allowedSubjectIds = resolveStudentSubjectIds({
      classLevelId: exam.classLevelId,
      curriculum: tenantCurriculum,
      studentContactInfo: studentRecord.guardianContactInfo,
    });
    if (!allowedSubjectIds.includes(exam.subjectId)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only submit tests and exams for subjects in your department track.' },
        { status: 403 }
      );
    }

    const questionIds = new Set(exam.questions.map((question) => question.id));
    for (const [questionId, answer] of Object.entries(answers)) {
      if (!questionIds.has(questionId) || typeof answer !== 'string' || !['A', 'B', 'C', 'D'].includes(answer.toUpperCase())) {
        return NextResponse.json({ error: 'The submitted answers are invalid. Refresh the exam and try again.' }, { status: 400 });
      }
    }

    if (!Number.isInteger(exam.totalMarks) || exam.totalMarks < 1 || exam.totalMarks > 60) {
      return NextResponse.json({ error: 'This exam has an invalid score limit. Contact your school.' }, { status: 422 });
    }

    const priorAttempt = await prisma.cbtStudentAttempt.findUnique({
      where: { examId_studentId: { examId, studentId: resolvedStudentId } },
      select: { startedAt: true, submittedAt: true },
    });
    if (priorAttempt?.submittedAt) {
      return NextResponse.json({ error: 'You have already submitted this exam.' }, { status: 409 });
    }
    if (!priorAttempt) {
      return NextResponse.json({ error: 'You must start the exam before submitting answers.' }, { status: 400 });
    }

    // Enforce server-side exam duration with a 120-second network grace buffer for auto-submission
    const elapsedSeconds = Math.floor((Date.now() - new Date(priorAttempt.startedAt).getTime()) / 1000);
    const maxAllowedSeconds = exam.durationMins * 60 + 120;
    if (elapsedSeconds > maxAllowedSeconds) {
      return NextResponse.json(
        { error: `Exam time limit of ${exam.durationMins} minutes has expired.` },
        { status: 422 }
      );
    }

    // Auto-grading engine
    let scoredPoints = 0;
    let maxPoints = 0;

    exam.questions.forEach((q: any) => {
      maxPoints += q.points;
      const selectedOption = answers[q.id];
      if (selectedOption && selectedOption.toUpperCase() === q.correctOption.toUpperCase()) {
        scoredPoints += q.points;
      }
    });

    // Scale score to totalMarks or use raw points
    const finalScore = maxPoints > 0 ? Math.round((scoredPoints / maxPoints) * exam.totalMarks) : 0;

    const attempt = await prisma.cbtStudentAttempt.upsert({
      where: { examId_studentId: { examId, studentId: resolvedStudentId } },
      update: {
        score: finalScore,
        maxScore: exam.totalMarks,
        answers,
        submittedAt: new Date(),
      },
      create: {
        examId,
        studentId: resolvedStudentId,
        score: finalScore,
        maxScore: exam.totalMarks,
        answers,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      score: finalScore,
      maxScore: exam.totalMarks,
      attempt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to submit exam attempt' }, { status: 500 });
  }
}
