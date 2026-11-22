import prisma from '@/lib/prisma';
import { buildCmsPageMetadata, getPublicSiteCmsConfig } from '@/lib/public-site-cms';
import { LandingClient } from '@/app/landing-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const cmsConfig = await getPublicSiteCmsConfig();
  return buildCmsPageMetadata(cmsConfig, 'services', 'Platform & Services');
}

export default async function ServicesPage() {
  const [cmsConfig, plans] = await Promise.all([
    getPublicSiteCmsConfig(),
    prisma.plan
      .findMany({
        include: { features: { include: { feature: true } } },
        orderBy: { price: 'asc' },
      })
      .catch(() => []),
  ]);

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

  return <LandingClient plans={formattedPlans} cmsConfig={cmsConfig} pageKey="services" />;
}
