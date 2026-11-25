import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantClassLevels } from '@/lib/class-levels';
import DashboardNav from '@/components/dashboard-nav';
import ResultsOverviewClient from './results-overview-client';

interface ResultsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { slug } = await params;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) redirect('/dashboard');

  const db = getTenantDb(tenant.id);

  // 1. Fetch current session and terms
  const currentSession = await db.academicSession.findFirst({
    where: { isCurrent: true },
  });

  const rawTerms = currentSession
    ? await db.term.findMany({
        where: { sessionId: currentSession.id },
        orderBy: { startDate: 'asc' },
      })
    : [];

  const terms = rawTerms.map((t: any) => ({ id: t.id, name: t.name, isCurrent: t.isCurrent }));
  const currentTerm = terms.find((t: any) => t.isCurrent) || terms[0];

  // 2. Fetch classes for this tenant
  const tenantClasses = await getTenantClassLevels(tenant.id, { filterLegacyByRange: true });

  // 3. If teacher: fetch teaching assignments & all form teacher assignments
  const staffId = auth.user.staffId;
  let teachingAssignments: any[] = [];
  let formTeacherAssignments: any[] = [];

  if (staffId && currentSession) {
    const rawTeaching = await prisma.teachingAssignment.findMany({
      where: { staffId, sessionId: currentSession.id },
    });

    const classIds = Array.from(new Set(rawTeaching.map((t: any) => t.classLevelId))).filter(Boolean);
    const subjIds = Array.from(new Set(rawTeaching.map((t: any) => t.subjectId))).filter(Boolean);

    const [clsList, subjsList] = await Promise.all([
      classIds.length > 0 ? prisma.classLevel.findMany({ where: { id: { in: classIds } } }) : [],
      subjIds.length > 0 ? db.subject.findMany({ where: { id: { in: subjIds } } }) : [],
    ]);
    const clsMap = new Map(clsList.map((c: any) => [c.id, c]));
    const subjMap = new Map(subjsList.map((s: any) => [s.id, s]));

    teachingAssignments = rawTeaching.map((t: any) => ({
      ...t,
      classLevel: clsMap.get(t.classLevelId) || { name: 'Unknown', orderIndex: 0 },
      subject: subjMap.get(t.subjectId) || { name: 'Unknown' },
    })).sort((a: any, b: any) => (a.classLevel.orderIndex || 0) - (b.classLevel.orderIndex || 0));

    formTeacherAssignments = await prisma.formTeacherAssignment.findMany({
      where: { staffId, sessionId: currentSession.id },
      include: { classLevel: true },
      orderBy: { classLevel: { orderIndex: 'asc' } },
    });
  }

  // 4. If admin: fetch all teaching assignments across tenant to build class-by-class status
  const classStatusSummaries = [];
  if (auth.user.role === 'school_admin' && currentSession && currentTerm) {
    for (const cl of tenantClasses) {
      const assignedCount = await prisma.teachingAssignment.count({
        where: { classLevelId: cl.id, sessionId: currentSession.id },
      });

      const classEnrollments = await prisma.enrollment.findMany({
        where: { classLevelId: cl.id, sessionId: currentSession.id, status: 'active', student: { tenantId: tenant.id } },
        select: { studentId: true },
      });
      const classStudentIds = classEnrollments.map((e) => e.studentId);
      const enrolledCount = classStudentIds.length;

      const review = await prisma.classResultReview.findUnique({
        where: { classLevelId_termId: { classLevelId: cl.id, termId: currentTerm.id } },
      });

      let formTeacherName = 'Unassigned';
      if (review?.formTeacherId) {
        const ft = await db.staff.findUnique({ where: { id: review.formTeacherId } });
        if (ft) formTeacherName = ft.name;
      } else {
        const assignedFt = await prisma.formTeacherAssignment.findFirst({
          where: { classLevelId: cl.id, sessionId: currentSession.id },
          include: { staff: { select: { name: true } } },
        });
        if (assignedFt?.staff?.name) formTeacherName = assignedFt.staff.name;
      }

      // Check published and submitted status strictly for this class
      const publishedCount = classStudentIds.length > 0 ? await prisma.resultEntry.count({
        where: {
          termId: currentTerm.id,
          studentId: { in: classStudentIds },
          status: 'published',
        },
      }) : 0;

      const submittedCount = classStudentIds.length > 0 ? await prisma.resultEntry.count({
        where: {
          termId: currentTerm.id,
          studentId: { in: classStudentIds },
          status: { in: ['submitted', 'form_teacher_reviewed', 'published'] },
        },
      }) : 0;

      const totalExpected = assignedCount * enrolledCount;
      const isClassPublished = publishedCount > 0 && (totalExpected > 0 ? publishedCount >= totalExpected : true);

      let statusLabel = 'Not Started';
      if (isClassPublished) {
        statusLabel = 'Published';
      } else if (review?.submittedToAdminAt) {
        statusLabel = 'Reviewed by Form Teacher';
      } else if (submittedCount > 0) {
        statusLabel = `${submittedCount}/${totalExpected || submittedCount} Scores Submitted`;
      }

      classStatusSummaries.push({
        classLevelId: cl.id,
        classLevelName: cl.name,
        assignedSubjects: assignedCount,
        enrolledStudents: enrolledCount,
        statusLabel,
        isPublished: isClassPublished,
        isReviewed: Boolean(review?.submittedToAdminAt),
        formTeacherName,
        reviewNotes: review?.overallRemarks || null,
        submittedToAdminAt: review?.submittedToAdminAt ? review.submittedToAdminAt.toISOString() : null,
      });
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Results Operations</h1>
          <p className="text-sm text-slate-500">
            Score entry, broadsheet reviews, and term result publishing
          </p>
        </div>
      </div>

      <ResultsOverviewClient
        slug={slug}
        role={auth.user.role}
        terms={terms}
        currentTermId={currentTerm?.id}
        teacherAssignments={teachingAssignments.map((a) => ({
          id: a.id,
          classLevelId: a.classLevelId,
          className: a.classLevel.name,
          subjectId: a.subjectId,
          subjectName: a.subject.name,
        }))}
        formTeacherClasses={formTeacherAssignments.map((fa: any) => ({
          classLevelId: fa.classLevelId,
          className: fa.classLevel?.name || 'Unknown',
        }))}
        classSummaries={classStatusSummaries}
      />
    </div>
  );
}
