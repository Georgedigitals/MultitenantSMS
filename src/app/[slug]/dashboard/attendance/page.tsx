import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import DashboardNav from '@/components/dashboard-nav';
import AttendanceClient from './attendance-client';
import { getClassAttendanceForDate } from '@/lib/attendance';

interface AttendancePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ classLevelId?: string; date?: string; termId?: string }>;
}

export default async function AttendancePage({ params, searchParams }: AttendancePageProps) {
  const { slug } = await params;
  const { classLevelId: paramClassId, date: paramDate, termId: paramTermId } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) redirect('/dashboard');

  const db = getTenantDb(tenant.id);

  // 1. Fetch current session and terms
  const currentSession = await db.academicSession.findFirst({
    where: { isCurrent: true },
  });

  const rawTerms = currentSession
    ? await db.term.findMany({
        where: { sessionId: currentSession.id },
        orderBy: { startDate: 'asc' },
      })
    : [];

  const terms = rawTerms.map((t: any) => ({ id: t.id, name: t.name, totalDays: t.totalSchoolDays }));
  const selectedTerm = terms.find((t: any) => t.id === paramTermId) || terms[0];

  // 2. Class levels within tenant range
  const allClasses = await prisma.classLevel.findMany({ orderBy: { orderIndex: 'asc' } });
  const minOrder = tenant.lowestClassLevel?.orderIndex ?? 1;
  const maxOrder = tenant.highestClassLevel?.orderIndex ?? 15;
  const tenantClasses = allClasses.filter((c: any) => c.orderIndex >= minOrder && c.orderIndex <= maxOrder);

  // Form Teacher verification & class isolation
  let teacherFormAssignment: any = null;
  if (auth.user.role === 'teacher') {
    if (auth.user.staffId && currentSession) {
      teacherFormAssignment = await prisma.formTeacherAssignment.findFirst({
        where: { staffId: auth.user.staffId, sessionId: currentSession.id },
        include: { classLevel: true },
      });
    }

    // Non-form teachers are forbidden from marking attendance
    if (!teacherFormAssignment) {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav slug={slug} role={auth.user.role} />
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center max-w-xl mx-auto mt-12">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Form Teacher Access Only</h2>
            <p className="text-sm text-slate-600 mb-6">
              Daily attendance marking is restricted to designated Form Teachers and School Administrators. You do not currently hold an active Form Teacher assignment for this session.
            </p>
            <div className="text-xs text-slate-400">
              If this is an error, please contact your School Administrator to assign you as a Form Teacher.
            </div>
          </div>
        </div>
      );
    }
  }

  // Scoped class list: Form teachers only see their own class; Admin sees all enabled classes
  const accessibleClasses = teacherFormAssignment
    ? [teacherFormAssignment.classLevel]
    : tenantClasses;

  const defaultClassId = teacherFormAssignment
    ? teacherFormAssignment.classLevelId
    : (paramClassId && tenantClasses.some((c: any) => c.id === paramClassId) ? paramClassId : tenantClasses[0]?.id);

  const todayStr = paramDate || new Date().toISOString().split('T')[0];

  let initialStudents: any[] = [];
  let isLocked = false;

  if (defaultClassId && selectedTerm) {
    initialStudents = await getClassAttendanceForDate(
      tenant.id,
      defaultClassId,
      selectedTerm.id,
      todayStr
    );

    // Check if published
    const pubCount = await prisma.resultEntry.count({
      where: {
        termId: selectedTerm.id,
        status: 'published',
      },
    });
    isLocked = pubCount > 0;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Attendance Register</h1>
          <p className="text-sm text-slate-500">
            {teacherFormAssignment
              ? `Form Teacher Register • ${teacherFormAssignment.classLevel.name}`
              : 'Mark daily roll-call and track term attendance percentage'}
          </p>
        </div>
      </div>

      <AttendanceClient
        slug={slug}
        terms={terms}
        currentTermId={selectedTerm?.id || ''}
        totalSchoolDays={selectedTerm?.totalDays ?? null}
        classes={accessibleClasses.map((c: any) => ({ id: c.id, name: c.name }))}
        selectedClassId={defaultClassId || ''}
        initialDate={todayStr}
        initialStudents={initialStudents}
        isLocked={isLocked}
      />
    </div>
  );
}
