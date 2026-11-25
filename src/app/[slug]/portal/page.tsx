import React from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  Laptop,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
  const brandHue = tenant.branding.primaryColor || '#1d5fbf';

  let studentId = user.studentId;
  let studentName = user.studentProfile?.name || '';
  let currentClass = '';
  let resultCount = 0;

  let wards: Array<{ id: string; name: string; classLevel: string }> = [];

  if (isParent) {
    const { getParentWardsForUser } = await import('@/lib/guardian');
    const parentData = await getParentWardsForUser(tenant.id, user);
    wards = parentData.wards;
    if (currentTerm && parentData.studentIds.length > 0) {
      resultCount = await db.resultEntry
        .count({
          where: { studentId: { in: parentData.studentIds }, termId: currentTerm.id, status: 'published' },
        })
        .catch(() => 0);
    }
  } else if (studentId) {
    const enrollment = await db.enrollment
      .findFirst({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        include: { classLevel: true },
      })
      .catch(() => null);

    currentClass = (enrollment as any)?.classLevel?.name || '';

    if (currentTerm) {
      resultCount = await db.resultEntry
        .count({
          where: { studentId, termId: currentTerm.id, status: 'published' },
        })
        .catch(() => 0);
    }
  }

  let cbtExamCount = 0;
  if (tenant.hasFeature('feature_cbt_exams') && studentId) {
    const latestEnrollment = await db.enrollment
      .findFirst({
        where: { studentId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);

    if (latestEnrollment?.classLevelId) {
      cbtExamCount = await prisma.cbtExam
        .count({
          where: {
            tenantId: tenant.id,
            classLevelId: latestEnrollment.classLevelId,
            isPublished: true,
          },
        })
        .catch(() => 0);
    }
  }

  const portalDestinations = [
    {
      href: `/${slug}/portal/results`,
      label: 'Results & report cards',
      desc: 'Inspect termly subject scores, PIN status, and printable report cards.',
      meta: resultCount > 0 ? `${resultCount} published` : 'Term records',
      icon: <Award className="w-4 h-4" />,
      tile: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    ...(tenant.hasFeature('feature_cbt_exams')
      ? [
          {
            href: `/${slug}/portal/cbt`,
            label: 'CBT online exams',
            desc: 'Take timed assessments and review submitted test records.',
            meta: cbtExamCount > 0 ? `${cbtExamCount} open` : 'Assessments',
            icon: <Laptop className="w-4 h-4" />,
            tile: 'bg-violet-50 text-violet-700 border-violet-100',
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
            icon: <Receipt className="w-4 h-4" />,
            tile: 'bg-blue-50 text-blue-700 border-blue-100',
          },
        ]
      : []),
    {
      href: `/${slug}/portal/attendance`,
      label: 'Attendance register',
      desc: 'Track daily attendance history across the current term.',
      meta: 'Daily log',
      icon: <ClipboardCheck className="w-4 h-4" />,
      tile: 'bg-teal-50 text-teal-700 border-teal-100',
    },
    {
      href: `/${slug}/portal/timetable`,
      label: 'Class timetable',
      desc: 'Weekly period schedule and subject allocations.',
      meta: 'Schedule',
      icon: <CalendarClock className="w-4 h-4" />,
      tile: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    {
      href: `/${slug}/portal/profile`,
      label: 'Account & security',
      desc: 'Update your portal password and profile details.',
      meta: 'Settings',
      icon: <ShieldCheck className="w-4 h-4" />,
      tile: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  ];

  return (
    <div className="space-y-5">
      {/* School-Branded Portal Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${brandHue} 0%, color-mix(in srgb, ${brandHue} 72%, #0f172a) 100%)`,
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
              <span>{currentSession?.label || 'Active Session'}</span>
              {currentTerm && <span>· {currentTerm.name}</span>}
            </div>
            <h1 className="mt-3 text-[25px] font-semibold tracking-[-0.025em] text-white leading-tight">
              {isParent ? 'Parent Portal' : 'Student Portal'}
            </h1>
            <p className="mt-1 text-[13.5px] text-white/80">
              Welcome back, {isParent ? displayName || 'Guardian' : studentName || displayName}
              {currentClass ? ` · ${currentClass}` : ''} · {tenant.name}
            </p>
          </div>

          <Link
            href={`/${slug}/portal/results`}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-white text-[#141518] hover:bg-white/90 shadow-xs transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <Award className="w-3.5 h-3.5" />
            <span>View results</span>
          </Link>
        </div>
      </section>

      {/* Semantic KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="relative overflow-hidden bg-white border border-[#e6e4de] rounded-xl p-4 shadow-2xs">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500" />
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-medium text-[#5a5b60]">
              {isParent ? 'Registered wards' : 'Enrolled class'}
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-blue-50 text-blue-600 border-blue-100">
              {isParent ? <Users className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
            </span>
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#141518] ws-tabular">
            {isParent ? wards.length : currentClass || '—'}
          </p>
          <p className="mt-1 text-[12px] text-[#6d6a62]">{tenant.name}</p>
        </div>

        <div className="relative overflow-hidden bg-white border border-[#e6e4de] rounded-xl p-4 shadow-2xs">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-500" />
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-medium text-[#5a5b60]">Published scores</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-100">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#141518] ws-tabular">
            {resultCount}
          </p>
          <p className="mt-1 text-[12px] text-[#6d6a62]">{currentTerm?.name || 'Current term'}</p>
        </div>

        <div className="relative overflow-hidden bg-white border border-[#e6e4de] rounded-xl p-4 shadow-2xs">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-violet-500" />
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-medium text-[#5a5b60]">CBT exams open</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-violet-50 text-violet-600 border-violet-100">
              <Laptop className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#141518] ws-tabular">
            {cbtExamCount}
          </p>
          <p className="mt-1 text-[12px] text-[#6d6a62]">Published assessments</p>
        </div>
      </section>

      {/* Parent: Registered Wards */}
      {isParent && wards.length > 0 && (
        <section className="bg-white border border-[#e6e4de] rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-[#efede9] flex items-center justify-between">
            <h2 className="text-[14.5px] font-semibold text-[#141518]">Registered wards</h2>
            <span className="text-[12px] text-[#6d6a62] ws-tabular">{wards.length} linked</span>
          </div>
          <div className="divide-y divide-[#efede9]">
            {wards.map((ward) => (
              <div key={ward.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-semibold text-xs shrink-0"
                    style={{ backgroundColor: brandHue }}
                  >
                    {ward.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#141518] truncate">{ward.name}</p>
                    <p className="text-[12px] text-[#6d6a62] truncate">{ward.classLevel}</p>
                  </div>
                </div>
                <Link
                  href={`/${slug}/portal/results`}
                  className="text-[12.5px] font-semibold inline-flex items-center gap-1 hover:opacity-75 shrink-0"
                  style={{ color: brandHue }}
                >
                  <span>Open results</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Academic Records & Tools Grid */}
      <section className="bg-white border border-[#e6e4de] rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14.5px] font-semibold text-[#141518]">Academic records &amp; tools</h2>
          <span className="text-[12px] text-[#6d6a62]">Quick access</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {portalDestinations.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-[#e6e4de] hover:border-[#cfcbb8] bg-[#faf9f6] hover:bg-white p-4 transition-all flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${item.tile}`}>
                  {item.icon}
                </span>
                <span className="text-[11px] font-semibold text-[#6d6a62]">{item.meta}</span>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#141518] group-hover:opacity-80 flex items-center justify-between gap-2">
                  <span>{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#8a867e] group-hover:translate-x-0.5 transition-transform" />
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6d6a62]">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
