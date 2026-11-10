import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { getTenantFeatureMap } from '@/lib/features';
import TenantDetailClient from './tenant-detail-client';

export default async function SuperAdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  const { id: tenantId } = await params;

  const [tenant, plans, domains] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
      },
    }),
    prisma.plan.findMany({
      select: { id: true, name: true },
      orderBy: { price: 'asc' },
    }),
    prisma.domainAlias.findMany({
      where: { tenantId },
      select: { id: true, domain: true, verifiedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!tenant) {
    notFound();
  }

  const featureData = await getTenantFeatureMap(tenant.id);

  return (
    <TenantDetailClient
      tenant={{
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        planId: tenant.planId,
        planName: tenant.plan.name,
      }}
      plans={plans}
      initialFeatures={featureData.features}
      initialDomains={domains.map((alias) => ({
        id: alias.id,
        domain: alias.domain,
        verifiedAt: alias.verifiedAt?.toISOString() ?? null,
      }))}
    />
  );
}
