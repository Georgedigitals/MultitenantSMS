import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantClassLevels } from '@/lib/class-levels';
import HomeworkClient from './homework-client';

interface HomeworkPageProps {
  params: Promise<{ slug: string }>;
}

export default async function HomeworkPage({ params }: HomeworkPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) {
    redirect(`/${slug}/portal/homework`);
  }

  const [classLevels, subjects] = await Promise.all([
    getTenantClassLevels(tenant.id, { filterLegacyByRange: true }),
    prisma.subject.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const currentTermId = tenant.currentSession?.currentTerm?.id || null;

  return (
    <HomeworkClient
      role={auth.user.role}
      classLevels={classLevels.map((c) => ({ id: c.id, name: c.name }))}
      subjects={subjects}
      currentTermId={currentTermId}
    />
  );
}
