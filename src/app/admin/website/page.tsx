import React from 'react';
import { redirect } from 'next/navigation';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { getPublicSiteCmsConfig } from '@/lib/public-site-cms';
import { WebsiteStudioClient } from './website-studio-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Website Studio | Super Admin',
};

export default async function AdminWebsitePagesManager() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  const config = await getPublicSiteCmsConfig();
  return <WebsiteStudioClient initialConfig={config} />;
}
