import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import prisma from '@/lib/prisma';
import { calculatePinFees } from '@/lib/pin';
import SettingsClient from './settings-client';

interface SettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  if (auth.user.role !== 'school_admin') {
    redirect('/dashboard');
  }

  // Load tenant with plan, class levels, and academic sessions
  const fullTenant = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    include: {
      plan: true,
      lowestClassLevel: true,
      highestClassLevel: true,
      sessions: {
        orderBy: { startDate: 'desc' },
        include: {
          terms: { orderBy: { startDate: 'asc' } },
        },
      },
    },
  });

  if (!fullTenant) {
    notFound();
  }

  const allClassLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  const pinFees = await calculatePinFees(fullTenant.id);

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <SettingsClient
        slug={slug}
        tenant={{
          id: fullTenant.id,
          slug: fullTenant.slug,
          name: fullTenant.name,
          status: fullTenant.status,
          trialEndsAt: fullTenant.trialEndsAt ? fullTenant.trialEndsAt.toISOString() : null,
          branding: (fullTenant.branding as any) || {},
          pinPrice: Number(fullTenant.pinPrice),
          admissionNumberPrefix: fullTenant.admissionNumberPrefix,
          blockPromotionOnFeeBalance: fullTenant.blockPromotionOnFeeBalance,
          blockResultOnFeeBalance: fullTenant.blockResultOnFeeBalance,
          bankName: fullTenant.bankName,
          bankAccountNumber: fullTenant.bankAccountNumber,
          bankAccountName: fullTenant.bankAccountName,
          hasOnlinePayment: fullTenant.hasOnlinePayment,
          lowestClassLevelId: fullTenant.lowestClassLevelId,
          highestClassLevelId: fullTenant.highestClassLevelId,
          plan: {
            name: fullTenant.plan.name,
            studentCeiling: fullTenant.plan.studentCeiling,
            pinRequired: fullTenant.plan.pinRequired,
          },
        }}
        sessions={fullTenant.sessions.map((s: any) => ({
          id: s.id,
          label: s.label,
          isCurrent: s.isCurrent,
          startDate: s.startDate.toISOString(),
          endDate: s.endDate.toISOString(),
          terms: s.terms.map((t: any) => ({
            id: t.id,
            name: t.name,
            isCurrent: t.isCurrent,
            totalSchoolDays: t.totalSchoolDays,
          })),
        }))}
        allClassLevels={allClassLevels.map((lvl: any) => ({
          id: lvl.id,
          name: lvl.name,
          orderIndex: lvl.orderIndex,
        }))}
        pinFees={pinFees as any}
      />
    </div>
  );
}
