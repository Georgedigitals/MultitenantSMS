import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantAuditLogs } from '@/lib/audit';
import AuditLogsClient from './audit-logs-client';

interface AuditLogsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AuditLogsPage({ params }: AuditLogsPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  // Strict RBAC: Only school administrators can review tenant security & activity audit logs
  if (auth.user.role !== 'school_admin') {
    redirect('/dashboard');
  }

  // Preload first page of audit logs server-side
  const initialData = await getTenantAuditLogs(tenant.id, {
    page: 1,
    pageSize: 25,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AuditLogsClient
        slug={slug}
        tenantName={tenant.name}
        initialData={{
          logs: initialData.logs.map((log: any) => ({
            ...log,
            createdAt: log.createdAt.toISOString(),
          })),
          totalCount: initialData.totalCount,
          totalPages: initialData.totalPages,
          currentPage: initialData.currentPage,
        }}
      />
    </div>
  );
}
