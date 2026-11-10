import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getDailyStaffAttendanceRoster } from '@/lib/staff-attendance';
import StaffAttendanceClient from './staff-attendance-client';

interface StaffAttendancePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}

export default async function StaffAttendancePage({ params, searchParams }: StaffAttendancePageProps) {
  const { slug } = await params;
  const { date: paramDate } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();
  if (!tenant.hasFeature('staff_attendance')) redirect(`/${slug}/dashboard/subscription?feature=staff_attendance`);

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);
  if (auth.user.role !== 'school_admin') redirect(`/${slug}/dashboard`);

  const todayStr = paramDate || new Date().toISOString().split('T')[0];
  const initialData = await getDailyStaffAttendanceRoster(tenant.id, todayStr);

  const pendingLeavesCount = await prisma.staffLeaveRequest.count({
    where: { tenantId: tenant.id, status: 'pending' },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StaffAttendanceClient
        slug={slug}
        tenantName={tenant.name}
        initialDate={todayStr}
        initialData={initialData}
        pendingLeavesCount={pendingLeavesCount}
        settings={{
          workStartTime: tenant.workStartTime || '07:30',
          lateThresholdTime: tenant.lateThresholdTime || '07:45',
          workEndTime: tenant.workEndTime || '15:30',
          campusLatitude: tenant.campusLatitude ?? null,
          campusLongitude: tenant.campusLongitude ?? null,
          campusRadiusMeters: tenant.campusRadiusMeters || 200,
          enableGeofenceAttendance: tenant.enableGeofenceAttendance ?? false,
        }}
      />
    </div>
  );
}
