import React from 'react';
import { redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { VerificationsClient } from './verifications-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Fee Payment Verifications | Bursar Office',
};

export default async function FeeVerificationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) {
    redirect('/login');
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  const userRole = (auth as any)?.user?.role || (auth as any)?.role;
  if (!auth || (userRole !== 'school_admin' && userRole !== 'teacher')) {
    redirect(`/${slug}/dashboard`);
  }

  return <VerificationsClient slug={slug} schoolName={tenant.name} />;
}
