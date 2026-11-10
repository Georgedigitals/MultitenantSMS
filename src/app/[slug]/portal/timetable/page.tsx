import React from 'react';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getClassTimetable, getStudentTodaySchedule } from '@/lib/timetable';
import StudentTimetableClient from './student-timetable-client';

interface StudentTimetablePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ wardId?: string }>;
}

export default async function StudentTimetablePage({ params, searchParams }: StudentTimetablePageProps) {
  const { slug } = await params;
  const { wardId: paramWardId } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();
  if (!tenant.hasFeature('timetable')) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  const { user } = auth;
  const isParent = user.role === 'parent';

  let studentId = user.studentId;
  let wards: Array<{ id: string; name: string; classLevel: string }> = [];

  if (isParent) {
    const { getParentWardsForUser } = await import('@/lib/guardian');
    const parentData = await getParentWardsForUser(tenant.id, user);
    wards = parentData.wards;
    studentId = paramWardId && wards.some((w) => w.id === paramWardId)
      ? paramWardId
      : wards[0]?.id;
  }

  if (!studentId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-800">No Student Profile Linked</h1>
        <p className="text-sm text-slate-500 mt-2">
          Please contact your school administrator to link your account to a student enrollment.
        </p>
      </div>
    );
  }

  // Get active enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: { classLevel: true, student: true },
  });

  if (!enrollment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-800">Not Enrolled</h1>
        <p className="text-sm text-slate-500 mt-2">
          This student does not currently hold an active class enrollment for this school session.
        </p>
      </div>
    );
  }

  const [timetableData, todaySchedule] = await Promise.all([
    getClassTimetable(tenant.id, enrollment.classLevelId),
    getStudentTodaySchedule(tenant.id, studentId),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StudentTimetableClient
        slug={slug}
        schoolName={tenant.name}
        studentName={enrollment.student.name}
        className={enrollment.classLevel.name}
        isParent={isParent}
        wards={wards}
        currentWardId={studentId}
        timetableData={timetableData}
        todaySchedule={todaySchedule}
      />
    </div>
  );
}
