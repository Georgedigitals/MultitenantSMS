import React from 'react';
import { redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { PinsManagerClient } from './pins-manager-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Result Checker Scratch Cards & PINs | School Portal',
};

export default async function TenantPinsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) {
    redirect('/login');
  }
  if (!tenant.hasFeature('result_pins')) redirect(`/${slug}/dashboard/subscription?feature=result_pins`);

  const auth = await getTenantUserFromCookies(tenant.id);
  const userRole = (auth as any)?.user?.role || (auth as any)?.role;
  if (!auth || userRole !== 'school_admin') {
    redirect(`/${slug}/dashboard`);
  }

  return (
    <PinsManagerClient
      slug={slug}
      schoolName={tenant.name}
      initialPinPrice={Number(tenant.pinPrice ?? 1000)}
    />
  );
}
