import React from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { PlansClient } from './plans-client';
import { getAvailableFeatureCapabilities, isBuiltInFeatureKey } from '@/lib/feature-catalog';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Plan Tiers & Feature Matrix | Super Admin Plane',
};

export default async function AdminPlansPage() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  let plans: any[] = [];
  let features: any[] = [];

  try {
    const [plansData, featuresData] = await Promise.all([
      prisma.plan.findMany({
        include: {
          features: {
            include: { feature: true },
          },
          _count: {
            select: { tenants: true },
          },
        },
        orderBy: { price: 'asc' },
      }),
      prisma.feature.findMany({
        orderBy: { key: 'asc' },
      }),
    ]);

    plans = (plansData || []).map((p: any) => ({
      ...p,
      price: Number(p.price || 0),
      platformFeePercent: Number(p.platformFeePercent || 0),
    }));
    features = (featuresData || []).filter((feature: any) => isBuiltInFeatureKey(feature.key));
  } catch (err) {
    console.error('Error fetching admin plans page data:', err);
  }

  const availableCapabilities = getAvailableFeatureCapabilities(features.map((feature) => feature.key));
  return <PlansClient initialPlans={plans} initialFeatures={features} initialAvailableCapabilities={availableCapabilities} />;
}

