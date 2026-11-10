import React from 'react';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import DashboardNav from '@/components/dashboard-nav';
import IdCardsClient, { type IdCardRecord } from './id-cards-client';

interface IdCardsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function IdCardsPage({ params }: IdCardsPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);
  if (auth.user.role !== 'school_admin') redirect(`/${slug}/dashboard`);
  if (!tenant.hasFeature('id_cards')) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">ID cards aren’t included in this plan</h1>
        <p className="mt-3 text-slate-600">Contact your school administrator or BMS support to request access.</p>
      </main>
    );
  }

  const [staff, students] = await Promise.all([
    prisma.staff.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, roleBase: true, staffCode: true, contactInfo: true },
      orderBy: { name: 'asc' },
    }),
    prisma.student.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        admissionNumber: true,
        guardianContactInfo: true,
        enrollments: {
          where: tenant.currentSession?.id ? { sessionId: tenant.currentSession.id } : undefined,
          select: { classLevel: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const cards: IdCardRecord[] = [
    ...students.map((student: any) => {
      const profile = (student.guardianContactInfo as Record<string, any> | null) || {};
      return {
        id: student.id,
        kind: 'student' as const,
        name: student.name,
        identifier: student.admissionNumber || String(profile.admissionNo || student.id.slice(-8).toUpperCase()),
        subtitle: student.enrollments[0]?.classLevel?.name || 'Student',
        photoUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null,
        phone: typeof profile.phone === 'string' ? profile.phone : null,
        bloodGroup: typeof profile.bloodGroup === 'string' ? profile.bloodGroup : null,
        dob: typeof profile.dob === 'string' ? profile.dob : null,
        email: typeof profile.email === 'string' ? profile.email : null,
        qrPayload: student.admissionNumber || student.id,
      };
    }),
    ...staff.map((member: any) => {
      const profile = (member.contactInfo as Record<string, any> | null) || {};
      const staffCode = member.staffCode || `STF-${member.id.slice(-6).toUpperCase()}`;
      return {
        id: member.id,
        kind: 'staff' as const,
        name: member.name,
        identifier: staffCode,
        subtitle: member.roleBase === 'admin' ? 'School Administrator' : 'Staff / Tutor',
        photoUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null,
        phone: typeof profile.phone === 'string' ? profile.phone : null,
        bloodGroup: typeof profile.bloodGroup === 'string' ? profile.bloodGroup : null,
        dob: typeof profile.dob === 'string' ? profile.dob : null,
        email: typeof profile.email === 'string' ? profile.email : null,
        // Exact payload accepted by the Kiosk scanner for clocking in/out
        qrPayload: JSON.stringify({ staffId: member.id, staffCode, tenantSlug: slug }),
      };
    }),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="id-cards-screen-only"><DashboardNav slug={slug} role={auth.user.role} /></div>
      <IdCardsClient
        schoolName={tenant.name}
        schoolMotto={(tenant.branding as any)?.motto || null}
        logoUrl={tenant.branding.logoUrl || null}
        primaryColor={tenant.branding.primaryColor || '#1E3A8A'}
        accentColor={tenant.branding.accentColor || '#E11D48'}
        sessionLabel={tenant.currentSession?.label || 'Current Session'}
        cards={cards}
      />
    </div>
  );
}
