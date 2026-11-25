import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTermFeeOverview } from '@/lib/fees';
import { getTenantClassLevels } from '@/lib/class-levels';
import prisma from '@/lib/prisma';
import DashboardNav from '@/components/dashboard-nav';
import FeesAdminClient from './fees-admin-client';

interface FeesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FeesPage({ params }: FeesPageProps) {
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
  if (user.role !== 'school_admin') {
    redirect(`/${slug}/dashboard/fees/my-fees`);
  }

  const activeSession = tenant.currentSession;
  const activeTerm = activeSession?.currentTerm;

  const hasFeeFeature = tenant.hasFeature('school_fees');
  if (!hasFeeFeature) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <DashboardNav slug={slug} role={user.role} />
        <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-2xl mt-6">
          <div className="flex items-center space-x-3 text-amber-400 mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-2xl font-bold">School Fee Tracking Feature Locked</h2>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            The School Fees management ledger, automated term billing, online collections, and receipt reconciliation require the <strong className="text-white">Growth</strong> or <strong className="text-white">Enterprise</strong> plan tier.
          </p>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 font-mono space-y-1">
            <div>Active School Tier: <span className="text-blue-400 font-bold">{tenant.plan.name}</span></div>
            <div>Eligible Plans: <span className="text-emerald-400 font-bold">Growth or Enterprise Tier</span></div>
            <div className="text-slate-500 pt-1">Contact your Super Administrator or upgrade your subscription from the billing portal to enable fee tracking.</div>
          </div>
        </div>
      </div>
    );
  }

  const classLevels = await getTenantClassLevels(tenant.id, { filterLegacyByRange: true });
  const feeOverview = activeTerm ? await getTermFeeOverview(tenant.id, activeTerm.id) : null;

  // 1. Fetch all configured fee items for the active term
  const initialFeeItems = activeTerm
    ? await prisma.feeItem.findMany({
        where: { tenantId: tenant.id, termId: activeTerm.id },
        include: { classLevel: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  // 2. Count active student enrollments per class level for the current session
  const classEnrollmentCounts = activeSession
    ? await prisma.enrollment.groupBy({
        by: ['classLevelId'],
        where: {
          sessionId: activeSession.id,
          student: { tenantId: tenant.id },
          status: 'active',
        },
        _count: { studentId: true },
      })
    : [];

  const countMap: Record<string, number> = {};
  for (const c of classEnrollmentCounts) {
    countMap[c.classLevelId] = c._count.studentId;
  }

  const formattedClassLevels = classLevels.map((cl: any) => ({
    id: cl.id,
    name: cl.name,
    studentCount: countMap[cl.id] || 0,
  }));

  const formattedFeeItems = initialFeeItems.map((fi: any) => ({
    id: fi.id,
    name: fi.name,
    amount: Number(fi.amount),
    classLevelId: fi.classLevelId,
    classLevelName: fi.classLevel?.name || 'All Classes',
    createdAt: fi.createdAt.toISOString(),
  }));

  // 3. Fetch past terms that have configured fee items for the 1-click clone feature
  const pastTerms = activeTerm
    ? await prisma.term.findMany({
        where: {
          session: { tenantId: tenant.id },
          id: { not: activeTerm.id },
          feeItems: { some: {} },
        },
        include: {
          session: true,
          _count: { select: { feeItems: true } },
        },
        orderBy: { startDate: 'desc' },
      })
    : [];

  const formattedPastTerms = pastTerms.map((t: any) => ({
    id: t.id,
    name: t.name,
    sessionLabel: t.session.label,
    itemCount: t._count.feeItems,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <DashboardNav slug={slug} role={user.role} />
      <FeesAdminClient
        slug={slug}
        tenantName={tenant.name}
        activeTerm={activeTerm ? { id: activeTerm.id, name: activeTerm.name, sessionLabel: activeSession?.label || '' } : null}
        classLevels={formattedClassLevels}
        initialOverview={feeOverview}
        initialFeeItems={formattedFeeItems}
        bankDetails={{
          bankName: tenant.bankName ?? null,
          bankAccountNumber: tenant.bankAccountNumber ?? null,
          bankAccountName: tenant.bankAccountName ?? null,
        }}
        pastTerms={formattedPastTerms}
      />
    </div>
  );
}
