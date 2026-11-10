import { redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import TenantPaystackSettings from './tenant-paystack-settings';

export default async function TenantPaymentSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) redirect('/login');
  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') redirect(`/${slug}/dashboard`);
  return <TenantPaystackSettings slug={slug} schoolName={tenant.name} />;
}
