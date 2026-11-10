import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import KioskClient from './kiosk-client';

interface KioskPageProps {
  params: Promise<{ slug: string }>;
}

export default async function KioskPage({ params }: KioskPageProps) {
  const { slug } = await params;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();
  if (!tenant.hasFeature('staff_attendance')) redirect(`/${slug}/dashboard/subscription?feature=staff_attendance`);

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);
  if (auth.user.role !== 'school_admin') redirect(`/${slug}/dashboard`);

  return (
    <KioskClient
      slug={slug}
      schoolName={tenant.name}
      logoUrl={(tenant.branding as any)?.logoUrl || null}
      workStartTime={tenant.workStartTime || '07:30'}
      lateThresholdTime={tenant.lateThresholdTime || '07:45'}
    />
  );
}
