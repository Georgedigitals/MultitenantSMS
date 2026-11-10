import React from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { TenantsClient } from './tenants-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Schools & Tenants | Super Admin Plane',
};

export default async function AdminTenantsPage() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  let tenants: any[] = [];
  let plans: any[] = [];

  try {
    tenants = await prisma.tenant.findMany({
      include: {
        plan: true,
        featureOverrides: true,
        domainAliases: true,
        users: {
          where: { role: 'school_admin' },
          take: 1,
          select: { username: true },
        },
        _count: {
          select: {
            students: true,
            staff: true,
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
    });
  } catch (err) {
    console.error('Error fetching admin tenants page data:', err);
  }

  const formattedTenants = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    annualContractPrice: t.annualContractPrice ? Number(t.annualContractPrice) : Number(t.plan?.price || 0),
    subscriptionExpiresAt: t.subscriptionExpiresAt ? t.subscriptionExpiresAt.toISOString() : null,
    archivedAt: t.archivedAt ? t.archivedAt.toISOString() : null,
    adminEmail: t.users[0]?.username || 'N/A',
    domainAliases: (t.domainAliases || []).map((d: any) => ({
      id: d.id,
      domain: d.domain,
      verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
    })),
    plan: {
      id: t.plan?.id || 'plan_growth',
      name: t.plan?.name || 'Growth Tier',
      price: Number(t.plan?.price || 0),
    },
    featureOverrides: t.featureOverrides || [],
    _count: t._count || { students: 0, staff: 0, sessions: 0 },
  }));

  const formattedPlans = plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price || 0),
  }));

  return <TenantsClient initialTenants={formattedTenants} availablePlans={formattedPlans} />;
}
