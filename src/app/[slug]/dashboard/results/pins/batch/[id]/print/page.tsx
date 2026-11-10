import React from 'react';
import { redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { BatchPrintClient } from './print-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Print WAEC-Style Scratch Cards | School BMS',
};

export default async function BatchPrintPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
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

  return <BatchPrintClient slug={slug} batchId={id} />;
}
