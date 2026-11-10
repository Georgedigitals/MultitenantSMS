import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { normalizeAttendanceDate } from '@/lib/staff-attendance';
import MyAttendanceClient from './my-attendance-client';

interface MyAttendancePageProps {
  params: Promise<{ slug: string }>;
}

export default async function MyAttendancePage({ params }: MyAttendancePageProps) {
  const { slug } = await params;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();
  if (!tenant.hasFeature('staff_attendance')) redirect(`/${slug}/dashboard/subscription?feature=staff_attendance`);

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  if (!auth.user.staffId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-800">Staff Profile Required</h1>
        <p className="text-sm text-slate-500 mt-2">
          Your account is not linked to a staff record. Please contact your school administrator.
        </p>
      </div>
    );
  }

  const staff = await prisma.staff.findFirst({
    where: { id: auth.user.staffId, tenantId: tenant.id },
  });

  if (!staff) notFound();

  const todayDate = normalizeAttendanceDate(new Date());

  // Today's attendance
  const todayRecord = await prisma.staffAttendance.findUnique({
    where: {
      staffId_date: {
        staffId: staff.id,
        date: todayDate,
      },
    },
  });

  // Recent 30 days attendance
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const history = await prisma.staffAttendance.findMany({
    where: {
      tenantId: tenant.id,
      staffId: staff.id,
      date: { gte: normalizeAttendanceDate(thirtyDaysAgo) },
    },
    orderBy: { date: 'desc' },
  });

  // Leave requests
  const leaveRequests = await prisma.staffLeaveRequest.findMany({
    where: {
      tenantId: tenant.id,
      staffId: staff.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <MyAttendanceClient
        slug={slug}
        staff={{
          id: staff.id,
          name: staff.name,
        }}
        todayRecord={
          todayRecord
            ? {
                status: todayRecord.status,
                clockInTime: todayRecord.clockInTime?.toISOString() || null,
                clockOutTime: todayRecord.clockOutTime?.toISOString() || null,
                minutesLate: todayRecord.minutesLate,
                method: todayRecord.method,
                notes: todayRecord.notes,
              }
            : null
        }
        history={history.map((h) => ({
          id: h.id,
          date: h.date.toISOString().split('T')[0],
          status: h.status,
          clockInTime: h.clockInTime?.toISOString() || null,
          clockOutTime: h.clockOutTime?.toISOString() || null,
          minutesLate: h.minutesLate,
          method: h.method,
        }))}
        leaveRequests={leaveRequests.map((l) => ({
          id: l.id,
          leaveType: l.leaveType,
          startDate: l.startDate.toISOString().split('T')[0],
          endDate: l.endDate.toISOString().split('T')[0],
          reason: l.reason,
          status: l.status,
          adminNotes: l.adminNotes,
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
