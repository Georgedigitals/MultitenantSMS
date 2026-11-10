import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { checkClassSubmissionCoverage } from '@/lib/results';
import { computeTotal, previewGrade } from '@/lib/grading';
import { computeAttendanceStats } from '@/lib/attendance';
import { getTenantCurriculum, resolveStudentSubjectIds } from '@/lib/curriculum';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const classLevelId = searchParams.get('classLevelId');
  const termId = searchParams.get('termId');

  if (!slug || !classLevelId || !termId) {
    return NextResponse.json(
      { error: 'slug, classLevelId, and termId are required' },
      { status: 400 }
    );
  }

  const tenant = await getTenantContext({ slug });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });
  if (!term || term.session.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Term not found' }, { status: 404 });
  }

  const targetClass = await prisma.classLevel.findUnique({ where: { id: classLevelId } });
  if (!targetClass) return NextResponse.json({ error: 'Class level not found' }, { status: 404 });

  // 1. Check submission coverage
  const coverage = await checkClassSubmissionCoverage(tenant.id, classLevelId, termId);

  // 2. Fetch active components & scales
  let components = await prisma.assessmentComponent.findMany({
    where: { tenantId: tenant.id, termId },
    orderBy: { orderIndex: 'asc' },
  });
  if (components.length === 0) {
    components = await prisma.assessmentComponent.findMany({
      where: { tenantId: tenant.id, termId: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  const scales = await prisma.gradingScale.findMany({
    where: { tenantId: tenant.id },
    include: { lowestClassLevel: true, highestClassLevel: true },
    orderBy: { minScore: 'desc' },
  });

  // 3. Fetch students
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      status: 'active',
      student: { tenantId: tenant.id },
    },
    include: { student: true },
    orderBy: { student: { name: 'asc' } },
  });

  // 4. Fetch all results for these students
  const studentIds = enrollments.map((e: any) => e.studentId);
  const resultEntries = await prisma.resultEntry.findMany({
    where: {
      termId,
      studentId: { in: studentIds },
    },
    include: { subject: true },
  });

  // Map entries: studentId -> subjectId -> entry
  const entryMap = new Map<string, Map<string, any>>();
  for (const r of resultEntries) {
    if (!entryMap.has(r.studentId)) entryMap.set(r.studentId, new Map());
    entryMap.get(r.studentId)!.set(r.subjectId, r);
  }

  // 5. Compile broadsheet rows with read-time attendance ledger calculation
  const curriculum = await getTenantCurriculum(tenant.id);
  const teachingAssignmentsForClass = coverage.subjects.map((s) => ({ subjectId: s.subjectId }));

  const rows = [];
  for (const e of enrollments) {
    const subMap = entryMap.get(e.studentId) || new Map();
    const subjectScores: Record<string, any> = {};
    let totalScoreSum = 0;
    let scoredSubjectsCount = 0;

    const studentSubjectIds = new Set(
      resolveStudentSubjectIds({
        classLevelId,
        classLevel: targetClass,
        curriculum,
        studentContactInfo: e.student?.guardianContactInfo,
        teachingAssignmentsForClass,
      })
    );

    for (const sub of coverage.subjects) {
      const isApplicable = studentSubjectIds.has(sub.subjectId);
      if (!isApplicable) {
        subjectScores[sub.subjectId] = { notApplicable: true };
        continue;
      }

      const entry = subMap.get(sub.subjectId);
      if (entry) {
        const scoreData = (entry.scoreData as Record<string, any>) || {};
        const total = typeof scoreData.total === 'number' ? scoreData.total : computeTotal(scoreData, components);
        const preview = previewGrade(total, targetClass.orderIndex, scales);

        subjectScores[sub.subjectId] = {
          total,
          grade: entry.grade || preview.grade,
          status: entry.status,
          notApplicable: false,
        };
        totalScoreSum += total;
        scoredSubjectsCount++;
      } else {
        subjectScores[sub.subjectId] = null;
      }
    }

    const attendanceStats = await computeAttendanceStats(e.studentId, termId);

    rows.push({
      studentId: e.studentId,
      studentName: e.student.name,
      subjects: subjectScores,
      totalScoreSum,
      averageScore: scoredSubjectsCount > 0 ? Math.round((totalScoreSum / scoredSubjectsCount) * 10) / 10 : 0,
      attendance: attendanceStats,
    });
  }

  // 6. Check if current user is form teacher
  const formTeacherAssignment = await prisma.formTeacherAssignment.findFirst({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      staffId: auth.user.staffId || undefined,
    },
  });

  const isFormTeacher = formTeacherAssignment !== null || auth.user.role === 'school_admin';

  return NextResponse.json({
    coverage,
    broadsheet: rows,
    review: coverage.currentReview,
    isFormTeacher,
  });
}
