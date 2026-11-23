import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Laptop,
  MessageSquare,
  Receipt,
  UserPlus,
  Users,
} from 'lucide-react';
import { AddSessionModal } from '@/components/add-session-modal';
import { calculateStudentFeeBalance } from '@/lib/fees';
import { getPlatformLocalization } from '@/lib/platform-settings';
import { formatMoney } from '@/lib/i18n/currency';

interface TenantDashboardProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantDashboardPage({ params }: TenantDashboardProps) {
  const { slug } = await params;
  const [tenant, localization] = await Promise.all([
    getTenantContext({ slug }),
    getPlatformLocalization(),
  ]);
  const fmtMoney = (amt: number) => formatMoney(amt, localization);

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  const { user } = auth;
  const userName = user.staffProfile?.name || user.studentProfile?.name || user.username;
  const currentSession = tenant.currentSession;
  const currentTerm = currentSession?.currentTerm;
  const dataHue = tenant.branding.primaryColor || '#1d5fbf';

  // ─────────────────────────────────────────────────────────────
  // 1. SCHOOL ADMINISTRATOR DASHBOARD
  // ─────────────────────────────────────────────────────────────
  if (user.role === 'school_admin') {
    const [
      studentCount,
      staffCount,
      subjectCount,
      cbtExamCount,
      smsLogCount,
      pendingVerificationsCount,
      pendingResultReviewsCount,
      pendingStaffLeavesCount,
    ] = await Promise.all([
      prisma.student.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.staff.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.subject.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.cbtExam.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.smsLog.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.feePaymentVerification.count({
        where: { tenantId: tenant.id, status: 'pending' },
      }).catch(() => 0),
      currentTerm
        ? prisma.classResultReview.count({
            where: {
              termId: currentTerm.id,
              submittedToAdminAt: { not: null },
            },
          }).catch(() => 0)
        : Promise.resolve(0),
      tenant.hasFeature('staff_attendance')
        ? prisma.staffLeaveRequest.count({
            where: { tenantId: tenant.id, status: 'pending' },
          }).catch(() => 0)
        : Promise.resolve(0),
    ]);

    const studentCeiling = tenant.plan.studentCeiling;
    const capacityPercent = Math.min(100, Math.round((studentCount / Math.max(1, studentCeiling)) * 100));
    const totalPending = pendingVerificationsCount + pendingResultReviewsCount + pendingStaffLeavesCount;

    const shortcuts = [
      {
        href: `/${slug}/dashboard/students`,
        label: 'Enroll student',
        detail: 'Add or manage class rosters',
        icon: <UserPlus className="w-4 h-4" />,
        tile: 'bg-blue-50 text-blue-600 border-blue-100',
      },
      {
        href: `/${slug}/dashboard/fees`,
        label: 'Record school fee',
        detail: 'Offline receipts and balances',
        icon: <Receipt className="w-4 h-4" />,
        tile: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      },
      {
        href: `/${slug}/dashboard/results/entry`,
        label: 'Enter scores',
        detail: 'Continuous assessment and exams',
        icon: <FileSpreadsheet className="w-4 h-4" />,
        tile: 'bg-violet-50 text-violet-600 border-violet-100',
      },
      {
        href: `/${slug}/dashboard/results/report-cards`,
        label: 'Publish report cards',
        detail: 'Review and release term results',
        icon: <Award className="w-4 h-4" />,
        tile: 'bg-teal-50 text-teal-600 border-teal-100',
      },
      {
        href: `/${slug}/dashboard/sms`,
        label: 'Send SMS broadcast',
        detail: 'Notify parents and staff',
        icon: <MessageSquare className="w-4 h-4" />,
        tile: 'bg-amber-50 text-amber-600 border-amber-100',
      },
      {
        href: `/${slug}/dashboard/cbt`,
        label: 'Manage CBT exams',
        detail: 'Draft and schedule online tests',
        icon: <Laptop className="w-4 h-4" />,
        tile: 'bg-rose-50 text-rose-600 border-rose-100',
      },
    ];

    const kpis = [
      {
        label: 'Students enrolled',
        value: studentCount.toLocaleString(),
        sub: `${capacityPercent}% of ${studentCeiling.toLocaleString()} seat limit`,
        icon: <GraduationCap className="w-4 h-4" />,
        iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
        bar: 'bg-blue-500',
      },
      {
        label: 'Teaching & staff',
        value: staffCount.toLocaleString(),
        sub: 'Active directory',
        icon: <Users className="w-4 h-4" />,
        iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        bar: 'bg-emerald-500',
      },
      {
        label: 'Subjects',
        value: subjectCount.toLocaleString(),
        sub: 'Active curriculum',
        icon: <BookOpen className="w-4 h-4" />,
        iconBg: 'bg-violet-50 text-violet-600 border-violet-100',
        bar: 'bg-violet-500',
      },
      {
        label: 'CBT exams',
        value: cbtExamCount.toLocaleString(),
        sub: 'Online test banks',
        icon: <Laptop className="w-4 h-4" />,
        iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
        bar: 'bg-amber-500',
      },
      {
        label: 'SMS dispatched',
        value: smsLogCount.toLocaleString(),
        sub: 'Parent broadcasts',
        icon: <MessageSquare className="w-4 h-4" />,
        iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
        bar: 'bg-rose-500',
      },
    ];

    return (
      <div className="space-y-5">
        {/* School-Branded Hero Header */}
        <section
          className="relative overflow-hidden rounded-2xl p-6 text-white shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${dataHue} 0%, color-mix(in srgb, ${dataHue} 72%, #0f172a) 100%)`,
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white/95 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span>{currentSession?.label || 'No active session'}</span>
                {currentTerm && <span>· {currentTerm.name}</span>}
              </div>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.025em] text-white leading-tight">
                {tenant.name}
              </h1>
              <p className="mt-1 text-[13.5px] text-white/80">
                Welcome back, {userName} ·{' '}
                {totalPending > 0
                  ? `${totalPending} item${totalPending === 1 ? '' : 's'} awaiting approval`
                  : 'All review queues are clear'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <AddSessionModal
                slug={slug}
                triggerButtonText="New session"
                className="h-9 px-3.5 rounded-lg text-[13px] font-medium bg-white/15 border border-white/25 text-white hover:bg-white/25 transition-colors inline-flex items-center cursor-pointer backdrop-blur-xs"
              />
              <Link
                href={`/${slug}/dashboard/students`}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-white text-[#141518] hover:bg-white/90 shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Enroll student
              </Link>
            </div>
          </div>
        </section>

        {/* Colorful Semantic KPI Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              className={`relative overflow-hidden bg-white border border-[#e6e4de] rounded-xl p-4 shadow-[0_1px_2px_rgba(17,17,16,0.04)] hover:border-[#d2cfc7] transition-all ${
                i === 4 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${kpi.bar}`} />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12.5px] font-medium text-[#5a5b60]">{kpi.label}</p>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${kpi.iconBg}`}>
                  {kpi.icon}
                </span>
              </div>
              <p className="mt-2.5 text-[28px] font-semibold tracking-[-0.025em] text-[#141518] ws-tabular leading-none">
                {kpi.value}
              </p>
              <p className="mt-2 text-[11.5px] text-[#717278] ws-tabular truncate">{kpi.sub}</p>
            </div>
          ))}
        </section>

        {/* Main 2-Column Grid (2/3 + 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left 8 Cols: Shortcuts + Core Modules */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <section className="bg-white border border-[#e6e4de] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(17,17,16,0.04)]">
              <div className="px-5 py-3.5 border-b border-[#efede9] flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#141518]">Workspace actions</h2>
                <span className="text-[12px] text-[#717278]">Direct shortcuts</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-[#efede9]">
                {shortcuts.map((item, idx) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#faf9f6] transition-colors ${
                      idx >= 2 ? 'sm:border-t sm:border-[#efede9]' : ''
                    } ${idx % 2 === 1 ? 'sm:border-l sm:border-[#efede9]' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${item.tile}`}>
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-[#141518] truncate">{item.label}</p>
                        <p className="text-[12px] text-[#717278] truncate">{item.detail}</p>
                      </div>
                    </div>
                    <ArrowRight
                      className="w-4 h-4 text-[#98999f] group-hover:text-[#141518] group-hover:translate-x-0.5 transition-all shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="bg-white border border-[#e6e4de] rounded-xl p-5 flex flex-col justify-between gap-4 shadow-[0_1px_2px_rgba(17,17,16,0.04)]">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    <Users className="w-3 h-3" /> Directory
                  </span>
                  <h2 className="mt-2.5 text-[15px] font-semibold text-[#141518]">Academic roster</h2>
                  <p className="mt-1.5 text-[13px] text-[#5a5b60] leading-relaxed">
                    Manage academic sessions, student enrollments, staff assignments, and class allocations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/${slug}/dashboard/students`}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 inline-flex items-center transition-colors ws-tabular"
                  >
                    Students ({studentCount})
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/staff`}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 inline-flex items-center transition-colors ws-tabular"
                  >
                    Staff ({staffCount})
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/classes`}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-[#f2f0eb] hover:bg-[#e6e4de] text-[#141518] inline-flex items-center transition-colors"
                  >
                    Classes
                  </Link>
                </div>
              </div>

              <div className="bg-white border border-[#e6e4de] rounded-xl p-5 flex flex-col justify-between gap-4 shadow-[0_1px_2px_rgba(17,17,16,0.04)]">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                    <Award className="w-3 h-3" /> Assessments
                  </span>
                  <h2 className="mt-2.5 text-[15px] font-semibold text-[#141518]">Results &amp; broadsheets</h2>
                  <p className="mt-1.5 text-[13px] text-[#5a5b60] leading-relaxed">
                    Review compiled subject scores, generate printable report cards, and manage result checker PINs.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/${slug}/dashboard/results`}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 inline-flex items-center transition-colors"
                  >
                    Broadsheets
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/results/report-cards`}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-teal-50 hover:bg-teal-100 text-teal-700 inline-flex items-center transition-colors"
                  >
                    Report cards
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/results/pins`}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 inline-flex items-center transition-colors"
                  >
                    Result PINs
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* Right 4 Cols: Pending Approvals Queue & Enrollment Capacity */}
          <section className="lg:col-span-4 bg-white border border-[#e6e4de] rounded-xl flex flex-col justify-between shadow-[0_1px_2px_rgba(17,17,16,0.04)]">
            <div>
              <div className="px-5 py-3.5 border-b border-[#efede9] flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#141518]">Pending approvals</h2>
                <span className="rounded-full bg-[#f2f0eb] px-2.5 py-0.5 text-[11px] font-medium text-[#5a5b60]">
                  {currentTerm?.name || 'Current term'}
                </span>
              </div>

              <div className="divide-y divide-[#efede9]">
                <Link
                  href={`/${slug}/dashboard/fees/verifications`}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#faf9f6] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <Receipt className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[#141518] truncate">Fee verifications</p>
                      <p className="text-[11.5px] text-[#717278] truncate">Bank transfers awaiting sign-off</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[12px] font-semibold ws-tabular ${
                      pendingVerificationsCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {pendingVerificationsCount}
                  </span>
                </Link>

                <Link
                  href={`/${slug}/dashboard/results`}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#faf9f6] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <ClipboardCheck className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[#141518] truncate">Result reviews</p>
                      <p className="text-[11.5px] text-[#717278] truncate">Class sheets submitted for publishing</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[12px] font-semibold ws-tabular ${
                      pendingResultReviewsCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {pendingResultReviewsCount}
                  </span>
                </Link>

                {tenant.hasFeature('staff_attendance') && (
                  <Link
                    href={`/${slug}/dashboard/attendance/staff`}
                    className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#faf9f6] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                        <CalendarClock className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-[#141518] truncate">Staff leave requests</p>
                        <p className="text-[11.5px] text-[#717278] truncate">Time-off requests pending review</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[12px] font-semibold ws-tabular ${
                        pendingStaffLeavesCount > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {pendingStaffLeavesCount}
                    </span>
                  </Link>
                )}

                {totalPending === 0 && (
                  <div className="px-5 py-4 flex items-center gap-2.5 text-[12px] text-emerald-700 bg-emerald-50/40">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>All approval queues are up to date.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Enrollment Capacity Meter */}
            <div className="p-5 border-t border-[#efede9] bg-[#faf9f6]/60 space-y-2.5 rounded-b-xl">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-[#5a5b60]">Enrollment capacity</span>
                <span className="font-semibold text-[#141518] ws-tabular">
                  {studentCount.toLocaleString()} / {studentCeiling.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-[#e6e4de] h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(capacityPercent, studentCount > 0 ? 3 : 0)}%`,
                    backgroundColor:
                      capacityPercent > 90 ? '#e11d48' : dataHue,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[12px] pt-1">
                <span className="font-medium text-[#5a5b60]">{tenant.plan.name} plan</span>
                <Link
                  href={`/${slug}/dashboard/subscription`}
                  className="font-semibold underline underline-offset-4 hover:opacity-75"
                  style={{ color: dataHue }}
                >
                  Manage subscription
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TEACHER / STAFF DASHBOARD
  // ─────────────────────────────────────────────────────────────
  if (user.role === 'teacher') {
    let teachingAssignments: any[] = [];
    let formTeacherAssignment: any = null;
    let myStudentsCount = 0;
    let myCbtExamsCount = 0;

    if (user.staffId && currentSession) {
      [teachingAssignments, formTeacherAssignment] = await Promise.all([
        prisma.teachingAssignment.findMany({
          where: { sessionId: currentSession.id, staffId: user.staffId },
          include: { classLevel: true, subject: true },
        }).catch(() => []),
        prisma.formTeacherAssignment.findFirst({
          where: { sessionId: currentSession.id, staffId: user.staffId },
          include: { classLevel: true },
        }).catch(() => null),
      ]);

      const assignedClassIds = Array.from(
        new Set([
          ...(formTeacherAssignment ? [formTeacherAssignment.classLevelId] : []),
          ...teachingAssignments.map((ta: any) => ta.classLevelId),
        ])
      );

      if (assignedClassIds.length > 0) {
        myStudentsCount = await prisma.enrollment.count({
          where: {
            sessionId: currentSession.id,
            classLevelId: { in: assignedClassIds },
          },
        }).catch(() => 0);
      }

      const assignedSubjectIds = teachingAssignments.map((ta: any) => ta.subjectId);
      if (assignedSubjectIds.length > 0) {
        myCbtExamsCount = await prisma.cbtExam.count({
          where: {
            tenantId: tenant.id,
            subjectId: { in: assignedSubjectIds },
          },
        }).catch(() => 0);
      }
    }

    return (
      <div className="space-y-4">
        {/* Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              Teaching workspace
            </h1>
            <p className="mt-1 text-[14px] text-[#66645e]">
              {userName} · {currentSession?.label || 'No active session'}
              {currentTerm ? ` · ${currentTerm.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/${slug}/dashboard/attendance`}
              className="h-9 px-3.5 rounded-[6px] text-[13px] font-medium bg-white border border-[#d4d1ca] text-[#0a0a0a] hover:bg-[#eceae6] transition-colors inline-flex items-center"
            >
              Take attendance
            </Link>
            <Link
              href={`/${slug}/dashboard/results/entry`}
              className="h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#141414] text-white hover:bg-[#2a2a2a] transition-colors inline-flex items-center"
            >
              Enter scores
            </Link>
          </div>
        </div>

        {/* Teacher KPI Ledger Strip */}
        <section className="bg-white border border-[#e4e2dd] rounded-[8px] grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#e4e2dd]">
          <div className="p-5">
            <p className="text-[13px] text-[#66645e]">Form class</p>
            <p className="mt-2 text-[24px] font-normal tracking-[-0.02em] text-[#0a0a0a] leading-tight">
              {formTeacherAssignment ? formTeacherAssignment.classLevel.name : '—'}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">
              {formTeacherAssignment ? 'Assigned form teacher' : 'Subject teacher only'}
            </p>
          </div>
          <div className="p-5">
            <p className="text-[13px] text-[#66645e]">Assigned subjects</p>
            <p className="mt-2 text-[30px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-none">
              {teachingAssignments.length}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">Current term load</p>
          </div>
          <div className="p-5">
            <p className="text-[13px] text-[#66645e]">Students in classes</p>
            <p className="mt-2 text-[30px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-none">
              {myStudentsCount}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">Active enrollments</p>
          </div>
          <div className="p-5">
            <p className="text-[13px] text-[#66645e]">CBT test banks</p>
            <p className="mt-2 text-[30px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-none">
              {myCbtExamsCount}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">Linked to your subjects</p>
          </div>
        </section>

        {/* Teaching Allocations Table */}
        <section className="bg-white border border-[#e4e2dd] rounded-[8px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#efede9] flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Allocated teaching subjects</h2>
            <span className="text-[12px] text-[#66645e] ws-tabular">{teachingAssignments.length} total</span>
          </div>

          {teachingAssignments.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-[#66645e]">
              No teaching assignments registered for this session yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#efede9] text-[12px] font-medium text-[#66645e]">
                    <th className="py-3 px-5 font-medium">Subject</th>
                    <th className="py-3 px-5 font-medium">Class level</th>
                    <th className="py-3 px-5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efede9] text-[14px]">
                  {teachingAssignments.map((ta: any) => (
                    <tr key={ta.id} className="hover:bg-[#f9f8f6] transition-colors">
                      <td className="py-3 px-5 font-medium text-[#0a0a0a]">{ta.subject.name}</td>
                      <td className="py-3 px-5 text-[#4f4d48]">{ta.classLevel.name}</td>
                      <td className="py-3 px-5 text-right">
                        <Link
                          href={`/${slug}/dashboard/results/entry?subjectId=${ta.subject.id}&classLevelId=${ta.classLevel.id}`}
                          className="inline-flex items-center h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[#eceae6] hover:bg-[#141414] text-[#0a0a0a] hover:text-white transition-colors"
                        >
                          Enter scores
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. PARENT / GUARDIAN DASHBOARD (Fallback if accessed under /dashboard)
  // ─────────────────────────────────────────────────────────────
  if (user.role === 'parent') {
    const username = user.username.toLowerCase();
    const allStudents = await prisma.student.findMany({
      where: { tenantId: tenant.id },
      include: {
        enrollments: {
          where: currentSession ? { sessionId: currentSession.id } : {},
          include: { classLevel: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    }).catch(() => []);

    const linkedStudents = allStudents.filter((st: any) => {
      const g = st.guardianContactInfo as any;
      if (!g) return false;
      const email = (g.guardianEmail || g.email || '').toLowerCase();
      const phone = (g.guardianPhone || g.phone || '').toLowerCase();
      return (email && email === username) || (phone && phone === username);
    });

    const studentFeeData: Record<string, { balance: number; isPaid: boolean }> = {};
    if (currentTerm) {
      for (const st of linkedStudents) {
        try {
          const feeRes = await calculateStudentFeeBalance(tenant.id, st.id, currentTerm.id);
          studentFeeData[st.id] = {
            balance: Number(feeRes.balanceRemaining || 0),
            isPaid: feeRes.isFullyPaid,
          };
        } catch {
          studentFeeData[st.id] = { balance: 0, isPaid: true };
        }
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              Guardian overview
            </h1>
            <p className="mt-1 text-[14px] text-[#66645e]">
              {userName} · {linkedStudents.length} ward{linkedStudents.length === 1 ? '' : 's'} linked
            </p>
          </div>
          <Link
            href={`/${slug}/results/check`}
            className="h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#141414] text-white hover:bg-[#2a2a2a] transition-colors inline-flex items-center"
          >
            Check results
          </Link>
        </div>

        <section className="bg-white border border-[#e4e2dd] rounded-[8px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#efede9]">
            <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Linked students</h2>
          </div>

          {linkedStudents.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-[#66645e]">
              No enrolled student is currently linked to {user.username}. Contact the school office to link your account.
            </div>
          ) : (
            <div className="divide-y divide-[#efede9]">
              {linkedStudents.map((st: any) => {
                const enrollment = st.enrollments?.[0];
                const feeInfo = studentFeeData[st.id] || { balance: 0, isPaid: true };
                return (
                  <div key={st.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-medium text-[#0a0a0a]">{st.name}</p>
                      <p className="text-[12px] text-[#66645e]">
                        {enrollment?.classLevel?.name || 'Class unassigned'} · {currentSession?.label || 'Active session'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded text-[12px] font-medium ws-tabular ${
                          feeInfo.isPaid
                            ? 'bg-[#dcfae5] text-[#04250e]'
                            : 'bg-[#fffbeb] text-[#8f4f0e]'
                        }`}
                      >
                        {feeInfo.isPaid ? 'Fees cleared' : `Balance ${fmtMoney(feeInfo.balance)}`}
                      </span>
                      <Link
                        href={`/${slug}/results/check`}
                        className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[#eceae6] hover:bg-[#141414] text-[#0a0a0a] hover:text-white transition-colors inline-flex items-center"
                      >
                        Report card
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. STUDENT DASHBOARD (Fallback)
  // ─────────────────────────────────────────────────────────────
  const student = user.studentId
    ? await prisma.student.findUnique({
        where: { id: user.studentId },
        include: {
          enrollments: {
            where: currentSession ? { sessionId: currentSession.id } : {},
            include: { classLevel: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }).catch(() => null)
    : null;

  const currentClass = student?.enrollments?.[0]?.classLevel;

  const [availableCbtCount, formTeacherAssignment] = await Promise.all([
    currentClass
      ? prisma.cbtExam.count({
          where: {
            tenantId: tenant.id,
            classLevelId: currentClass.id,
            isPublished: true,
          },
        }).catch(() => 0)
      : Promise.resolve(0),
    currentClass && currentSession
      ? prisma.formTeacherAssignment.findFirst({
          where: {
            sessionId: currentSession.id,
            classLevelId: currentClass.id,
          },
          include: { staff: true },
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  let feeStatusText = 'Cleared';
  if (currentTerm && user.studentId) {
    try {
      const feeRes = await calculateStudentFeeBalance(tenant.id, user.studentId, currentTerm.id);
      if (!feeRes.isFullyPaid) {
        feeStatusText = `${fmtMoney(Number(feeRes.balanceRemaining || 0))} due`;
      }
    } catch {
      feeStatusText = 'Active';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
            Student overview
          </h1>
          <p className="mt-1 text-[14px] text-[#66645e]">
            {userName} · {currentClass?.name || 'Class unassigned'} · {currentTerm?.name || 'Active term'}
          </p>
        </div>
        <Link
          href={`/${slug}/results/check`}
          className="h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#141414] text-white hover:bg-[#2a2a2a] transition-colors inline-flex items-center"
        >
          Check report card
        </Link>
      </div>

      <section className="bg-white border border-[#e4e2dd] rounded-[8px] grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#e4e2dd]">
        <div className="p-5">
          <p className="text-[13px] text-[#66645e]">Class</p>
          <p className="mt-2 text-[24px] font-normal text-[#0a0a0a]">{currentClass?.name || '—'}</p>
          <p className="mt-2 text-[12px] text-[#66645e]">Form teacher: {formTeacherAssignment?.staff.name || 'Staff room'}</p>
        </div>
        <div className="p-5">
          <p className="text-[13px] text-[#66645e]">CBT exams ready</p>
          <p className="mt-2 text-[30px] font-normal text-[#0a0a0a] ws-tabular leading-none">{availableCbtCount}</p>
          <p className="mt-2 text-[12px] text-[#66645e]">Published assessments</p>
        </div>
        <div className="p-5">
          <p className="text-[13px] text-[#66645e]">Tuition status</p>
          <p className="mt-2 text-[22px] font-normal text-[#0a0a0a] ws-tabular">{feeStatusText}</p>
          <p className="mt-2 text-[12px] text-[#66645e]">Current term</p>
        </div>
        <div className="p-5">
          <p className="text-[13px] text-[#66645e]">Session</p>
          <p className="mt-2 text-[22px] font-normal text-[#0a0a0a]">{currentSession?.label || '—'}</p>
          <p className="mt-2 text-[12px] text-[#66645e]">{currentTerm?.name || 'In session'}</p>
        </div>
      </section>
    </div>
  );
}
