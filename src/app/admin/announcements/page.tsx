import React from 'react';
import { redirect } from 'next/navigation';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';
import { AnnouncementsClient } from './announcements-client';

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  const [setting, plans] = await Promise.all([
    prisma.platformSetting.findUnique({ where: { key: 'platformAnnouncementsJson' } }),
    prisma.plan.findMany({ select: { name: true }, orderBy: { price: 'asc' } }).catch(() => []),
  ]);

  let initialAnnouncements: any[] = [];
  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) initialAnnouncements = parsed;
    } catch {
      initialAnnouncements = [];
    }
  }

  return (
    <AnnouncementsClient
      initialAnnouncements={initialAnnouncements}
      planNames={plans.map((p) => p.name)}
    />
  );
}
