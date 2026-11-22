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

  let studentId = user.studentId;
  let studentName = user.studentProfile?.name || '';
  let currentClass = '';
  let resultCount = 0;

  let wards: Array<{ id: string; name: string; classLevel: string }> = [];

  if (isParent) {
    const { getParentWardsForUser } = await import('@/lib/guardian');
    const parentData = await getParentWardsForUser(tenant.id, user);
    wards = parentData.wards;
  } else if (studentId) {
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

  const portalDestinations = [
    {
      href: `/${slug}/portal/results`,
      label: 'Results & report cards',
      desc: 'Inspect termly subject scores and printable report cards.',
      meta: resultCount > 0 ? `${resultCount} entries` : 'Term records',
    },
    ...(tenant.hasFeature('feature_cbt_exams')
      ? [
          {
            href: `/${slug}/portal/cbt`,
            label: 'CBT online exams',
            desc: 'Take timed assessments and view submitted test records.',
            meta: cbtExamCount > 0 ? `${cbtExamCount} available` : 'Assessments',
          },
        ]
      : []),
    ...(tenant.hasFeature('school_fees')
      ? [
          {
            href: `/${slug}/portal/fees`,
            label: 'Tuition & fee ledger',
            desc: 'Review fee breakdowns, payment receipts, and balances.',
            meta: 'Billing',
          },
        ]
      : []),
    {
      href: `/${slug}/portal/attendance`,
      label: 'Attendance register',
      desc: 'Track daily attendance history across the current term.',
      meta: 'Daily log',
    },
    {
      href: `/${slug}/portal/timetable`,
      label: 'Class timetable',
      desc: 'Weekly period schedule and subject allocations.',
      meta: 'Schedule',
    },
    {
      href: `/${slug}/portal/profile`,
      label: 'Account & password',
      desc: 'Update your portal credentials and profile settings.',
      meta: 'Security',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
            {isParent ? 'Parent portal' : 'Student portal'}
          </h1>
          <p className="mt-1 text-[14px] text-[#66645e]">
            {isParent ? displayName || 'Guardian' : studentName || displayName}
            {currentClass ? ` · ${currentClass}` : ''}
            {currentSession ? ` · ${currentSession.label}` : ''}
            {currentTerm ? ` (${currentTerm.name})` : ''}
          </p>
        </div>

        <Link
          href={`/${slug}/portal/results`}
          className="h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#141414] text-white hover:bg-[#2a2a2a] transition-colors inline-flex items-center shrink-0"
        >
          View results
        </Link>
      </div>

      {/* Unified Summary Strip */}
      <section className="bg-white border border-[#e4e2dd] rounded-[8px] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#e4e2dd]">
        <div className="p-5">
          <p className="text-[13px] text-[#66645e]">{isParent ? 'Registered wards' : 'Enrolled class'}</p>
          <p className="mt-2 text-[26px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-tight">
            {isParent ? wards.length : currentClass || '—'}
          </p>
          <p className="mt-2 text-[12px] text-[#66645e]">{tenant.name}</p>
        </div>

        <div className="p-5">
          <p className="text-[13px] text-[#66645e]">Term results logged</p>
          <p className="mt-2 text-[26px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-tight">
            {resultCount}
          </p>
          <p className="mt-2 text-[12px] text-[#66645e]">{currentTerm?.name || 'Current term'}</p>
        </div>

        <div className="p-5">
          <p className="text-[13px] text-[#66645e]">CBT exams open</p>
          <p className="mt-2 text-[26px] font-normal tracking-[-0.02em] text-[#0a0a0a] ws-tabular leading-tight">
            {cbtExamCount}
          </p>
          <p className="mt-2 text-[12px] text-[#66645e]">Published assessments</p>
        </div>
      </section>

      {/* Parent: Wards Ledger */}
      {isParent && wards.length > 0 && (
        <section className="bg-white border border-[#e4e2dd] rounded-[8px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#efede9] flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Registered wards</h2>
            <span className="text-[12px] text-[#66645e] ws-tabular">{wards.length} linked</span>
          </div>
          <div className="divide-y divide-[#efede9]">
            {wards.map((ward) => (
              <div key={ward.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-[6px] bg-[#eceae6] text-[#0a0a0a] flex items-center justify-center font-medium text-xs shrink-0">
                    {ward.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#0a0a0a] truncate">{ward.name}</p>
                    <p className="text-[12px] text-[#66645e] truncate">{ward.classLevel}</p>
                  </div>
                </div>
                <Link
                  href={`/${slug}/portal/results`}
                  className="text-[12px] font-medium text-[#0a0a0a] underline underline-offset-4 hover:opacity-70 shrink-0"
                >
                  Open record
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Portal Directory Ledger */}
      <section className="bg-white border border-[#e4e2dd] rounded-[8px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#efede9] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Academic records &amp; tools</h2>
          <span className="text-[12px] text-[#66645e]">Select a section</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-[#efede9]">
          {portalDestinations.map((item, idx) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#f9f8f6] transition-colors ${
                idx >= 2 ? 'md:border-t md:border-[#efede9]' : ''
              } ${idx % 2 === 1 ? 'md:border-l md:border-[#efede9]' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[#0a0a0a]">{item.label}</p>
                <p className="mt-0.5 text-[12px] text-[#66645e]">{item.desc}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[12px] text-[#66645e] hidden sm:inline">{item.meta}</span>
                <span className="text-[#66645e]" aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
