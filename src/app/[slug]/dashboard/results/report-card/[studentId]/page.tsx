import React from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { findStudentByIdOrAdmissionNo } from '@/lib/student-resolver';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import DashboardNav from '@/components/dashboard-nav';
import { generateStudentReportCard, ReportCardData } from '@/lib/report-card';
import ReportCardViewClient from './report-card-view-client';
import ReportCardStatusView from './report-card-status-view';

interface ReportCardPageProps {
  params: Promise<{ slug: string; studentId: string }>;
  searchParams: Promise<{ termId?: string }>;
}

export default async function StudentReportCardPage({
  params,
  searchParams,
}: ReportCardPageProps) {
  const { slug, studentId } = await params;
  const { termId: queryTermId } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher') {
    redirect(`/${slug}/portal/results`);
  }

  // Fetch available terms
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
    session: sessionMap.get(t.sessionId) || { label: 'Unknown' },
  }));

  if (terms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <DashboardNav slug={slug} role={auth.user.role} />
        <main className="max-w-4xl mx-auto py-12 px-4">
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
            <h2 className="text-lg font-bold text-slate-800">No Academic Terms Configured</h2>
            <p className="text-sm text-slate-500 mt-2">
              Please set up an academic session and term first.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const activeTerm = queryTermId
    ? terms.find((t: any) => t.id === queryTermId) || terms[0]
    : terms.find((t: any) => t.isCurrent) || terms[0];

  // Fetch student info (supports either primary key ID or official admissionNumber)
  const cleanStudentIdentifier = studentId.trim();
  const student = await findStudentByIdOrAdmissionNo(tenant.id, cleanStudentIdentifier);

  if (!student) {
    notFound();
  }

  // Find all terms with published results for this student to power quick term-switching
  const publishedTermEntries = await prisma.resultEntry.findMany({
    where: {
      studentId: student.id,
      status: 'published',
    },
    select: { termId: true },
    distinct: ['termId'],
  });
  const publishedTermIds = new Set(publishedTermEntries.map((e: any) => e.termId));

  const availableTerms = terms.map((t: any) => ({
    id: t.id,
    name: t.name,
    sessionLabel: t.session.label,
    isPublished: publishedTermIds.has(t.id),
    isCurrent: Boolean(t.isCurrent),
  }));

  let reportCard: ReportCardData | null = null;
  let errorMessage: string | null = null;

  try {
    reportCard = await generateStudentReportCard(tenant.id, student.id, activeTerm.id);
  } catch (err: any) {
    errorMessage = err.message || 'Report card cannot be generated at this time.';
  }

  // If report card is unavailable, fetch academic context for the helpful status view
  let statusInfo: any = null;
  let enrollmentClassName = 'Class Not Assigned';
  let enrollmentClassLevelId: string | undefined;

  if (errorMessage || !reportCard) {
    const [enrollment, termEntries] = await Promise.all([
      prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          sessionId: activeTerm.sessionId,
          status: 'active',
        },
        include: {
          classLevel: true,
        },
      }),
      prisma.resultEntry.findMany({
        where: {
          studentId: student.id,
          termId: activeTerm.id,
        },
        select: {
          id: true,
          status: true,
        },
      }),
    ]);

    if (enrollment) {
      enrollmentClassName = enrollment.classLevel?.name || 'Class Assigned';
      enrollmentClassLevelId = enrollment.classLevelId;
    }

    const currentTermInSession = terms.find((t: any) => t.isCurrent);
    const now = new Date();
    const isFutureDate = activeTerm.startDate ? new Date(activeTerm.startDate) > now : false;

    const isUpcoming =
      !activeTerm.isCurrent &&
      (isFutureDate ||
        (Boolean(currentTermInSession?.startDate) &&
          Boolean(activeTerm.startDate) &&
          new Date(activeTerm.startDate) > new Date(currentTermInSession.startDate)));

    const isNotEnrolled = !enrollment;

    let currentStage = 1;
    let stageTitle = 'Score Entry by Subject Teachers';
    let stageDescription =
      'Subject teachers are currently entering continuous assessment tests and examination scores for this class.';

    if (termEntries.length > 0) {
      const allSubmitted = termEntries.every((e: any) =>
        ['submitted', 'form_teacher_reviewed', 'published'].includes(e.status)
      );
      const allReviewed = termEntries.every((e: any) =>
        ['form_teacher_reviewed', 'published'].includes(e.status)
      );

      if (allReviewed) {
        currentStage = 3;
        stageTitle = "Awaiting Principal's Approval & Publication";
        stageDescription =
          "The form teacher has completed reviewing remarks and behavioral traits. The class broadsheet is waiting for the principal's final approval and publishing.";
      } else if (allSubmitted) {
        currentStage = 2;
        stageTitle = 'Form Teacher Review & Remarks';
        stageDescription =
          'Subject scores have been submitted. The form teacher is compiling affective domain ratings, psychomotor skills, and teacher remarks.';
      } else {
        currentStage = 1;
        stageTitle = 'Score Entry in Progress';
        stageDescription =
          'Subject teachers are compiling Continuous Assessment (CA) scores and examination marks for this term.';
      }
    } else {
      currentStage = 1;
      stageTitle = 'Score Entry Has Not Started';
      stageDescription =
        'No subject scores have been entered for this student in this term yet.';
    }

    let formattedStartDate: string | undefined;
    if (activeTerm.startDate) {
      try {
        formattedStartDate = new Date(activeTerm.startDate).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
      } catch (_) {}
    }

    statusInfo = {
      isUpcoming,
      isNotEnrolled,
      currentStage,
      stageTitle,
      stageDescription,
      formattedStartDate,
      hasPublishedResultsInOtherTerms: publishedTermEntries.length > 0,
    };
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:min-h-0">
      <div className="print:hidden">
        <DashboardNav slug={slug} role={auth.user.role} />
      </div>

      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 print:p-0 print:m-0 print:max-w-none">
        {errorMessage || !reportCard ? (
          <ReportCardStatusView
            slug={slug}
            role={auth.user.role}
            student={{
              id: student.id,
              name: student.name,
              admissionNumber: student.admissionNumber || null,
            }}
            className={enrollmentClassName}
            classLevelId={enrollmentClassLevelId}
            activeTerm={{
              id: activeTerm.id,
              name: activeTerm.name,
              isCurrent: Boolean(activeTerm.isCurrent),
              startDate: activeTerm.startDate ? String(activeTerm.startDate) : null,
              endDate: activeTerm.endDate ? String(activeTerm.endDate) : null,
              sessionLabel: activeTerm.session.label,
            }}
            availableTerms={availableTerms}
            statusInfo={statusInfo}
          />
        ) : (
          <ReportCardViewClient
            slug={slug}
            reportCard={reportCard}
            availableTerms={availableTerms}
            currentTermId={activeTerm.id}
          />
        )}
      </main>
    </div>
  );
}

