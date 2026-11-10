import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { listTenantBackups } from '@/lib/backup/disaster-recovery';
import BackupsClient from './backups-client';

interface BackupsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BackupsPage({ params }: BackupsPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  // Only school administrators can access disaster recovery & backups
  if (auth.user.role !== 'school_admin') {
    redirect('/dashboard');
  }

  const initialBackups = await listTenantBackups(tenant.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BackupsClient
        slug={slug}
        tenantName={tenant.name}
        initialBackups={initialBackups.map((b: any) => ({
          ...b,
          createdAt: b.createdAt.toISOString(),
          restoredAt: b.restoredAt ? b.restoredAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
