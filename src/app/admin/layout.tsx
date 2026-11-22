import React from 'react';
import { headers } from 'next/headers';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { getPublicSiteCmsConfig } from '@/lib/public-site-cms';
import { AdminThemeProvider } from '@/components/admin-theme-provider';
import { AdminShellFrame } from '@/components/admin-shell-frame';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const adminPathname = reqHeaders.get('x-admin-pathname');

  if (adminPathname === '/admin/login' || adminPathname === '/login') {
    return (
      <AdminThemeProvider>
        <div className="adm-shell min-h-screen flex flex-col font-sans">
          {children}
        </div>
      </AdminThemeProvider>
    );
  }

  const [auth, cmsConfig] = await Promise.all([
    getSuperAdminFromCookies(),
    getPublicSiteCmsConfig(),
  ]);

  if (!auth) {
    return (
      <AdminThemeProvider>
        <div className="adm-shell min-h-screen flex flex-col font-sans">
          {children}
        </div>
      </AdminThemeProvider>
    );
  }

  return (
    <AdminThemeProvider>
      <AdminShellFrame
        adminName={auth.superAdmin.name}
        adminEmail={auth.superAdmin.email}
        platformName={cmsConfig.brand.name}
        logoUrl={cmsConfig.brand.logoUrl}
        brandPrimaryColor={cmsConfig.brand.primaryColor}
        brandAccentColor={cmsConfig.brand.accentColor}
        adminThemePreset={cmsConfig.brand.adminThemePreset}
        adminAccentColor={cmsConfig.brand.adminAccentColor}
      >
        {children}
      </AdminShellFrame>
    </AdminThemeProvider>
  );
}
