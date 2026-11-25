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
import { AdminDashboardView } from './admin-dashboard-view';
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
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      studentCount,
      staffCount,
      subjectCount,
      siteContentCount,
      paymentGateway,
      pendingVerificationsCount,
      pendingResultReviewsCount,
      pendingStaffLeavesCount,
      termFeeAgg,
      termFeeItems,
      activeEnrollments,
      soldGenPins,
      activeDigitalPins,
      availablePinStock,
      recentFeePayments,
      recentSoldPins,
      sixMonthFeePayments,
      sixMonthSoldPins,
    ] = await Promise.all([
      prisma.student.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.staff.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.subject.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.siteContent.count({ where: { tenantId: tenant.id } }).catch(() => 0),
      prisma.tenantPaymentGateway.findUnique({ where: { tenantId: tenant.id }, select: { enabled: true } }).catch(() => null),
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
      prisma.feePayment.aggregate({
        where: {
          student: { tenantId: tenant.id },
          ...(currentTerm ? { termId: currentTerm.id } : {}),
        },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: null } })),
      currentTerm
        ? prisma.feeItem.findMany({
            where: { tenantId: tenant.id, termId: currentTerm.id },
            select: { amount: true, classLevelId: true },
          }).catch(() => [])
        : Promise.resolve([]),
      currentSession
        ? prisma.enrollment.findMany({
            where: { sessionId: currentSession.id, status: 'active', student: { tenantId: tenant.id } },
            select: { classLevelId: true },
          }).catch(() => [])
        : Promise.resolve([]),
      prisma.generatedPin.aggregate({
        where: { tenantId: tenant.id, soldAt: { not: null } },
        _sum: { pricePaid: true },
      }).catch(() => ({ _sum: { pricePaid: null } })),
      prisma.resultPIN.aggregate({
        where: { student: { tenantId: tenant.id }, status: 'active' },
        _sum: { pricePaid: true },
      }).catch(() => ({ _sum: { pricePaid: null } })),
      prisma.generatedPin.count({
        where: {
          tenantId: tenant.id,
          studentId: null,
          soldAt: null,
          isUsed: false,
          onlineSaleReference: null,
          batch: { status: 'completed' },
        },
      }).catch(() => 0),
      prisma.feePayment.findMany({
        where: { student: { tenantId: tenant.id } },
        include: { student: { select: { name: true } } },
        orderBy: { paidAt: 'desc' },
        take: 5,
      }).catch(() => []),
      prisma.generatedPin.findMany({
        where: { tenantId: tenant.id, soldAt: { not: null } },
        include: { student: { select: { name: true } } },
        orderBy: { soldAt: 'desc' },
        take: 5,
      }).catch(() => []),
      prisma.feePayment.findMany({
        where: { student: { tenantId: tenant.id }, paidAt: { gte: sixMonthsAgo } },
        select: { amount: true, paidAt: true },
      }).catch(() => []),
      prisma.generatedPin.findMany({
        where: { tenantId: tenant.id, soldAt: { gte: sixMonthsAgo } },
        select: { pricePaid: true, soldAt: true },
      }).catch(() => []),
    ]);

    // Compute term fee billed vs collected
    const termFeeCollected = Number(termFeeAgg._sum.amount || 0);
    const totalActiveEnrolled = activeEnrollments.length;
    const classCounts = new Map<string, number>();
    for (const enr of activeEnrollments) {
      if (enr.classLevelId) {
        classCounts.set(enr.classLevelId, (classCounts.get(enr.classLevelId) || 0) + 1);
      }
    }
    let termFeeBilled = 0;
    for (const item of termFeeItems) {
      const amt = Number(item.amount || 0);
      if (!item.classLevelId) {
        termFeeBilled += amt * totalActiveEnrolled;
      } else {
        termFeeBilled += amt * (classCounts.get(item.classLevelId) || 0);
      }
    }
    const termFeeOutstanding = Math.max(0, termFeeBilled - termFeeCollected);
    const collectionPercent =
      termFeeBilled > 0
        ? Math.min(100, Math.round((termFeeCollected / termFeeBilled) * 100))
        : termFeeCollected > 0
          ? 100
          : 0;

    const pinRevenue =
      Number(soldGenPins._sum.pricePaid || 0) + Number(activeDigitalPins._sum.pricePaid || 0);

    // Build 6-month cashflow buckets
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buckets: Array<{ year: number; month: number; label: string; fees: number; pins: number; total: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: monthNames[d.getMonth()],
        fees: 0,
        pins: 0,
        total: 0,
      });
    }
    for (const p of sixMonthFeePayments) {
      const d = new Date(p.paidAt);
      const b = buckets.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
      if (b) {
        const amt = Number(p.amount || 0);
        b.fees += amt;
        b.total += amt;
      }
    }
    for (const gp of sixMonthSoldPins) {
      if (!gp.soldAt) continue;
      const d = new Date(gp.soldAt);
      const b = buckets.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
      if (b) {
        const amt = Number(gp.pricePaid || 0);
        b.pins += amt;
        b.total += amt;
      }
    }
    const sixMonthTotal = buckets.reduce((acc, b) => acc + b.total, 0);

    // Merge recent 5 transactions
    const mergedTx = [
      ...recentFeePayments.map((fp) => ({
        id: `fee-${fp.id}`,
        studentName: fp.student?.name || 'Student',
        category: 'Tuition' as const,
        method: String(fp.method || 'cash').replace(/_/g, ' '),
        date: new Date(fp.paidAt),
        amountFormatted: fmtMoney(Number(fp.amount || 0)),
      })),
      ...recentSoldPins
        .filter((sp) => sp.soldAt)
        .map((sp) => ({
          id: `pin-${sp.id}`,
          studentName: sp.student?.name || 'Result PIN',
          category: 'Result PIN' as const,
          method: sp.onlineSaleReference ? 'Online' : 'Scratch card',
          date: new Date(sp.soldAt!),
          amountFormatted: fmtMoney(Number(sp.pricePaid || 0)),
        })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        studentName: item.studentName,
        category: item.category,
        method: item.method,
        dateLabel: item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amountFormatted: item.amountFormatted,
      }));

    const onboardingSteps = [
      {
        label: 'Academic session & term',
        done: Boolean(currentSession && currentTerm),
        href: `/${slug}/dashboard/classes`,
        cta: 'Configure',
      },
      {
        label: 'Subjects & teachers',
        done: subjectCount > 0 && staffCount > 0,
        href: subjectCount === 0 ? `/${slug}/dashboard/subjects` : `/${slug}/dashboard/staff`,
        cta: 'Set up',
      },
      {
        label: 'Enroll students',
        done: studentCount > 0,
        href: `/${slug}/dashboard/students`,
        cta: 'Add',
      },
      {
        label: 'Customize public website',
        done: siteContentCount > 0,
        href: `/${slug}/dashboard/website`,
        cta: 'Studio',
      },
      {
        label: 'Bank or online payments',
        done: Boolean(tenant.bankAccountNumber || paymentGateway?.enabled),
        href: `/${slug}/dashboard/settings/payments`,
        cta: 'Connect',
      },
    ];

    return (
      <AdminDashboardView
        slug={slug}
        tenantName={tenant.name}
        userName={userName}
        sessionLabel={currentSession?.label || 'No active session'}
        termName={currentTerm?.name || null}
        primaryColor={dataHue}
        accentColor={tenant.branding.accentColor || '#c8a45d'}
        textOnPrimary={(tenant.branding as any).textOnPrimary || '#FFFFFF'}
        studentCount={studentCount}
        studentCeiling={tenant.plan.studentCeiling}
        staffCount={staffCount}
        termFeeCollectedFormatted={fmtMoney(termFeeCollected)}
        termFeeOutstandingFormatted={fmtMoney(termFeeOutstanding)}
        termFeeBilledFormatted={fmtMoney(termFeeBilled)}
        collectionPercent={collectionPercent}
        pinRevenueFormatted={fmtMoney(pinRevenue)}
        availablePinStock={availablePinStock}
        sixMonthTotalFormatted={fmtMoney(sixMonthTotal)}
        monthlyCashflow={buckets.map(({ label, fees, pins, total }) => ({ label, fees, pins, total }))}
        recentTransactions={mergedTx}
        pendingVerificationsCount={pendingVerificationsCount}
        pendingResultReviewsCount={pendingResultReviewsCount}
        pendingStaffLeavesCount={pendingStaffLeavesCount}
        hasStaffAttendanceFeature={tenant.hasFeature('staff_attendance')}
        onboardingSteps={onboardingSteps}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TEACHER / STAFF DASHBOARD
  // ─────────────────────────────────────────────────────────────
  if (user.role === 'teacher') {
    let teachingAssignments: any[] = [];
    let formTeacherAssignments: any[] = [];
    let myStudentsCount = 0;
    let myCbtExamsCount = 0;

    if (user.staffId && currentSession) {
      [teachingAssignments, formTeacherAssignments] = await Promise.all([
        prisma.teachingAssignment.findMany({
          where: { sessionId: currentSession.id, staffId: user.staffId },
          include: { classLevel: true, subject: true },
        }).catch(() => []),
        prisma.formTeacherAssignment.findMany({
          where: { sessionId: currentSession.id, staffId: user.staffId },
          include: { classLevel: true },
          orderBy: { classLevel: { orderIndex: 'asc' } },
        }).catch(() => []),
      ]);

      const assignedClassIds = Array.from(
        new Set([
          ...formTeacherAssignments.map((fa: any) => fa.classLevelId),
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
            <p className="text-[13px] text-[#66645e]">
              {formTeacherAssignments.length > 1 ? 'Form classes' : 'Form class'}
            </p>
            <p className="mt-2 text-[22px] font-normal tracking-[-0.02em] text-[#0a0a0a] leading-tight">
              {formTeacherAssignments.length > 0
                ? formTeacherAssignments.map((fa: any) => fa.classLevel.name).join(', ')
                : '—'}
            </p>
            <p className="mt-2 text-[12px] text-[#66645e]">
              {formTeacherAssignments.length > 1
                ? `${formTeacherAssignments.length} assigned form classes`
                : formTeacherAssignments.length === 1
                ? 'Assigned form teacher'
                : 'Subject teacher only'}
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
