import React from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { getPlatformFinancialOverview } from '@/lib/super-admin';
import { OverviewClient } from './overview-client';

export const dynamic = 'force-dynamic';

export default async function SuperAdminDashboard() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  let tenantCount = 0;
  let studentCount = 0;
  let staffCount = 0;
  let financials: any = {
    platformRevenue: { subscriptionRevenue: 0, pinRevenue: 0, totalPlatformRevenue: 0 },
    tenantFinancials: [],
  };
  let impersonationLogs: any[] = [];
  let recentTenants: any[] = [];

  try {
    tenantCount = await prisma.tenant.count();
    studentCount = await prisma.student.count();
    staffCount = await prisma.staff.count();
    financials = await getPlatformFinancialOverview();

    recentTenants = await prisma.tenant.findMany({
      include: {
        plan: true,
        _count: { select: { students: true, staff: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    impersonationLogs = await prisma.impersonationLog.findMany({
      include: {
        superAdmin: { select: { name: true, email: true } },
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  } catch (err) {
    console.error('Error fetching admin dashboard overview data:', err);
  }

  const formattedLogs = impersonationLogs.map((log) => ({
    id: log.id,
    reason: log.reason,
    startedAt: log.startedAt ? log.startedAt.toISOString() : new Date().toISOString(),
    endedAt: log.endedAt ? log.endedAt.toISOString() : null,
    superAdmin: log.superAdmin || { name: 'Super Admin', email: 'admin@platform.com' },
    tenant: log.tenant || { name: 'Tenant', slug: 'tenant' },
  }));

  const formattedTenants = recentTenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    planName: t.plan?.name || 'Growth',
    studentCount: t._count?.students || 0,
    staffCount: t._count?.staff || 0,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <OverviewClient
      financials={financials}
      tenantCount={tenantCount}
      studentCount={studentCount}
      staffCount={staffCount}
      recentTenants={formattedTenants}
      impersonationLogs={formattedLogs}
    />
  );
}
