import React from 'react';
import { redirect } from 'next/navigation';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';
import { LeadsClient } from './leads-client';

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  const setting = await prisma.platformSetting.findUnique({
    where: { key: 'platformLeadsJson' },
  });

  let initialLeads: any[] = [];
  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) initialLeads = parsed;
    } catch {
      initialLeads = [];
    }
  }

  return <LeadsClient initialLeads={initialLeads} />;
}
