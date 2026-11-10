import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getClassTimetable } from '@/lib/timetable';
import TimetableAdminClient from './timetable-client';

interface TimetablePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ classLevelId?: string }>;
}

export default async function TimetablePage({ params, searchParams }: TimetablePageProps) {
  const { slug } = await params;
  const { classLevelId: paramClassId } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();
  if (!tenant.hasFeature('timetable')) redirect(`/${slug}/dashboard/subscription?feature=timetable`);

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) redirect(`/${slug}/dashboard`);

  // Classes in tenant range
  const allClasses = await prisma.classLevel.findMany({ orderBy: { orderIndex: 'asc' } });
  const minOrder = tenant.lowestClassLevel?.orderIndex ?? 1;
  const maxOrder = tenant.highestClassLevel?.orderIndex ?? 15;
  const tenantClasses = allClasses.filter((c: any) => c.orderIndex >= minOrder && c.orderIndex <= maxOrder);

  const selectedClassId = paramClassId && tenantClasses.some((c) => c.id === paramClassId)
    ? paramClassId
    : tenantClasses[0]?.id;

  const initialData = selectedClassId
    ? await getClassTimetable(tenant.id, selectedClassId)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TimetableAdminClient
        slug={slug}
        tenantName={tenant.name}
        classes={tenantClasses.map((c) => ({ id: c.id, name: c.name }))}
        selectedClassId={selectedClassId}
        initialData={initialData}
        isAdmin={auth.user.role === 'school_admin'}
      />
    </div>
  );
}
