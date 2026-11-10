import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { prisma } from '@/lib/prisma';
import { TenantUserRole } from '@prisma/client';
import Link from 'next/link';
import { AddSessionModal } from '@/components/add-session-modal';
import { calculateStudentFeeBalance } from '@/lib/fees';

interface TenantDashboardProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantDashboardPage({ params }: TenantDashboardProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

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

  const roleLabels: Record<TenantUserRole, string> = {
    school_admin: 'School Administrator',
    teacher: 'Staff / Teacher',
    parent: 'Parent / Guardian',
    student: 'Student',
  };

  // ─────────────────────────────────────────────────────────────
  // 1. SCHOOL ADMINISTRATOR DASHBOARD
  // ─────────────────────────────────────────────────────────────
  if (user.role === 'school_admin') {
    const studentCount = await prisma.student.count({ where: { tenantId: tenant.id } }).catch(() => 0);
    const staffCount = await prisma.staff.count({ where: { tenantId: tenant.id } }).catch(() => 0);
    const subjectCount = await prisma.subject.count({ where: { tenantId: tenant.id } }).catch(() => 0);
    const cbtExamCount = await prisma.cbtExam.count({ where: { tenantId: tenant.id } }).catch(() => 0);
    const smsLogCount = await prisma.smsLog.count({ where: { tenantId: tenant.id } }).catch(() => 0);

    // Operational Pulse metrics
    const pendingVerificationsCount = await prisma.feePaymentVerification.count({
      where: { tenantId: tenant.id, status: 'pending' },
    }).catch(() => 0);

    const pendingResultReviewsCount = currentTerm ? await prisma.classResultReview.count({
      where: {
        termId: currentTerm.id,
        submittedToAdminAt: { not: null },
      },
    }).catch(() => 0) : 0;

    const pendingStaffLeavesCount = tenant.hasFeature('staff_attendance') ? await prisma.staffLeaveRequest.count({
      where: { tenantId: tenant.id, status: 'pending' },
    }).catch(() => 0) : 0;

    const studentCeiling = tenant.plan.studentCeiling;
    const capacityPercent = Math.min(100, Math.round((studentCount / studentCeiling) * 100));

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Hero Welcome Card */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-8 text-white shadow-2xl border border-slate-800">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 backdrop-blur-md">
                  {roleLabels[user.role as keyof typeof roleLabels] || user.role}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-800/80 text-slate-300 border border-slate-700">
                  User ID: {user.username}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Welcome back, <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">{userName}</span>!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
                Academic Instance: <strong className="text-white">{tenant.name}</strong> • Active Session:{' '}
                <span className="text-emerald-400 font-semibold">{currentSession?.label || 'Not Set'}</span> ({currentTerm?.name || 'No Term'})
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <form action="/api/tenant/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition backdrop-blur-md shadow-sm cursor-pointer"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Real-time KPI Stats Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Students</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{studentCount}</div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Enrolled Records
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staff Roster</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{staffCount}</div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                Teachers &amp; Staff
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subjects</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{subjectCount}</div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                Active Curriculum
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CBT Exams</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{cbtExamCount}</div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Online Test Banks
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">SMS Alerts</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{smsLogCount}</div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                Dispatched Broadcasts
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Command Center */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Action Command Shortcuts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Link
              href="/dashboard/students"
              className="p-4 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Enroll Student</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Add to class roster</div>
            </Link>

            <Link
              href="/dashboard/fees"
              className="p-4 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Record Fee</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Offline receipt ledger</div>
            </Link>

            <Link
              href="/dashboard/sms"
              className="p-4 bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Dispatch SMS</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Instant parent alert</div>
            </Link>

            <Link
              href="/dashboard/whatsapp"
              className="p-4 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">WhatsApp Alert</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Report card delivery</div>
            </Link>

            <Link
              href="/dashboard/cbt"
              className="p-4 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Draft CBT Exam</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Create online test</div>
            </Link>

            <Link
              href="/dashboard/transport"
              className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Bus Transport</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Fleet &amp; bus roster</div>
            </Link>
          </div>
        </div>

        {/* Operational Workspace Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-bold text-slate-900">Operational Workspace Modules</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 font-bold">
                  01
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Academic &amp; Roster Management</h3>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Manage sessions, student enrollments, staff directory, and teaching assignments for {tenant.name}.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <Link
                    href="/dashboard/students"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Students ({studentCount})
                  </Link>
                  <Link
                    href="/dashboard/staff"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Staff ({staffCount})
                  </Link>
                  <AddSessionModal
                    slug={slug}
                    triggerButtonText="+ Academic Session"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition inline-flex items-center gap-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 font-bold">
                  02
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Results &amp; PIN Broadsheets</h3>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Review compiled subject scores, generate report cards, and issue result checker PINs.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/results"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition"
                  >
                    Broadsheets
                  </Link>
                  <Link
                    href="/dashboard/results/report-cards"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition"
                  >
                    Report Cards
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Pulse & Action Items */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  School Operations Pulse
                </h2>
                <span className="text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
                  {currentTerm?.name || 'Active Term'}
                </span>
              </div>

              {/* Action Items List */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Pending Approvals
                </div>

                <Link
                  href={`/${slug}/dashboard/fees/verifications`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/60 hover:border-emerald-200 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-950">Fee Verifications</p>
                      <p className="text-[10px] text-slate-500">Bank transfers awaiting sign-off</p>
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    pendingVerificationsCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/60 text-slate-600'
                  }`}>
                    {pendingVerificationsCount}
                  </span>
                </Link>

                <Link
                  href={`/${slug}/dashboard/results`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/60 hover:border-indigo-200 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-950">Result Reviews</p>
                      <p className="text-[10px] text-slate-500">Class results ready to publish</p>
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    pendingResultReviewsCount > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/60 text-slate-600'
                  }`}>
                    {pendingResultReviewsCount}
                  </span>
                </Link>

                {tenant.hasFeature('staff_attendance') && <Link
                  href={`/${slug}/dashboard/attendance/staff`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/60 hover:border-blue-200 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-950">Staff Leave Requests</p>
                      <p className="text-[10px] text-slate-500">Pending time-off requests</p>
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    pendingStaffLeavesCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-200/60 text-slate-600'
                  }`}>
                    {pendingStaffLeavesCount}
                  </span>
                </Link>}
              </div>
            </div>

            {/* Subscription & Enrollment Capacity Footer */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-500">Student Capacity ({capacityPercent}%)</span>
                <span className="font-bold text-slate-800">{studentCount} / {studentCeiling}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    capacityPercent > 90 ? 'bg-rose-500' : capacityPercent > 75 ? 'bg-amber-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center pt-1 text-[11px]">
                <span className="font-semibold text-slate-600">{tenant.plan.name} Tier</span>
                <Link
                  href={`/${slug}/dashboard/subscription`}
                  className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-0.5"
                >
                  Manage Plan &rarr;
                </Link>
              </div>
            </div>
          </div>
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
      teachingAssignments = await prisma.teachingAssignment.findMany({
        where: {
          sessionId: currentSession.id,
          staffId: user.staffId,
        },
        include: {
          classLevel: true,
          subject: true,
        },
      }).catch(() => []);

      formTeacherAssignment = await prisma.formTeacherAssignment.findFirst({
        where: {
          sessionId: currentSession.id,
          staffId: user.staffId,
        },
        include: {
          classLevel: true,
        },
      }).catch(() => null);

      const assignedClassIds = Array.from(new Set([
        ...(formTeacherAssignment ? [formTeacherAssignment.classLevelId] : []),
        ...teachingAssignments.map((ta: any) => ta.classLevelId),
      ]));

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-2xl border border-slate-800">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 backdrop-blur-md">
                  Academic Faculty &amp; Staff
                </span>
                {formTeacherAssignment && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Form Teacher: {formTeacherAssignment.classLevel.name}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Welcome back, <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">{userName}</span>!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
                {tenant.name} • Active Session:{' '}
                <span className="text-emerald-400 font-semibold">{currentSession?.label || 'Not Set'}</span> ({currentTerm?.name || 'No Term'})
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <form action="/api/tenant/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition backdrop-blur-md shadow-sm cursor-pointer"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Teacher KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Form Class</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xl font-extrabold text-slate-900 tracking-tight">
                {formTeacherAssignment ? formTeacherAssignment.classLevel.name : 'Unassigned'}
              </div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Form Master Role
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Subjects</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{teachingAssignments.length}</div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Current Term Load
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Students in Care</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{myStudentsCount}</div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                Enrolled in Classes
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CBT Tests</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{myCbtExamsCount}</div>
              <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                Subject Test Banks
              </span>
            </div>
          </div>
        </div>

        {/* Teacher Quick Action Shortcuts */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Teacher Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Link
              href={`/${slug}/dashboard/results/entry`}
              className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Enter Scores</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Submit CA &amp; exams</div>
            </Link>

            <Link
              href={`/${slug}/dashboard/attendance`}
              className="p-4 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Take Attendance</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Mark daily roll call</div>
            </Link>

            <Link
              href={`/${slug}/dashboard/assignments`}
              className="p-4 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">My Schedule</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Class allocations</div>
            </Link>

            <Link
              href={`/${slug}/dashboard/cbt`}
              className="p-4 bg-slate-50 hover:bg-purple-50/60 border border-slate-200/80 hover:border-purple-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Draft CBT Exam</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Create question banks</div>
            </Link>

            <Link
              href={`/${slug}/dashboard/messages`}
              className="p-4 bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-200 rounded-2xl text-left transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="text-xs font-bold text-slate-900">Messages</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Staff &amp; parents</div>
            </Link>
          </div>
        </div>

        {/* Teaching Allocations Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900">My Allocated Teaching Subjects ({teachingAssignments.length})</h2>
          {teachingAssignments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 font-mono">No teaching assignments registered for this session yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachingAssignments.map((ta: any) => (
                <div key={ta.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{ta.subject.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Class: <span className="font-semibold text-slate-700">{ta.classLevel.name}</span></p>
                  </div>
                  <Link
                    href={`/${slug}/dashboard/results/entry?subjectId=${ta.subject.id}&classLevelId=${ta.classLevel.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs"
                  >
                    Enter Scores
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. PARENT / GUARDIAN DASHBOARD
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

    // Compute fee balances for linked students
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-2xl border border-slate-800">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                  Parent / Guardian Portal
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-800/80 text-slate-300 border border-slate-700">
                  {linkedStudents.length} Wards Linked
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Welcome back, <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">{userName}</span>!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
                {tenant.name} • Monitor your children&apos;s academic report cards, fee billing, and school notices.
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <form action="/api/tenant/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition backdrop-blur-md shadow-sm cursor-pointer"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Linked Wards Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">My Linked Children / Wards</h2>

          {linkedStudents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-xl">
                
              </div>
              <h3 className="font-bold text-slate-900 text-base">No Linked Students Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                No enrolled student is currently registered with your guardian phone or email (<strong className="text-slate-700">{user.username}</strong>). Please contact the school administration to link your student profile.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {linkedStudents.map((st: any) => {
                const enrollment = st.enrollments?.[0];
                const feeInfo = studentFeeData[st.id] || { balance: 0, isPaid: true };
                return (
                  <div key={st.id} className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md transition-all space-y-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                        {st.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-slate-900 text-base leading-tight truncate">{st.name}</h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          ID: {st.id.slice(0, 8)} • {enrollment?.classLevel?.name || 'Class Unassigned'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-medium">Current Session:</span>
                        <span className="font-semibold text-slate-900">{currentSession?.label || 'Active'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-medium">Term Tuition Fees:</span>
                        {feeInfo.isPaid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Cleared / Fully Paid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Balance: ₦{feeInfo.balance.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href={`/${slug}/results/check`}
                        className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold text-center transition shadow-2xs"
                      >
                        Check Results
                      </Link>
                      <Link
                        href="/dashboard/fees/my-fees"
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold text-center transition"
                      >
                        Fee Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Parent Shortcuts */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Parent Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              href={`/${slug}/results/check`}
              className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-2xl text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-xs">
                
              </div>
              <div className="text-xs font-bold text-slate-900">Check Report Cards</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Terminal term grades</div>
            </Link>

            <Link
              href="/dashboard/fees/my-fees"
              className="p-4 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 rounded-2xl text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-xs">
                
              </div>
              <div className="text-xs font-bold text-slate-900">School Fees &amp; Invoices</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Receipts &amp; balance</div>
            </Link>

            <Link
              href="/dashboard/transport"
              className="p-4 bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-200 rounded-2xl text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-3 shadow-xs">
                
              </div>
              <div className="text-xs font-bold text-slate-900">Bus Transit Tracking</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Pickup &amp; routes</div>
            </Link>

            <Link
              href="/dashboard/messages"
              className="p-4 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-xs">
                
              </div>
              <div className="text-xs font-bold text-slate-900">School Messages</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Contact form teachers</div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. STUDENT DASHBOARD
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

  const availableCbtCount = currentClass
    ? await prisma.cbtExam.count({
        where: {
          tenantId: tenant.id,
          classLevelId: currentClass.id,
          isPublished: true,
        },
      }).catch(() => 0)
    : 0;

  const formTeacherAssignment = currentClass && currentSession
    ? await prisma.formTeacherAssignment.findFirst({
        where: {
          sessionId: currentSession.id,
          classLevelId: currentClass.id,
        },
        include: { staff: true },
      }).catch(() => null)
    : null;

  let feeStatusText = 'Fees Cleared';
  if (currentTerm && user.studentId) {
    try {
      const feeRes = await calculateStudentFeeBalance(tenant.id, user.studentId, currentTerm.id);
      if (!feeRes.isFullyPaid) {
        feeStatusText = `Pending ₦${Number(feeRes.balanceRemaining || 0).toLocaleString()}`;
      }
    } catch {
      feeStatusText = 'Fees Active';
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-2xl border border-slate-800">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 backdrop-blur-md">
                Student Learning Portal
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-800/80 text-slate-300 border border-slate-700">
                Class: {currentClass?.name || 'Class Unassigned'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Welcome back, <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">{userName}</span>!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
              {tenant.name} • Active Session:{' '}
              <span className="text-emerald-400 font-semibold">{currentSession?.label || 'Not Set'}</span> ({currentTerm?.name || 'No Term'})
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <form action="/api/tenant/auth/logout" method="POST">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition backdrop-blur-md shadow-sm cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Student Academic KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enrolled Class</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">{currentClass?.name || 'Unassigned'}</div>
            <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Form: {formTeacherAssignment?.staff.name || 'Staff Room'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CBT Exams</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{availableCbtCount}</div>
            <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Available Tests
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tuition Fees</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-extrabold text-slate-900 tracking-tight truncate">{feeStatusText}</div>
            <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              Current Term Status
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Academic Term</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">{currentTerm?.name || 'In Session'}</div>
            <span className="inline-flex items-center mt-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Active Evaluation
            </span>
          </div>
        </div>
      </div>

      {/* Student Action Command Center */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Student Quick Shortcuts
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href={`/${slug}/results/check`}
            className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-2xl text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-xs">
              
            </div>
            <div className="text-xs font-bold text-slate-900">Check Report Card</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Terminal grades &amp; scores</div>
          </Link>

          <Link
            href="/dashboard/cbt"
            className="p-4 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 rounded-2xl text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-xs">
              
            </div>
            <div className="text-xs font-bold text-slate-900">Online CBT Exams</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Take scheduled tests</div>
          </Link>

          <Link
            href="/dashboard/fees/my-fees"
            className="p-4 bg-slate-50 hover:bg-purple-50/60 border border-slate-200/80 hover:border-purple-200 rounded-2xl text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 shadow-xs">
              
            </div>
            <div className="text-xs font-bold text-slate-900">Tuition Fees</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Payment receipts</div>
          </Link>

          <Link
            href="/dashboard/messages"
            className="p-4 bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-200 rounded-2xl text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-3 shadow-xs">
              
            </div>
            <div className="text-xs font-bold text-slate-900">Messages &amp; Q&amp;A</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Ask your teachers</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
