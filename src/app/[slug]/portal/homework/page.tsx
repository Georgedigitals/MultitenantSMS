import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import PortalHomeworkClient from './portal-homework-client';

interface PortalHomeworkPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalHomeworkPage({ params }: PortalHomeworkPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  return <PortalHomeworkClient role={auth.user.role} />;
}
