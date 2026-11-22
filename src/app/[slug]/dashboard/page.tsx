import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { AddSessionModal } from '@/components/add-session-modal';
import { calculateStudentFeeBalance } from '@/lib/fees';
import { getPlatformLocalization } from '@/lib/platform-settings';

interface TenantDashboardProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantDashboardPage({ params }: TenantDashboardProps) {
  const { slug } = await params;
  const [tenant, localization] = await Promise.all([
    getTenantContext({ slug }),
    getPlatformLocalization(),
  ]);
  const currencySymbol = localization.currencySymbol;

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
      { href: `/${slug}/dashboard/students`, label: 'Enroll student', detail: 'Add or manage class rosters' },
      { href: `/${slug}/dashboard/fees`, label: 'Record school fee', detail: 'Offline receipts and balances' },
      { href: `/${slug}/dashboard/results/entry`, label: 'Enter scores', detail: 'Continuous assessment and exams' },
      { href: `/${slug}/dashboard/results/report-cards`, label: 'Publish report cards', detail: 'Review and release term results' },
      { href: `/${slug}/dashboard/sms`, label: 'Send SMS broadcast', detail: 'Notify parents and staff' },
      { href: `/${slug}/dashboard/cbt`, label: 'Manage CBT exams', detail: 'Draft and schedule online tests' },
    ];

    return (
      <div className="space-y-4">
        {/* Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              {tenant.name}
            </h1>
            <p className="mt-1 text-[14px] text-[#66645e]">
              {currentSession?.label || 'No active session'}
              {currentTerm ? ` · ${currentTerm.name}` : ''}
              {' · '}
              {totalPending > 0
                ? `${totalPending} item${totalPending === 1 ? '' : 's'} awaiting approval`
                : 'All review queues are clear'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <AddSessionModal
              slug={slug}
              triggerButtonText="New session"
              className="h-9 px-3.5 rounded-[6px] text-[13px] font-medium bg-white border border-[#d4d1ca] text-[#0a0a0a] hover:bg-[#eceae6] transition-colors inline-flex items-center cursor-pointer"
            />
            <Link
              href={`/${slug}/dashboard/students`}
              className="h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#141414] text-white hover:bg-[#2a2a2a] transition-colors inline-flex items-center"
            >
              Enroll student
            </Link>
          </div>
        </div>

        {/* Unified Achromatic KPI Ledger Strip */}
        <section className="bg-white border border-[#e4e2dd] rounded-[8px] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#e4e2dd]">
          <div className="p-5">
            <p className="text-[13px] text-[#66645e]">Students enrolled</p>
            <p className="mt-2 text-[30px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-none">
              {studentCount.toLocaleString()}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e] ws-tabular">
              {capacityPercent}% of {studentCeiling.toLocaleString()} seat limit
            </p>
          </div>

          <div className="p-5">
            <p className="text-[13px] text-[#66645e]">Teaching &amp; staff</p>
            <p className="mt-2 text-[30px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-none">
              {staffCount.toLocaleString()}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">Active directory</p>
          </div>

          <div className="p-5">
            <p className="text-[13px] text-[#66645e]">Subjects</p>
            <p className="mt-2 text-[30px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-none">
              {subjectCount.toLocaleString()}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">Active curriculum</p>
          </div>

          <div className="p-5">
            <p className="text-[13px] text-[#66645e]">CBT exams</p>
            <p className="mt-2 text-[30px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-none">
              {cbtExamCount.toLocaleString()}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">Online test banks</p>
          </div>

          <div className="p-5 col-span-2 sm:col-span-1">
            <p className="text-[13px] text-[#66645e]">SMS dispatched</p>
            <p className="mt-2 text-[30px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-none">
              {smsLogCount.toLocaleString()}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">Parent broadcasts</p>
          </div>
        </section>

        {/* Main 2-Column Ledger Grid (2/3 + 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* Left 8 Cols: Shortcuts + Core Modules */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <section className="bg-white border border-[#e4e2dd] rounded-[8px] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#efede9] flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Workspace actions</h2>
                <span className="text-[12px] text-[#66645e]">Direct shortcuts</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-[#efede9]">
                {shortcuts.map((item, idx) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#f9f8f6] transition-colors ${
                      idx >= 2 ? 'sm:border-t sm:border-[#efede9]' : ''
                    } ${idx % 2 === 1 ? 'sm:border-l sm:border-[#efede9]' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#0a0a0a] truncate">{item.label}</p>
                      <p className="text-[12px] text-[#66645e] truncate">{item.detail}</p>
                    </div>
                    <span className="text-[#66645e] text-sm shrink-0" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="bg-white border border-[#e4e2dd] rounded-[8px] grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#e4e2dd] flex-1">
              <div className="p-5 flex flex-col justify-between gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Academic roster</h2>
                  <p className="mt-1.5 text-[13px] text-[#66645e] leading-relaxed">
                    Manage academic sessions, student enrollments, staff assignments, and class allocations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/${slug}/dashboard/students`}
                    className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[#eceae6] hover:bg-[#e2dfd9] text-[#0a0a0a] inline-flex items-center transition-colors ws-tabular"
                  >
                    Students ({studentCount})
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/staff`}
                    className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[#eceae6] hover:bg-[#e2dfd9] text-[#0a0a0a] inline-flex items-center transition-colors ws-tabular"
                  >
                    Staff ({staffCount})
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/classes`}
                    className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[#eceae6] hover:bg-[#e2dfd9] text-[#0a0a0a] inline-flex items-center transition-colors"
                  >
                    Classes
                  </Link>
                </div>
              </div>

              <div className="p-5 flex flex-col justify-between gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Results &amp; broadsheets</h2>
                  <p className="mt-1.5 text-[13px] text-[#66645e] leading-relaxed">
                    Review compiled subject scores, generate printable report cards, and manage result checker PINs.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/${slug}/dashboard/results`}
                    className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[#eceae6] hover:bg-[#e2dfd9] text-[#0a0a0a] inline-flex items-center transition-colors"
                  >
                    Broadsheets
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/results/report-cards`}
                    className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[#eceae6] hover:bg-[#e2dfd9] text-[#0a0a0a] inline-flex items-center transition-colors"
                  >
                    Report cards
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/results/pins`}
                    className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[#eceae6] hover:bg-[#e2dfd9] text-[#0a0a0a] inline-flex items-center transition-colors"
                  >
                    Result PINs
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* Right 4 Cols: Pending Approvals Queue & Enrollment Capacity */}
          <section className="lg:col-span-4 bg-white border border-[#e4e2dd] rounded-[8px] flex flex-col justify-between">
            <div>
              <div className="px-5 py-3.5 border-b border-[#efede9] flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Pending approvals</h2>
                <span className="text-[12px] text-[#66645e]">{currentTerm?.name || 'Current term'}</span>
              </div>

              <div className="divide-y divide-[#efede9]">
                <Link
                  href={`/${slug}/dashboard/fees/verifications`}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#f9f8f6] transition-colors"
                >
                  <div>
                    <p className="text-[14px] font-medium text-[#0a0a0a]">Fee verifications</p>
                    <p className="text-[12px] text-[#66645e]">Bank transfers awaiting sign-off</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[12px] font-medium ws-tabular ${
                      pendingVerificationsCount > 0
                        ? 'bg-[#fffbeb] text-[#8f4f0e]'
                        : 'bg-[#eceae6] text-[#66645e]'
                    }`}
                  >
                    {pendingVerificationsCount}
                  </span>
                </Link>

                <Link
                  href={`/${slug}/dashboard/results`}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#f9f8f6] transition-colors"
                >
                  <div>
                    <p className="text-[14px] font-medium text-[#0a0a0a]">Result reviews</p>
                    <p className="text-[12px] text-[#66645e]">Class sheets submitted for publishing</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[12px] font-medium ws-tabular ${
                      pendingResultReviewsCount > 0
                        ? 'bg-[#fffbeb] text-[#8f4f0e]'
                        : 'bg-[#eceae6] text-[#66645e]'
                    }`}
                  >
                    {pendingResultReviewsCount}
                  </span>
                </Link>

                {tenant.hasFeature('staff_attendance') && (
                  <Link
                    href={`/${slug}/dashboard/attendance/staff`}
                    className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#f9f8f6] transition-colors"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-[#0a0a0a]">Staff leave requests</p>
                      <p className="text-[12px] text-[#66645e]">Time-off requests pending review</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[12px] font-medium ws-tabular ${
                        pendingStaffLeavesCount > 0
                          ? 'bg-[#fffbeb] text-[#8f4f0e]'
                          : 'bg-[#eceae6] text-[#66645e]'
                      }`}
                    >
                      {pendingStaffLeavesCount}
                    </span>
                  </Link>
                )}
              </div>
            </div>

            {/* Enrollment Capacity Meter (Single Data Hue) */}
            <div className="p-5 border-t border-[#efede9] space-y-2.5">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-[#66645e]">Enrollment capacity</span>
                <span className="font-medium text-[#0a0a0a] ws-tabular">
                  {studentCount.toLocaleString()} / {studentCeiling.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-[#eceae6] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full transition-[width]"
                  style={{
                    width: `${capacityPercent}%`,
                    backgroundColor:
                      capacityPercent > 90 ? '#b8292f' : dataHue,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[12px] pt-1">
                <span className="text-[#66645e]">{tenant.plan.name} plan</span>
                <Link
                  href={`/${slug}/dashboard/subscription`}
                  className="font-medium text-[#0a0a0a] underline underline-offset-4 hover:opacity-75"
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
                        {feeInfo.isPaid ? 'Fees cleared' : `Balance ${currencySymbol}${feeInfo.balance.toLocaleString()}`}
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
        feeStatusText = `${currencySymbol}${Number(feeRes.balanceRemaining || 0).toLocaleString()} due`;
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
