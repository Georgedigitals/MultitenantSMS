import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { getPublicSiteCmsConfig, isValidCmsPageKey } from '@/lib/public-site-cms';
import prisma from '@/lib/prisma';
import { WebsiteBuilderClient } from '../../website-builder-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Visual Page Builder | Super Admin',
};

export default async function AdminWebsiteVisualEditorPage({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  const { pageKey } = await params;

  const [initialConfig, plans] = await Promise.all([
    getPublicSiteCmsConfig(),
    prisma.plan
      .findMany({
        include: { features: { include: { feature: true } } },
        orderBy: { price: 'asc' },
      })
      .catch(() => []),
  ]);

  const isCustomPage = (initialConfig.customPages || []).some((cp) => cp.slug === pageKey);
  if (!isValidCmsPageKey(pageKey) && !isCustomPage) {
    notFound();
  }

  const formattedPlans = plans.map((plan: any) => ({
    id: plan.id,
    name: plan.name,
    studentCeiling: plan.studentCeiling,
    price: Number(plan.price),
    pinRequired: plan.pinRequired,
    platformFeePercent: Number(plan.platformFeePercent),
    features: (plan.features || []).map((feature: any) => ({
      featureKey: feature.featureKey,
      enabledByDefault: feature.enabledByDefault,
      feature: feature.feature || {
        name: feature.featureKey.replace(/_/g, ' '),
        description: null,
      },
    })),
  }));

  return (
    <WebsiteBuilderClient
      initialConfig={initialConfig}
      initialPageKey={pageKey}
      plans={formattedPlans}
    />
  );
}
