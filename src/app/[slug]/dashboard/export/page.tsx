import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { ExportClient } from './export-client';

interface ExportPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DataExportPage({ params }: ExportPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  if (auth.user.role !== 'school_admin') {
    redirect('/dashboard');
  }

  return (
    <div className="p-6 md:p-8">
      <ExportClient slug={slug} tenantName={tenant.name} tenantId={tenant.id} />
    </div>
  );
}
