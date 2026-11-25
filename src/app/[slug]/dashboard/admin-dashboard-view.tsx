import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Globe,
  Receipt,
  Ticket,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { AddSessionModal } from '@/components/add-session-modal';

export interface MonthlyCashflowPoint {
  label: string;
  fees: number;
  pins: number;
  total: number;
}

export interface RecentTransactionItem {
  id: string;
  studentName: string;
  category: 'Tuition' | 'Result PIN';
  method: string;
  dateLabel: string;
  amountFormatted: string;
}

export interface OnboardingStep {
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

interface AdminDashboardViewProps {
  slug: string;
  tenantName: string;
  userName: string;
  sessionLabel: string;
  termName: string | null;
  primaryColor: string;
  accentColor: string;
  textOnPrimary: string;
  studentCount: number;
  studentCeiling: number;
  staffCount: number;
  termFeeCollectedFormatted: string;
  termFeeOutstandingFormatted: string;
  termFeeBilledFormatted: string;
  collectionPercent: number;
  pinRevenueFormatted: string;
  availablePinStock: number;
  sixMonthTotalFormatted: string;
  monthlyCashflow: MonthlyCashflowPoint[];
  recentTransactions: RecentTransactionItem[];
  pendingVerificationsCount: number;
  pendingResultReviewsCount: number;
  pendingStaffLeavesCount: number;
  hasStaffAttendanceFeature: boolean;
  onboardingSteps: OnboardingStep[];
}

export function AdminDashboardView({
  slug,
  tenantName,
  userName,
  sessionLabel,
  termName,
  primaryColor,
  accentColor,
  textOnPrimary,
  studentCount,
  studentCeiling,
  staffCount,
  termFeeCollectedFormatted,
  termFeeOutstandingFormatted,
  termFeeBilledFormatted,
  collectionPercent,
  pinRevenueFormatted,
  availablePinStock,
  sixMonthTotalFormatted,
  monthlyCashflow,
  recentTransactions,
  pendingVerificationsCount,
  pendingResultReviewsCount,
  pendingStaffLeavesCount,
  hasStaffAttendanceFeature,
  onboardingSteps,
}: AdminDashboardViewProps) {
  const totalPending =
    pendingVerificationsCount + pendingResultReviewsCount + pendingStaffLeavesCount;
  const completedOnboarding = onboardingSteps.filter((s) => s.done).length;
  const showOnboarding = completedOnboarding < onboardingSteps.length;
  const capacityPercent = Math.min(100, Math.round((studentCount / Math.max(1, studentCeiling)) * 100));

  const maxMonthly = Math.max(1, ...monthlyCashflow.map((m) => m.total));

  const quickActions = [
    {
      href: `/${slug}/dashboard/fees`,
      label: 'Record fee payment',
      detail: 'Log tuition & issue receipt',
      icon: <Receipt className="w-4 h-4" />,
    },
    {
      href: `/${slug}/dashboard/results/entry`,
      label: 'Enter term scores',
      detail: 'CA & examination marks',
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
    {
      href: `/${slug}/dashboard/results/report-cards`,
      label: 'Publish report cards',
      detail: 'Review & release results',
      icon: <Award className="w-4 h-4" />,
    },
    {
      href: `/${slug}/dashboard/website`,
      label: 'Customize school website',
      detail: 'Templates, photos & copy',
      icon: <Globe className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Calm Editorial Top Header (No Loud Gradient Box) */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[#6b6963]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{sessionLabel}</span>
            </span>
            {termName && (
              <>
                <span>·</span>
                <span>{termName}</span>
              </>
            )}
          </div>
          <h1 className="text-[24px] sm:text-[26px] font-semibold tracking-[-0.025em] text-[#141518] leading-tight">
            Welcome back, {userName}
          </h1>
          <p className="text-[13.5px] text-[#6b6963]">
            {tenantName} ·{' '}
            {totalPending > 0
              ? `${totalPending} item${totalPending === 1 ? '' : 's'} waiting for review`
              : 'All review queues are clear'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <AddSessionModal
            slug={slug}
            triggerButtonText="New session"
            className="h-9 px-3.5 rounded-lg text-[13px] font-medium bg-white border border-[#dcd9d0] text-[#141518] hover:bg-[#f5f3ee] transition-colors inline-flex items-center cursor-pointer"
          />
          <Link
            href={`/${slug}/dashboard/students`}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold shadow-xs transition-opacity hover:opacity-90 inline-flex items-center gap-1.5"
            style={{ backgroundColor: primaryColor, color: textOnPrimary }}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Enroll student</span>
          </Link>
        </div>
      </header>

      {/* Unified 4-Column Executive Financial & School Ledger (No Rainbow Top Stripes) */}
      <section className="bg-white border border-[#e6e4de] rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#efede8] shadow-[0_1px_2px_rgba(17,17,16,0.03)]">
        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-[#6b6963]">Term fees collected</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ws-tabular">
              {collectionPercent}%
            </span>
          </div>
          <p className="text-[26px] font-semibold tracking-[-0.025em] text-[#141518] ws-tabular leading-none">
            {termFeeCollectedFormatted}
          </p>
          <p className="text-[12px] text-[#7a7872] ws-tabular">
            of {termFeeBilledFormatted} billed
          </p>
        </div>

        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-[#6b6963]">Outstanding tuition</span>
            <Link
              href={`/${slug}/dashboard/fees`}
              className="text-[11.5px] font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              Ledger →
            </Link>
          </div>
          <p className="text-[26px] font-semibold tracking-[-0.025em] text-[#141518] ws-tabular leading-none">
            {termFeeOutstandingFormatted}
          </p>
          <p className="text-[12px] text-[#7a7872]">
            {pendingVerificationsCount > 0
              ? `${pendingVerificationsCount} transfer${pendingVerificationsCount === 1 ? '' : 's'} pending`
              : 'Unpaid term balance'}
          </p>
        </div>

        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-[#6b6963]">Result PIN revenue</span>
            <Link
              href={`/${slug}/dashboard/results/pins`}
              className="text-[11.5px] font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              PINs →
            </Link>
          </div>
          <p className="text-[26px] font-semibold tracking-[-0.025em] text-[#141518] ws-tabular leading-none">
            {pinRevenueFormatted}
          </p>
          <p className="text-[12px] text-[#7a7872] ws-tabular">
            {availablePinStock.toLocaleString()} scratch PINs in stock
          </p>
        </div>

        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-[#6b6963]">Active enrollment</span>
            <span className="text-[11px] font-medium text-[#7a7872] ws-tabular">
              {capacityPercent}% cap
            </span>
          </div>
          <p className="text-[26px] font-semibold tracking-[-0.025em] text-[#141518] ws-tabular leading-none">
            {studentCount.toLocaleString()}
            <span className="text-[15px] font-normal text-[#8c8982]">
              {' '}/ {studentCeiling.toLocaleString()}
            </span>
          </p>
          <p className="text-[12px] text-[#7a7872] ws-tabular">
            {staffCount.toLocaleString()} teaching &amp; admin staff
          </p>
        </div>
      </section>

      {/* Main 2-Column Executive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 8 Cols: Financial Overview + Recent Transactions */}
        <div className="lg:col-span-8 space-y-5">
          {/* Term Financial Overview & 6-Month Cashflow */}
          <section className="bg-white border border-[#e6e4de] rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(17,17,16,0.03)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[#141518]">Financial overview</h2>
                <p className="text-[12.5px] text-[#6b6963] mt-0.5">
                  6-month school cashflow across tuition fees and Result PIN sales
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#7a7872]">
                  6-month total
                </p>
                <p className="text-[18px] font-semibold text-[#141518] ws-tabular">
                  {sixMonthTotalFormatted}
                </p>
              </div>
            </div>

            {/* Term Collection Progress Bar */}
            <div className="p-4 rounded-xl bg-[#faf9f6] border border-[#efede8] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                <span className="font-medium text-[#3d3e42]">
                  {termName ? `${termName} tuition collection` : 'Current term tuition collection'}
                </span>
                <span className="font-semibold text-[#141518] ws-tabular">
                  {termFeeCollectedFormatted}{' '}
                  <span className="font-normal text-[#7a7872]">/ {termFeeBilledFormatted}</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#e8e5dc] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(collectionPercent, collectionPercent > 0 ? 2 : 0))}%`,
                    backgroundColor: primaryColor,
                  }}
                />
              </div>
            </div>

            {/* Clean 6-Month Cashflow Bar Chart */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[12px] text-[#6b6963]">
                <span>Monthly inflows</span>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                    <span>School fees</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: accentColor }} />
                    <span>Result PINs</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-3 pt-2 items-end h-36 border-b border-[#efede8] pb-2">
                {monthlyCashflow.map((m) => {
                  const totalPct = m.total > 0 ? Math.max(8, Math.round((m.total / maxMonthly) * 100)) : 4;
                  const pinShare = m.total > 0 ? Math.round((m.pins / m.total) * 100) : 0;
                  const feeShare = 100 - pinShare;
                  return (
                    <div key={m.label} className="h-full flex flex-col justify-end items-center gap-1.5 group">
                      <div
                        className="w-full max-w-[38px] rounded-t-md overflow-hidden flex flex-col justify-end transition-opacity group-hover:opacity-90"
                        style={{
                          height: `${totalPct}%`,
                          backgroundColor: m.total === 0 ? '#efede8' : 'transparent',
                        }}
                        title={`${m.label}: Fees ${m.fees.toLocaleString()} · PINs ${m.pins.toLocaleString()}`}
                      >
                        {m.total > 0 && pinShare > 0 && (
                          <div style={{ height: `${pinShare}%`, backgroundColor: accentColor }} />
                        )}
                        {m.total > 0 && feeShare > 0 && (
                          <div style={{ height: `${feeShare}%`, backgroundColor: primaryColor }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-6 gap-3 text-center text-[11px] font-medium text-[#7a7872]">
                {monthlyCashflow.map((m) => (
                  <span key={m.label}>{m.label}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Recent Transactions Ledger */}
          <section className="bg-white border border-[#e6e4de] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(17,17,16,0.03)]">
            <div className="px-5 py-4 border-b border-[#efede8] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[#141518]">Recent payments</h2>
                <p className="text-[12px] text-[#6b6963]">Latest tuition receipts and Result PIN orders</p>
              </div>
              <Link
                href={`/${slug}/dashboard/fees`}
                className="text-[12.5px] font-semibold inline-flex items-center gap-1 hover:underline shrink-0"
                style={{ color: primaryColor }}
              >
                <span>View full ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="px-5 py-10 text-center space-y-2">
                <Wallet className="w-6 h-6 mx-auto text-[#b8b4a8]" />
                <p className="text-[13.5px] font-medium text-[#141518]">No payments recorded yet</p>
                <p className="text-[12.5px] text-[#6b6963] max-w-sm mx-auto">
                  Record your first tuition payment or sell Result PINs to see live financial activity here.
                </p>
                <div className="pt-2">
                  <Link
                    href={`/${slug}/dashboard/fees`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-semibold border border-[#dcd9d0] hover:bg-[#faf9f6] text-[#141518] transition-colors"
                  >
                    <span>Open school fees</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#efede8]">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#faf9f6] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f2ec] text-[#4c4b46]">
                        {tx.category === 'Tuition' ? (
                          <Receipt className="w-4 h-4" />
                        ) : (
                          <Ticket className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-[#141518] truncate">
                          {tx.studentName}
                        </p>
                        <p className="text-[11.5px] text-[#7a7872] truncate">
                          {tx.category} · {tx.method} · {tx.dateLabel}
                        </p>
                      </div>
                    </div>
                    <span className="text-[13.5px] font-semibold text-[#141518] ws-tabular shrink-0">
                      {tx.amountFormatted}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 4 Cols: Needs Your Attention + Quiet Quick Actions + Compact Launch Checklist */}
        <div className="lg:col-span-4 space-y-5">
          {/* Needs Your Attention */}
          <section className="bg-white border border-[#e6e4de] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(17,17,16,0.03)]">
            <div className="px-5 py-3.5 border-b border-[#efede8] flex items-center justify-between">
              <h2 className="text-[14.5px] font-semibold text-[#141518]">Needs your attention</h2>
              <span className="text-[11.5px] font-medium text-[#6b6963] ws-tabular">
                {totalPending} open
              </span>
            </div>

            <div className="divide-y divide-[#efede8]">
              <Link
                href={`/${slug}/dashboard/fees/verifications`}
                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#faf9f6] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Receipt className="w-4 h-4 text-[#6b6963] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#141518] truncate">Fee verifications</p>
                    <p className="text-[11.5px] text-[#7a7872] truncate">Transfers awaiting sign-off</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11.5px] font-semibold ws-tabular ${
                    pendingVerificationsCount > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-[#f4f2ec] text-[#6b6963]'
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
                  <ClipboardCheck className="w-4 h-4 text-[#6b6963] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#141518] truncate">Result reviews</p>
                    <p className="text-[11.5px] text-[#7a7872] truncate">Sheets ready to publish</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11.5px] font-semibold ws-tabular ${
                    pendingResultReviewsCount > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-[#f4f2ec] text-[#6b6963]'
                  }`}
                >
                  {pendingResultReviewsCount}
                </span>
              </Link>

              {hasStaffAttendanceFeature && (
                <Link
                  href={`/${slug}/dashboard/attendance/staff`}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#faf9f6] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CalendarClock className="w-4 h-4 text-[#6b6963] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#141518] truncate">Staff leave</p>
                      <p className="text-[11.5px] text-[#7a7872] truncate">Requests pending review</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11.5px] font-semibold ws-tabular ${
                      pendingStaffLeavesCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-[#f4f2ec] text-[#6b6963]'
                    }`}
                  >
                    {pendingStaffLeavesCount}
                  </span>
                </Link>
              )}

              {totalPending === 0 && (
                <div className="px-5 py-3.5 flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50/40">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>All caught up for {termName || 'this term'}.</span>
                </div>
              )}
            </div>
          </section>

          {/* Quiet Quick Actions */}
          <section className="bg-white border border-[#e6e4de] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(17,17,16,0.03)]">
            <div className="px-5 py-3.5 border-b border-[#efede8]">
              <h2 className="text-[14.5px] font-semibold text-[#141518]">Quick actions</h2>
            </div>
            <div className="divide-y divide-[#efede8]">
              {quickActions.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#faf9f6] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f2ec] text-[#3d3e42] group-hover:text-[#141518]">
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#141518] truncate">{item.label}</p>
                      <p className="text-[11.5px] text-[#7a7872] truncate">{item.detail}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#98968e] group-hover:text-[#141518] group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          </section>

          {/* Compact Launch Checklist (auto-hides once complete) */}
          {showOnboarding && (
            <section className="bg-white border border-[#e6e4de] rounded-2xl p-5 shadow-[0_1px_2px_rgba(17,17,16,0.03)] space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-semibold text-[#141518]">Setup progress</h2>
                <span className="text-[11.5px] font-semibold text-[#6b6963] ws-tabular">
                  {completedOnboarding}/{onboardingSteps.length}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#efede8] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((completedOnboarding / onboardingSteps.length) * 100)}%`,
                    backgroundColor: primaryColor,
                  }}
                />
              </div>
              <ul className="space-y-2 pt-1">
                {onboardingSteps.map((step) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="flex items-center justify-between gap-2 text-[12.5px] py-1 hover:opacity-80"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${step.done ? 'text-emerald-600' : 'text-[#ccc8bc]'}`}
                        />
                        <span className={`truncate ${step.done ? 'text-[#7a7872] line-through' : 'text-[#141518] font-medium'}`}>
                          {step.label}
                        </span>
                      </span>
                      {!step.done && (
                        <span className="text-[11px] font-semibold shrink-0" style={{ color: primaryColor }}>
                          {step.cta}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
