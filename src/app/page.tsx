import prisma from '@/lib/prisma';
import { LandingClient } from './landing-client';

export const dynamic = 'force-dynamic';

export default async function RootPlatformLanding() {
  let plans: any[] = [];

  try {
    plans = await prisma.plan.findMany({
      include: { features: { include: { feature: true } } },
      orderBy: { price: 'asc' },
    });
  } catch (err) {
    console.warn('[RootPlatformLanding] plans fetch warning:', err);
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

  return <LandingClient plans={formattedPlans} />;
}
