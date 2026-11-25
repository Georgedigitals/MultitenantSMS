import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import DashboardNav from '@/components/dashboard-nav';
import BroadsheetClient from './broadsheet-client';
import { checkClassSubmissionCoverage } from '@/lib/results';
import { computeTotal, previewGrade } from '@/lib/grading';
import { computeAttendanceStats } from '@/lib/attendance';
import { getTenantCurriculum, resolveStudentSubjectIds } from '@/lib/curriculum';
import { normalizeTraitRatings } from '@/lib/report-card-domains';
import { AFFECTIVE_TRAITS, PSYCHOMOTOR_TRAITS } from '@/lib/report-card-domains';

interface BroadsheetPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ classLevelId?: string; termId?: string }>;
}

export default async function BroadsheetPage({ params, searchParams }: BroadsheetPageProps) {
  const { slug } = await params;
  const { classLevelId, termId } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) redirect('/dashboard');

  if (!classLevelId || !termId) {
    redirect('/dashboard/results');
  }

  const term = await prisma.term.findUnique({
    where: { id: termId },
  });
  if (!term) notFound();

  const session = await prisma.academicSession.findUnique({
    where: { id: term.sessionId },
  });
  if (!session || session.tenantId !== tenant.id) notFound();

  const classLevel = await prisma.classLevel.findUnique({ where: { id: classLevelId } });
  if (!classLevel) notFound();

  // Enforce that only the designated Form Teacher (or Admin) can view the class broadsheet
  if (auth.user.role === 'teacher') {
    if (!auth.user.staffId) {
      redirect('/dashboard/results');
    }
    const isFormTeacher = await prisma.formTeacherAssignment.findFirst({
      where: {
        staffId: auth.user.staffId,
        classLevelId,
        sessionId: session.id,
      },
    });
    if (!isFormTeacher) {
      redirect('/dashboard/results');
    }
  }

  // 1. Submission coverage
  const coverage = await checkClassSubmissionCoverage(tenant.id, classLevelId, termId);

  // 2. Active components & scales
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

  const rawScales = await prisma.gradingScale.findMany({
    where: { tenantId: tenant.id },
    orderBy: { minScore: 'desc' },
  });

  const scaleClassIds = Array.from(new Set([
    ...rawScales.map((s: any) => s.lowestClassLevelId),
    ...rawScales.map((s: any) => s.highestClassLevelId),
  ])).filter(Boolean);

  const scaleClassLevels = scaleClassIds.length > 0
    ? await prisma.classLevel.findMany({ where: { id: { in: scaleClassIds } } })
    : [];
  const scaleClassMap = new Map(scaleClassLevels.map((c: any) => [c.id, c]));

  const scales = rawScales.map((s: any) => ({
    ...s,
    lowestClassLevel: scaleClassMap.get(s.lowestClassLevelId) || { orderIndex: 0 },
    highestClassLevel: scaleClassMap.get(s.highestClassLevelId) || { orderIndex: 99 },
  }));

  // 3. Enrolled students
  const rawEnrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      status: 'active',
    },
  });

  const enrolledStudentIds = rawEnrollments.map((e: any) => e.studentId);
  const enrolledStudents = enrolledStudentIds.length > 0
    ? await prisma.student.findMany({
        where: { id: { in: enrolledStudentIds }, tenantId: tenant.id },
      })
    : [];

  const studentMap = new Map(enrolledStudents.map((s: any) => [s.id, s]));
  const enrollments = rawEnrollments
    .filter((e: any) => studentMap.has(e.studentId))
    .map((e: any) => ({
      ...e,
      student: studentMap.get(e.studentId)!,
    }))
    .sort((a: any, b: any) => (a.student.name || '').localeCompare(b.student.name || ''));

  // 4. Result entries
  const studentIds = enrollments.map((e: any) => e.studentId);
  const reportCardAssessments = studentIds.length > 0
    ? await prisma.reportCardAssessment.findMany({
        where: { tenantId: tenant.id, classLevelId, termId, studentId: { in: studentIds } },
        select: { studentId: true, affectiveRatings: true, psychomotorRatings: true },
      })
    : [];
  const reportCardAssessmentMap = new Map(reportCardAssessments.map((assessment) => [assessment.studentId, assessment]));
  const publishedEntryCount = studentIds.length > 0
    ? await prisma.resultEntry.count({
        where: { termId, studentId: { in: studentIds }, status: 'published' },
      })
    : 0;
  const resultEntries = await prisma.resultEntry.findMany({
    where: {
      termId,
      studentId: { in: studentIds },
    },
  });

  const entryMap = new Map<string, Map<string, any>>();
  for (const r of resultEntries) {
    if (!entryMap.has(r.studentId)) entryMap.set(r.studentId, new Map());
    entryMap.get(r.studentId)!.set(r.subjectId, r);
  }

  // 5. Broadsheet matrix compilation
  const curriculum = await getTenantCurriculum(tenant.id);
  const teachingAssignmentsForClass = coverage.subjects.map((s) => ({ subjectId: s.subjectId }));

  const matrixRows = [];
  for (const e of enrollments) {
    const subMap = entryMap.get(e.studentId) || new Map();
    const scoresBySubject: Record<string, any> = {};
    let studentTotal = 0;
    let countedSubjects = 0;

    const studentSubjectIds = new Set(
      resolveStudentSubjectIds({
        classLevelId,
        classLevel,
        curriculum,
        studentContactInfo: e.student?.guardianContactInfo,
        teachingAssignmentsForClass,
      })
    );

    for (const sub of coverage.subjects) {
      const isApplicable = studentSubjectIds.has(sub.subjectId);
      if (!isApplicable) {
        scoresBySubject[sub.subjectId] = { notApplicable: true };
        continue;
      }

      const entry = subMap.get(sub.subjectId);
      if (entry) {
        const scoreData = (entry.scoreData as Record<string, any>) || {};
        const total = typeof scoreData.total === 'number' ? scoreData.total : computeTotal(scoreData, components);
        const preview = previewGrade(total, classLevel.orderIndex, scales);

        scoresBySubject[sub.subjectId] = {
          total,
          grade: entry.grade || preview.grade,
          status: entry.status,
          notApplicable: false,
        };
        studentTotal += total;
        countedSubjects++;
      } else {
        scoresBySubject[sub.subjectId] = null;
      }
    }

    const attendanceStats = await computeAttendanceStats(e.studentId, termId);

    matrixRows.push({
      studentId: e.studentId,
      studentName: e.student.name,
      subjects: scoresBySubject,
      totalScore: studentTotal,
      averageScore: countedSubjects > 0 ? Math.round((studentTotal / countedSubjects) * 10) / 10 : 0,
      attendance: attendanceStats,
    });
  }

  // 6. Check form teacher identity
  const formTeacherAssignment = auth.user.staffId
    ? await prisma.formTeacherAssignment.findFirst({
        where: {
          classLevelId,
          sessionId: term.sessionId,
          staffId: auth.user.staffId,
        },
      })
    : null;
  const canReview = formTeacherAssignment !== null || auth.user.role === 'school_admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      <BroadsheetClient
        slug={slug}
        isAdmin={auth.user.role === 'school_admin'}
        classLevelId={classLevelId}
        className={classLevel.name}
        termId={termId}
        termName={term.name}
        coverage={coverage}
        rows={matrixRows}
        canReview={canReview}
        existingReview={coverage.currentReview}
        canEditAssessments={!coverage.currentReview?.submittedToAdminAt && publishedEntryCount === 0}
        initialStudentAssessments={enrollments.map((enrollment: any) => {
          const assessment = reportCardAssessmentMap.get(enrollment.studentId);
          const rawAffective = (assessment?.affectiveRatings && typeof assessment.affectiveRatings === 'object')
            ? (assessment.affectiveRatings as Record<string, any>)
            : undefined;
          const remarks = typeof rawAffective?._remarks === 'string'
            ? rawAffective._remarks
            : (typeof (assessment as any)?.remarks === 'string' ? (assessment as any).remarks : '');
          return {
            studentId: enrollment.studentId,
            studentName: enrollment.student.name,
            affectiveRatings: normalizeTraitRatings(assessment?.affectiveRatings, AFFECTIVE_TRAITS),
            psychomotorRatings: normalizeTraitRatings(assessment?.psychomotorRatings, PSYCHOMOTOR_TRAITS),
            remarks,
          };
        })}
      />
    </div>
  );
}
