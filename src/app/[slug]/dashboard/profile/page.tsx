import React from 'react';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import StaffProfileClient from './profile-client';

export const dynamic = 'force-dynamic';

interface ProfilePageProps {
  params: Promise<{ slug: string }>;
}

export default async function DashboardProfilePage({ params }: ProfilePageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);
  if (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher') {
    redirect(`/${slug}/portal/profile`);
  }

  const staff = auth.user.staffId
    ? await prisma.staff.findFirst({
        where: { id: auth.user.staffId, tenantId: tenant.id },
        select: { name: true, contactInfo: true, signatureUrl: true },
      })
    : null;

  const info = (staff?.contactInfo as Record<string, any> | null) || {};

  return (
    <StaffProfileClient
      slug={slug}
      role={auth.user.role}
      primaryColor={tenant.branding.primaryColor || '#1D3251'}
      initialProfile={{
        name: staff?.name || auth.user.username,
        avatarUrl: typeof info.avatarUrl === 'string' ? info.avatarUrl : '',
        signatureUrl: staff?.signatureUrl || '',
        phone: typeof info.phone === 'string' ? info.phone : '',
        bloodGroup: typeof info.bloodGroup === 'string' ? info.bloodGroup : '',
        dob: typeof info.dob === 'string' ? info.dob : '',
        email: typeof info.email === 'string' ? info.email : '',
      }}
    />
  );
}
