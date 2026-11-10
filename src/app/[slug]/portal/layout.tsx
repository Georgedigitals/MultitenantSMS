import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import TenantSidebar from '@/components/tenant-sidebar';

interface PortalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function PortalLayout({ children, params }: PortalLayoutProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect(`/${slug}/login`);
  }

  const { user } = auth;

  // Staff who accidentally land here go to the correct dashboard
  if (user.role === 'school_admin' || user.role === 'teacher') {
    redirect(`/${slug}/dashboard`);
  }

  const userName = user.studentProfile?.name || user.staffProfile?.name || user.username;

  const enabledFeatures: Record<string, boolean> = {
    feature_cbt_exams: tenant.hasFeature('feature_cbt_exams'),
    school_fees: tenant.hasFeature('school_fees'),
    feature_bus_tracking: tenant.hasFeature('feature_bus_tracking'),
    feature_sms_alerts: tenant.hasFeature('feature_sms_alerts'),
    feature_whatsapp_alerts: tenant.hasFeature('feature_whatsapp_alerts'),
    grading_customization: tenant.hasFeature('grading_customization'),
    gallery: tenant.hasFeature('gallery'),
    timetable: tenant.hasFeature('timetable'),
  };

  return (
    <TenantSidebar
      slug={slug}
      role={user.role}
      tenantName={tenant.name}
      logoUrl={tenant.branding.logoUrl}
      primaryColor={tenant.branding.primaryColor}
      accentColor={tenant.branding.accentColor}
      userName={userName}
      userEmail={user.username}
      userAvatarUrl={user.avatarUrl}
      enabledFeatures={enabledFeatures}
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full print:p-0 print:m-0 print:max-w-none print:w-full">
        {children}
      </div>
    </TenantSidebar>
  );
}
