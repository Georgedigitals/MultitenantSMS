import React from 'react';
import { redirect } from 'next/navigation';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform Settings | Super Admin Control Plane',
};

export default async function AdminSettingsPage() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  return (
    <SettingsClient
      superAdmin={{
        name: auth.superAdmin.name,
        email: auth.superAdmin.email,
      }}
    />
  );
}
