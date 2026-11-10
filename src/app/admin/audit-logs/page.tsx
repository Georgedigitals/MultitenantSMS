import React from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { AuditLogsClient } from './audit-logs-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Audit Logs & Security Compliance | Super Admin Control Plane',
};

export default async function AdminAuditLogsPage() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  let impersonationLogs: any[] = [];
  let resultAuditLogs: any[] = [];

  try {
    const [impLogsData, resAuditLogsData] = await Promise.all([
      prisma.impersonationLog.findMany({
        include: {
          superAdmin: { select: { name: true, email: true } },
          tenant: { select: { name: true, slug: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: 100,
      }),
      prisma.resultAuditLog.findMany({
        include: {
          tenant: { select: { name: true, slug: true } },
          user: {
            select: {
              username: true,
              role: true,
              staff: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    impersonationLogs = (impLogsData || []).map((l: any) => ({
      ...l,
      startedAt: l.startedAt.toISOString(),
      endedAt: l.endedAt ? l.endedAt.toISOString() : null,
    }));

    resultAuditLogs = (resAuditLogsData || []).map((l: any) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error('Error fetching audit logs:', err);
  }

  return (
    <AuditLogsClient
      impersonationLogs={impersonationLogs}
      resultAuditLogs={resultAuditLogs}
    />
  );
}
