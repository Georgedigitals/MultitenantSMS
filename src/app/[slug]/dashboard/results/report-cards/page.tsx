import React from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Award, Calendar, CheckCircle2, CircleDashed, Layers } from 'lucide-react';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import DashboardNav from '@/components/dashboard-nav';
import { AddSessionModal } from '@/components/add-session-modal';
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
    const primaryColor = tenant.branding.primaryColor || '#4f46e5';
    const hasSessions = tenantSessions.length > 0;
    const hasTerms = terms.length > 0;
    const hasClasses = tenantClasses.length > 0;

    const checklist = [
      {
        label: 'Academic session',
        detail: hasSessions
          ? `${tenantSessions.length} session${tenantSessions.length === 1 ? '' : 's'} configured`
          : 'Create your first academic year (e.g. 2025/2026) with active terms.',
        ready: hasSessions,
        icon: <Calendar className="w-4 h-4" />,
      },
      {
        label: 'Academic terms',
        detail: hasTerms
          ? `${terms.length} term${terms.length === 1 ? '' : 's'} ready for grading`
          : 'Terms are automatically created when you add an academic session.',
        ready: hasTerms,
        icon: <Award className="w-4 h-4" />,
      },
      {
        label: 'Class levels',
        detail: hasClasses
          ? `${tenantClasses.length} class level${tenantClasses.length === 1 ? '' : 's'} active`
          : 'Set your school’s class range (e.g. Grade 1 – Grade 12) in Settings.',
        ready: hasClasses,
        icon: <Layers className="w-4 h-4" />,
      },
    ];

    return (
      <div className="mx-auto max-w-3xl py-6 sm:py-10">
        <section className="overflow-hidden rounded-2xl border border-[#e6e4de] bg-white shadow-[0_8px_30px_rgba(17,17,16,0.06)]">
          {/* School-Branded Header */}
          <div
            className="relative overflow-hidden px-6 py-7 text-white sm:px-8"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, color-mix(in srgb, ${primaryColor} 68%, #0f172a) 100%)`,
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl"
            />
            <div className="relative z-10 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/25 backdrop-blur-xs">
                <Award className="w-5 h-5 text-white" />
              </span>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/95">
                  Report Cards Setup
                </span>
                <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-white">
                  Finish academic setup to generate report cards
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-white/80">
                  Report cards need at least one active academic session, term, and class level before results can be compiled.
                </p>
              </div>
            </div>
          </div>

          {/* Live Setup Readiness Checklist */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="divide-y divide-[#efede9] rounded-xl border border-[#e6e4de] bg-[#faf9f6] overflow-hidden">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        item.ready
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border-amber-200'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#141518]">{item.label}</p>
                      <p className="text-xs text-[#5a5b60]">{item.detail}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      item.ready
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {item.ready ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </>
                    ) : (
                      <>
                        <CircleDashed className="w-3.5 h-3.5" /> Needed
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {auth.user.role === 'school_admin' && (!hasSessions || !hasTerms) && (
                <AddSessionModal
                  slug={slug}
                  triggerButtonText="Create Academic Session"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
              {!hasClasses && (
                <Link
                  href={`/${slug}/dashboard/classes`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>Configure Classes</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link
                href={`/${slug}/dashboard`}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#d5d2ca] bg-white px-4 text-sm font-medium text-[#141518] hover:bg-[#f2f0eb] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Overview</span>
              </Link>
            </div>
          </div>
        </section>
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
    <div className="print:bg-white">
      <div className="print:hidden">
        <DashboardNav slug={slug} role={auth.user.role} />
      </div>

      <main className="max-w-6xl mx-auto py-4 print:p-0 print:m-0 print:max-w-none">
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
