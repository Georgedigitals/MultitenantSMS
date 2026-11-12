import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import prisma from '@/lib/prisma';
import EmailSettingsClient from './email-client';

interface EmailSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EmailSettingsPage({ params }: EmailSettingsPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  // Restrict email server configuration strictly to School Administrators
  if (auth.user.role !== 'school_admin') {
    redirect('/dashboard');
  }

  // Fetch tenant custom SMTP configuration if present
  const emailConfig = await prisma.emailConfiguration.findUnique({
    where: { tenantId: tenant.id },
  });

  const adminStaff = await prisma.staff.findFirst({
    where: { tenantId: tenant.id, roleBase: 'admin' },
    select: { contactInfo: true },
  });
  const staffEmail = (adminStaff?.contactInfo as any)?.email;
  const initialTenantEmail =
    emailConfig?.replyTo ||
    (typeof staffEmail === 'string' && staffEmail.includes('@') ? staffEmail.trim() : '') ||
    ((auth.user as any).email || auth.user.username);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <EmailSettingsClient
        slug={slug}
        tenantName={tenant.name}
        tenantEmail={initialTenantEmail}
        initialConfig={
          emailConfig
            ? {
                host: emailConfig.host,
                port: emailConfig.port,
                secure: emailConfig.secure,
                user: emailConfig.user,
                fromName: emailConfig.fromName || tenant.name,
                fromEmail: emailConfig.fromEmail || emailConfig.user,
                replyTo: emailConfig.replyTo || emailConfig.fromEmail || initialTenantEmail,
                verified: emailConfig.verified,
                updatedAt: emailConfig.updatedAt.toISOString(),
              }
            : null
        }
      />
    </div>
  );
}
