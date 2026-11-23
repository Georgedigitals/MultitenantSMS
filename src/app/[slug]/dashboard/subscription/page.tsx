import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getPlatformName } from '@/lib/platform-settings';
import prisma from '@/lib/prisma';
import SubscriptionClient from './subscription-client';

interface SubscriptionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SubscriptionPage({ params }: SubscriptionPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id, undefined, { allowExpiredTrial: true });
  if (!auth) {
    redirect('/login');
  }

  // Only school administrators can manage billing and subscription plans
  if (auth.user.role !== 'school_admin') {
    redirect('/dashboard');
  }

  // Fetch tenant details with current plan and features
  const tenantDetails = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    include: {
      plan: {
        include: {
          features: {
            include: {
              feature: true,
            },
          },
        },
      },
    },
  });

  if (!tenantDetails) {
    notFound();
  }

  // Count active students
  const studentCount = await prisma.student.count({
    where: { tenantId: tenant.id },
  }).catch(() => 0);

  // Fetch all active platform plans configured by SuperAdmin
  const allPlansRaw = await prisma.plan.findMany({
    include: {
      features: {
        include: {
          feature: true,
        },
      },
    },
    orderBy: { price: 'asc' },
  }).catch(() => []);

  // Fetch subscription payment history from audit logs
  const paymentHistoryRaw = await prisma.auditLog.findMany({
    where: {
      tenantId: tenant.id,
      action: 'SUBSCRIPTION_ACTIVATED',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  }).catch(() => []);

  // Format plans safely for client
  const allPlans = allPlansRaw.map((p: any) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    studentCeiling: p.studentCeiling,
    pinRequired: p.pinRequired,
    platformFeePercent: Number(p.platformFeePercent),
    features: (p.features || []).map((f: any) => ({
      key: f.featureKey,
      name: f.feature?.name || f.featureKey.replace(/_/g, ' '),
      description: f.feature?.description || null,
      enabledByDefault: f.enabledByDefault,
    })),
  }));

  const paymentHistory = paymentHistoryRaw.map((a: any) => ({
    id: a.id,
    action: a.action,
    actorName: a.actorName,
    details: a.details as any,
    createdAt: a.createdAt.toISOString(),
  }));

  const currentPlan = {
    id: tenantDetails.plan.id,
    name: tenantDetails.plan.name,
    price: Number(tenantDetails.plan.price),
    studentCeiling: tenantDetails.plan.studentCeiling,
    platformFeePercent: Number(tenantDetails.plan.platformFeePercent),
    features: (tenantDetails.plan.features || []).map((f: any) => ({
      key: f.featureKey,
      name: f.feature?.name || f.featureKey.replace(/_/g, ' '),
    })),
  };

  const platformName = await getPlatformName();

  return (
    <SubscriptionClient
      slug={slug}
      tenantId={tenant.id}
      tenantName={tenant.name}
      primaryColor={tenant.branding.primaryColor || '#4f46e5'}
      platformName={platformName}
      status={tenantDetails.status}
      trialEndsAt={tenantDetails.trialEndsAt ? tenantDetails.trialEndsAt.toISOString() : null}
      annualContractPrice={tenantDetails.annualContractPrice ? Number(tenantDetails.annualContractPrice) : Number(tenantDetails.plan.price)}
      subscriptionStartedAt={tenantDetails.subscriptionStartedAt ? tenantDetails.subscriptionStartedAt.toISOString() : null}
      subscriptionExpiresAt={tenantDetails.subscriptionExpiresAt ? tenantDetails.subscriptionExpiresAt.toISOString() : null}
      currentPlan={currentPlan}
      studentCount={studentCount}
      allPlans={allPlans}
      paymentHistory={paymentHistory}
      adminEmail={auth.user.username.includes('@') ? auth.user.username : `${slug}-admin@school.local`}
      adminName={auth.user.staffProfile?.name || 'School Administrator'}
    />
  );
}
