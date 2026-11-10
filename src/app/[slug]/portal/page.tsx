import React from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import prisma from '@/lib/prisma';

interface PortalPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalOverviewPage({ params }: PortalPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  const { user } = auth;
  if (user.role === 'school_admin' || user.role === 'teacher') redirect(`/${slug}/dashboard`);

  const db = getTenantDb(tenant.id);
  const isParent = user.role === 'parent';
  const displayName = user.studentProfile?.name || user.username;
  const currentSession = tenant.currentSession;
  const currentTerm = currentSession?.currentTerm;
  const primaryColor = tenant.branding.primaryColor || '#1E3A8A';
  const accentColor = tenant.branding.accentColor || '#2563EB';

  // ── Student data ────────────────────────────────────────────────
  let studentId = user.studentId;
  let studentName = user.studentProfile?.name || '';
  let currentClass = '';
  let resultCount = 0;
  let feeBalance: number | null = null;
  let attendancePct: number | null = null;

  // For parent: find linked wards
  let wards: Array<{ id: string; name: string; classLevel: string }> = [];

  if (isParent) {
    const { getParentWardsForUser } = await import('@/lib/guardian');
    const parentData = await getParentWardsForUser(tenant.id, user);
    wards = parentData.wards;
  } else if (studentId) {
    // Student: get their enrollment
    const enrollment = await db.enrollment.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: { classLevel: true },
    }).catch(() => null);

    currentClass = (enrollment as any)?.classLevel?.name || '';

    if (currentTerm) {
      resultCount = await db.resultEntry.count({
        where: { studentId, termId: currentTerm.id },
      }).catch(() => 0);
    }
  }

  let cbtExamCount = 0;
  if (tenant.hasFeature('feature_cbt_exams') && studentId) {
    const latestEnrollment = await db.enrollment.findFirst({
      where: { studentId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null);

    if (latestEnrollment?.classLevelId) {
      cbtExamCount = await prisma.cbtExam.count({
        where: {
          tenantId: tenant.id,
          classLevelId: latestEnrollment.classLevelId,
          isPublished: true,
        },
      }).catch(() => 0);
    }
  }

  const quickLinks = [
    {
      href: `/${slug}/portal/results`,
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      label: 'View Results',
      desc: 'Check term & annual report cards',
    },
    ...(tenant.hasFeature('feature_cbt_exams')
      ? [
          {
            href: `/${slug}/portal/cbt`,
            icon: (
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
            label: 'CBT Online Exams',
            desc: cbtExamCount > 0 ? `${cbtExamCount} Tests Available` : 'Timed tests & assessments',
          },
        ]
      : []),
    ...(tenant.hasFeature('school_fees')
      ? [
          {
            href: `/${slug}/portal/fees`,
            icon: (
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
            label: 'Fee Balance',
            desc: 'View payments and outstanding fees',
          },
        ]
      : []),
    {
      href: `/${slug}/portal/attendance`,
      icon: (
        <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      label: 'Attendance',
      desc: 'View attendance records',
    },
    {
      href: `/${slug}/portal/timetable`,
      icon: (
        <svg className="w-6 h-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Class Timetable',
      desc: 'Weekly period schedule & classes',
    },
    {
      href: `/${slug}/portal/profile`,
      icon: (
        <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      label: 'Change Password',
      desc: 'Update your login credentials',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)` }}
      >
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
            {isParent ? 'Parent / Guardian Portal' : 'Student Portal'}
          </p>
          <h1 className="text-2xl font-black tracking-tight mb-1">
            Welcome back, {isParent ? (displayName || 'Guardian') : studentName || displayName}!
          </h1>
          <p className="text-sm text-white/80 font-medium">
            {currentSession ? (
              <>
                {currentSession.label}
                {currentTerm ? ` • ${currentTerm.name}` : ''}
              </>
            ) : (
              'No active academic session'
            )}
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-4 top-16 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Parent: wards overview */}
      {isParent && wards.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Your Registered Wards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {wards.map((ward) => (
              <div key={ward.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-lg shrink-0">
                  {ward.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{ward.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{ward.classLevel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student info card */}
      {!isParent && studentName && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center font-black text-2xl text-white shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {studentName.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-black text-slate-900 text-lg">{studentName}</p>
            {currentClass && (
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Class: {currentClass}</p>
            )}
          </div>
          {resultCount > 0 && (
            <div className="text-right">
              <p className="text-2xl font-black text-blue-600">{resultCount}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Results This Term</p>
            </div>
          )}
          {cbtExamCount > 0 && (
            <div className="text-right pl-4 border-l border-slate-100">
              <p className="text-2xl font-black text-purple-600">{cbtExamCount}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CBT Tests Ready</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Action Cards */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-slate-300 transition-all duration-150"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                {link.icon}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{link.label}</p>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Portal info note */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-semibold">About This Portal</p>
          <p className="text-xs mt-0.5 text-blue-700">
            This is your personal school portal for {tenant.name}. Results are published by the school administrator after each term. Contact the school office for any discrepancies.
          </p>
        </div>
      </div>
    </div>
  );
}
