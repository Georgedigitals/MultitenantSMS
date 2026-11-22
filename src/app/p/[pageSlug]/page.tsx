import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { buildCmsPageMetadata, getPublicSiteCmsConfig } from '@/lib/public-site-cms';
import { LandingClient } from '@/app/landing-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageSlug: string }>;
}) {
  const { pageSlug } = await params;
  const cmsConfig = await getPublicSiteCmsConfig();
  const customPage = (cmsConfig.customPages || []).find((cp) => cp.slug === pageSlug);
  return buildCmsPageMetadata(cmsConfig, pageSlug, customPage?.title);
}

export default async function CustomCmsPublicPage({
  params,
}: {
  params: Promise<{ pageSlug: string }>;
}) {
  const { pageSlug } = await params;

  const [cmsConfig, plans] = await Promise.all([
    getPublicSiteCmsConfig(),
    prisma.plan
      .findMany({
        include: { features: { include: { feature: true } } },
        orderBy: { price: 'asc' },
      })
      .catch(() => []),
  ]);

  const customPage = (cmsConfig.customPages || []).find(
    (cp) => cp.slug === pageSlug && cp.published
  );

  if (!customPage) {
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
    <LandingClient
      plans={formattedPlans}
      cmsConfig={cmsConfig}
      customBlocks={customPage.blocks}
    />
  );
}
