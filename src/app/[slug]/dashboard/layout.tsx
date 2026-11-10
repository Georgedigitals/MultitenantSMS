import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { checkTrialAccess } from '@/lib/trial';
import TenantSidebar from '@/components/tenant-sidebar';
import TrialBanner from '@/components/trial-banner';

interface TenantDashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function TenantDashboardLayout({
  children,
  params,
}: TenantDashboardLayoutProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const requestPath = (await headers()).get('x-tenant-pathname') || '';
  const billingPath = '/dashboard/subscription';
  const trialAccess = checkTrialAccess(tenant);
  const auth = await getTenantUserFromCookies(tenant.id, undefined, { allowExpiredTrial: true });
  if (!auth) {
    redirect('/login');
  }

  const { user } = auth;

  if (!trialAccess.allowed && user.role !== 'school_admin') {
    return <main className="min-h-screen grid place-items-center bg-slate-950 p-8 text-center text-white"><div><h1 className="text-xl font-bold">This school’s trial has ended</h1><p className="mt-2 text-sm text-slate-300">Ask your school administrator to activate a subscription.</p></div></main>;
  }
  if (!trialAccess.allowed && requestPath !== billingPath) {
    redirect(`/${slug}${billingPath}?trial=expired`);
  }

  // Students and parents belong in the portal, not the admin dashboard
  if (user.role === 'student' || user.role === 'parent') {
    redirect(`/${slug}/portal`);
  }

  // Check if teacher is an active Form Teacher in the current session
  let isFormTeacher = false;
  if (user.role === 'teacher' && user.staffId && tenant.currentSession) {
    const ftCount = await prisma.formTeacherAssignment.count({
      where: { staffId: user.staffId, sessionId: tenant.currentSession.id },
    });
    isFormTeacher = ftCount > 0;
  }

  const userName = user.staffProfile?.name || user.studentProfile?.name || user.username;

  const enabledFeatures: Record<string, boolean> = {
    feature_cbt_exams: tenant.hasFeature('feature_cbt_exams'),
    school_fees: tenant.hasFeature('school_fees'),
    feature_bus_tracking: tenant.hasFeature('feature_bus_tracking'),
    feature_sms_alerts: tenant.hasFeature('feature_sms_alerts'),
    feature_whatsapp_alerts: tenant.hasFeature('feature_whatsapp_alerts'),
    grading_customization: tenant.hasFeature('grading_customization'),
    gallery: tenant.hasFeature('gallery'),
    id_cards: tenant.hasFeature('id_cards'),
    staff_attendance: tenant.hasFeature('staff_attendance'),
    timetable: tenant.hasFeature('timetable'),
  };

  return (
    <TenantSidebar
      slug={slug}
      role={user.role}
      isFormTeacher={isFormTeacher}
      tenantName={tenant.name}
      logoUrl={tenant.branding.logoUrl}
      primaryColor={tenant.branding.primaryColor}
      accentColor={tenant.branding.accentColor}
      userName={userName}
      userEmail={user.username}
      userAvatarUrl={user.avatarUrl}
      enabledFeatures={enabledFeatures}
    >
      <TrialBanner
        slug={slug}
        status={tenant.status}
        trialEndsAt={tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null}
        planName={tenant.plan.name}
        userRole={user.role}
      />
      {children}
    </TenantSidebar>
  );
}
