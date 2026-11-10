import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import DashboardNav from '@/components/dashboard-nav';
import ScoreEntryClient from './score-entry-client';
import { computeTotal, previewGrade } from '@/lib/grading';
import { getTenantCurriculum, resolveStudentSubjectIds } from '@/lib/curriculum';

interface ScoreEntryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ classLevelId?: string; subjectId?: string; termId?: string }>;
}

export default async function ScoreEntryPage({ params, searchParams }: ScoreEntryPageProps) {
  const { slug } = await params;
  const { classLevelId, subjectId, termId } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) redirect('/dashboard');

  if (!classLevelId || !subjectId || !termId) {
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
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!classLevel || !subject) notFound();

  // Enforce that teachers can only enter scores for classes & subjects assigned to them
  if (auth.user.role === 'teacher') {
    if (!auth.user.staffId) {
      redirect('/dashboard/results');
    }
    const isAssigned = await prisma.teachingAssignment.findFirst({
      where: {
        staffId: auth.user.staffId,
        classLevelId,
        subjectId,
        sessionId: session.id,
      },
    });
    if (!isAssigned) {
      redirect('/dashboard/results');
    }
  }

  // 1. Fetch active components for this term
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

  // 2. Fetch scales for preview
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
    minScore: Number(s.minScore),
    maxScore: Number(s.maxScore),
    grade: s.grade,
    remark: s.remark,
    lowestClassLevel: scaleClassMap.get(s.lowestClassLevelId) || { id: s.lowestClassLevelId, orderIndex: 0 },
    highestClassLevel: scaleClassMap.get(s.highestClassLevelId) || { id: s.highestClassLevelId, orderIndex: 99 },
  }));

  // 3. Fetch active enrollments
  const rawEnrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      status: 'active',
    },
  });

  const studentIds = rawEnrollments.map((e: any) => e.studentId);
  const students = studentIds.length > 0
    ? await prisma.student.findMany({
        where: { id: { in: studentIds }, tenantId: tenant.id },
      })
    : [];

  const studentMap = new Map(students.map((s: any) => [s.id, s]));
  const enrollments = rawEnrollments
    .filter((e: any) => studentMap.has(e.studentId))
    .map((e: any) => ({
      ...e,
      student: studentMap.get(e.studentId)!,
    }))
    .sort((a: any, b: any) => (a.student.name || '').localeCompare(b.student.name || ''));

  // 4. Fetch existing entries
  const existingEntries = await prisma.resultEntry.findMany({
    where: {
      termId,
      subjectId,
      studentId: { in: enrollments.map((e: any) => e.studentId) },
    },
  });

  const entryMap = new Map(existingEntries.map((e: any) => [e.studentId, e]));

  // 5. Filter enrolled students according to class curriculum & departmental tracks
  const curriculum = await getTenantCurriculum(tenant.id);
  const eligibleEnrollments = enrollments.filter((e: any) => {
    const studentSubjectIds = resolveStudentSubjectIds({
      classLevelId,
      classLevel,
      curriculum,
      studentContactInfo: e.student.guardianContactInfo,
    });

    if ((curriculum.classes[classLevelId] || []).length > 0) {
      return studentSubjectIds.includes(subjectId);
    }

    return true;
  });

  const initialRows = eligibleEnrollments.map((e: any) => {
    const entry: any = entryMap.get(e.studentId);
    const scoreData = (entry?.scoreData as Record<string, any>) || {};
    const total = computeTotal(scoreData, components);
    const preview = previewGrade(total, classLevel.orderIndex, scales);

    return {
      studentId: e.studentId,
      studentName: e.student.name,
      scores: scoreData,
      total,
      previewGrade: entry?.grade || preview.grade,
      comment: entry?.comment || '',
      status: entry?.status || 'not_started',
    };
  });

  const isLocked = existingEntries.some((e: any) =>
    ['form_teacher_reviewed', 'published'].includes(e.status)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      <ScoreEntryClient
        slug={slug}
        classLevelId={classLevelId}
        className={classLevel.name}
        subjectId={subjectId}
        subjectName={subject.name}
        termId={termId}
        termName={term.name}
        components={components.map((c: any) => ({
          id: c.id,
          name: c.name,
          maxScore: c.maxScore,
          weightPercent: Number(c.weightPercent),
        }))}
        gradingScales={scales}
        classLevelOrderIndex={classLevel.orderIndex}
        initialRows={initialRows}
        isLocked={isLocked}
      />
    </div>
  );
}
