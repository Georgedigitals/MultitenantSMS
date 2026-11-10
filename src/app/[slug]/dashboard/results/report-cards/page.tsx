import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import DashboardNav from '@/components/dashboard-nav';
import { generateStudentReportCard, ReportCardData } from '@/lib/report-card';
import ReportCardsClient from './report-cards-client';

interface ReportCardsDirectoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ classLevelId?: string; termId?: string }>;
}

export default async function ReportCardsDirectoryPage({
  params,
  searchParams,
}: ReportCardsDirectoryPageProps) {
  const { slug } = await params;
  const { classLevelId: queryClassId, termId: queryTermId } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) {
    redirect('/dashboard');
  }

  // 1. Fetch available class levels within tenant range
  const allLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  const lowest = tenant.lowestClassLevelId
    ? allLevels.find((l: any) => l.id === tenant.lowestClassLevelId)
    : null;
  const highest = tenant.highestClassLevelId
    ? allLevels.find((l: any) => l.id === tenant.highestClassLevelId)
    : null;

  const minOrder = lowest ? lowest.orderIndex : -Infinity;
  const maxOrder = highest ? highest.orderIndex : Infinity;

  const tenantClasses = allLevels.filter(
    (l: any) => l.orderIndex >= minOrder && l.orderIndex <= maxOrder
  );

  // 2. Fetch terms
  const tenantSessions = await prisma.academicSession.findMany({
    where: { tenantId: tenant.id },
  });
  const sessionIds = tenantSessions.map((s: any) => s.id);
  const sessionMap = new Map(tenantSessions.map((s: any) => [s.id, s]));

  const rawTerms = sessionIds.length > 0
    ? await prisma.term.findMany({
        where: { sessionId: { in: sessionIds } },
        orderBy: { startDate: 'desc' },
      })
    : [];

  const terms = rawTerms.map((t: any) => ({
    ...t,
    session: sessionMap.get(t.sessionId) || { label: 'Unknown', tenantId: tenant.id },
  }));

  if (tenantClasses.length === 0 || terms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <DashboardNav slug={slug} role={auth.user.role} />
        <main className="max-w-4xl mx-auto py-12 px-4">
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
            <h2 className="text-lg font-bold text-slate-800">Setup Required</h2>
            <p className="text-sm text-slate-500 mt-2">
              Please ensure academic sessions, terms, and classes are configured first.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const selectedClass = queryClassId
    ? tenantClasses.find((c: any) => c.id === queryClassId) || tenantClasses[0]
    : tenantClasses[0];

  const selectedTerm = queryTermId
    ? terms.find((t: any) => t.id === queryTermId) || terms[0]
    : terms.find((t: any) => t.isCurrent) || terms[0];

  // 3. Fetch all active enrollments for this class and session
  const rawEnrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId: selectedClass.id,
      sessionId: selectedTerm.sessionId,
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

  // 4. Fetch published report cards for each student
  const studentRows = [];
  let publishedCount = 0;

  for (const enr of enrollments) {
    let reportCard: ReportCardData | null = null;
    let isPublished = false;

    try {
      reportCard = await generateStudentReportCard(tenant.id, enr.studentId, selectedTerm.id);
      isPublished = true;
      publishedCount++;
    } catch {
      // Results not published yet
      isPublished = false;
    }

    studentRows.push({
      studentId: enr.studentId,
      name: enr.student.name,
      isPublished,
      publishedCount: reportCard ? reportCard.subjects.length : 0,
      totalSubjects: reportCard ? reportCard.subjects.length : 0,
      averageScore: reportCard ? reportCard.summary.averageScore : null,
      position: reportCard ? reportCard.summary.position : null,
      reportCard,
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:min-h-0">
      <div className="print:hidden">
        <DashboardNav slug={slug} role={auth.user.role} />
      </div>

      <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 print:p-0 print:m-0 print:max-w-none">
        <ReportCardsClient
          slug={slug}
          classLevels={tenantClasses.map((c: any) => ({ id: c.id, name: c.name }))}
          terms={terms.map((t: any) => ({
            id: t.id,
            name: t.name,
            sessionLabel: t.session.label,
          }))}
          selectedClassId={selectedClass.id}
          selectedTermId={selectedTerm.id}
          students={studentRows}
          publishedCount={publishedCount}
          totalStudents={enrollments.length}
        />
      </main>
    </div>
  );
}
