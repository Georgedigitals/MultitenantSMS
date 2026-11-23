import React from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { getPlatformFinancialOverview } from '@/lib/super-admin';
import { getPlatformName } from '@/lib/platform-settings';
import { OverviewClient } from './overview-client';

export const dynamic = 'force-dynamic';

export default async function SuperAdminDashboard() {
  const [auth, platformName] = await Promise.all([
    getSuperAdminFromCookies(),
    getPlatformName(),
  ]);
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
  let healthAlerts: Array<{
    id: string;
    tenantName: string;
    slug: string;
    type: 'capacity' | 'trial' | 'suspended';
    message: string;
  }> = [];
  let growthSeries: Array<{ label: string; schools: number }> = [];

  try {
    tenantCount = await prisma.tenant.count();
    studentCount = await prisma.student.count();
    staffCount = await prisma.staff.count();
    financials = await getPlatformFinancialOverview();

    const allTenantsForHealth = await prisma.tenant.findMany({
      include: {
        plan: true,
        _count: { select: { students: true, staff: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    recentTenants = allTenantsForHealth.slice(0, 6);

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    for (const t of allTenantsForHealth) {
      const ceiling = t.plan?.studentCeiling || 0;
      const students = t._count?.students || 0;
      if (ceiling > 0 && students / ceiling >= 0.8) {
        const pct = Math.min(100, Math.round((students / ceiling) * 100));
        healthAlerts.push({
          id: `cap-${t.id}`,
          tenantName: t.name,
          slug: t.slug,
          type: 'capacity',
          message: `At ${pct}% student capacity (${students}/${ceiling} on ${t.plan?.name || 'current'} plan).`,
        });
      }
      if (t.status === 'trial' && t.trialEndsAt) {
        const msLeft = new Date(t.trialEndsAt).getTime() - now;
        if (msLeft <= sevenDaysMs) {
          const days = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
          healthAlerts.push({
            id: `trial-${t.id}`,
            tenantName: t.name,
            slug: t.slug,
            type: 'trial',
            message: days === 0 ? 'Trial has expired.' : `Trial expires in ${days} day${days === 1 ? '' : 's'}.`,
          });
        }
      }
      if (t.status === 'suspended') {
        healthAlerts.push({
          id: `susp-${t.id}`,
          tenantName: t.name,
          slug: t.slug,
          type: 'suspended',
          message: 'Account is currently suspended.',
        });
      }
    }
    healthAlerts = healthAlerts.slice(0, 8);

    // Build real 6-month cumulative tenant growth series from actual DB createdAt dates
    const nowDate = new Date();
    const months: Array<{ label: string; endTs: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const labelDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      months.push({
        label: labelDate.toLocaleDateString('en-US', { month: 'short' }),
        endTs: d.getTime(),
      });
    }
    const allCreatedDates = await prisma.tenant.findMany({ select: { createdAt: true } });
    growthSeries = months.map((m) => ({
      label: m.label,
      schools: allCreatedDates.filter((row) => row.createdAt.getTime() <= m.endTs).length,
    }));

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
      platformName={platformName}
      financials={financials}
      tenantCount={tenantCount}
      studentCount={studentCount}
      staffCount={staffCount}
      recentTenants={formattedTenants}
      impersonationLogs={formattedLogs}
      healthAlerts={healthAlerts}
      growthSeries={growthSeries}
    />
  );
}
