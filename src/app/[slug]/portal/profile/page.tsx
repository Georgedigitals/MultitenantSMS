import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import PortalProfileClient from './profile-client';

interface PortalProfilePageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalProfilePage({ params }: PortalProfilePageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  const { user } = auth;
  if (user.role === 'school_admin' || user.role === 'teacher') redirect(`/${slug}/dashboard`);

  const displayName = user.studentProfile?.name || user.staffProfile?.name || user.username;

  return (
    <PortalProfileClient
      slug={slug}
      username={user.username}
      displayName={displayName}
      role={user.role}
      primaryColor={tenant.branding.primaryColor || '#1E3A8A'}
      accentColor={tenant.branding.accentColor || '#2563EB'}
    />
  );
}
