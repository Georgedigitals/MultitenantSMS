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

  const [adminStaffList, adminUserList] = await Promise.all([
    prisma.staff.findMany({
      where: { tenantId: tenant.id, roleBase: 'admin' },
      select: { contactInfo: true },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }),
    prisma.tenantUser.findMany({
      where: { tenantId: tenant.id, role: 'school_admin', isActive: true },
      select: { username: true },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }),
  ]);

  const validStaffEmail = adminStaffList
    .map((s) => (s.contactInfo as any)?.email)
    .find((e) => typeof e === 'string' && e.includes('@') && !e.endsWith('.internal'));
  const validAdminUsername = adminUserList
    .map((u) => u.username)
    .find((u) => typeof u === 'string' && u.includes('@') && !u.endsWith('.internal'));

  const initialTenantEmail =
    emailConfig?.replyTo ||
    (validStaffEmail ? validStaffEmail.trim() : '') ||
    (validAdminUsername ? validAdminUsername.trim() : '') ||
    (auth.user.username.includes('@') && !auth.user.username.endsWith('.internal') ? auth.user.username : '');

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
