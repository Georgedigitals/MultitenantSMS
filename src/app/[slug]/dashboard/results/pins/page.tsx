import React from 'react';
import { redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getPlatformPinSettings } from '@/lib/platform-settings';
import { PinsManagerClient } from './pins-manager-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Result Checker PINs | School Portal',
};

export default async function TenantPinsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [tenant, pinSettings] = await Promise.all([
    getTenantContext({ slug }),
    getPlatformPinSettings(),
  ]);
  if (!tenant) {
    redirect('/login');
  }
  if (!tenant.hasFeature('result_pins')) redirect(`/${slug}/dashboard/subscription?feature=result_pins`);

  const auth = await getTenantUserFromCookies(tenant.id);
  const userRole = (auth as any)?.user?.role || (auth as any)?.role;
  if (!auth || userRole !== 'school_admin') {
    redirect(`/${slug}/dashboard`);
  }

  const effectiveInitialPrice = pinSettings.allowTenantPinPricing
    ? Number(tenant.pinPrice ?? pinSettings.basePinPrice)
    : pinSettings.basePinPrice;

  return (
    <PinsManagerClient
      slug={slug}
      schoolName={tenant.name}
      initialPinPrice={effectiveInitialPrice}
      basePinPrice={pinSettings.basePinPrice}
      minPinPrice={pinSettings.minPinPrice}
      allowTenantPinPricing={pinSettings.allowTenantPinPricing}
      maxUsesPerPin={pinSettings.maxUses}
    />
  );
}
