import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getStudentPromotionRoster, getPromotionEligibility } from '@/lib/promotion';
import prisma from '@/lib/prisma';
import DashboardNav from '@/components/dashboard-nav';
import PromotionClient from './promotion-client';

interface PromotionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PromotionPage({ params }: PromotionPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  const { user } = auth;
  if (user.role !== 'school_admin') {
    redirect(`/${slug}/dashboard`);
  }

  const sessions = await prisma.academicSession.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });

  const activeSession = tenant.currentSession || sessions[0] || null;

  const [eligibility, roster] = activeSession
    ? await Promise.all([
      getPromotionEligibility(tenant.id, activeSession.id),
      getStudentPromotionRoster(tenant.id, activeSession.id),
    ])
    : [null, null];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <DashboardNav slug={slug} role={user.role} />
      <PromotionClient
        slug={slug}
        tenantName={tenant.name}
        sessions={sessions.map((s: any) => ({ id: s.id, label: s.label, isCurrent: s.isCurrent }))}
        activeSessionId={activeSession?.id || ''}
        initialEligibility={eligibility}
        initialRoster={roster}
      />
    </div>
  );
}
