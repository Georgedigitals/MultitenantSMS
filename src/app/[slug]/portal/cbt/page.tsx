import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import prisma from '@/lib/prisma';
import { getTenantCurriculum, resolveStudentSubjectIds } from '@/lib/curriculum';
import CbtPortalClient, { StudentWithExams } from './cbt-portal-client';

interface PortalCbtPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalCbtPage({ params }: PortalCbtPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  const { user } = auth;
  // Staff belong in admin CBT dashboard
  if (user.role === 'school_admin' || user.role === 'teacher') {
    redirect(`/${slug}/dashboard/cbt`);
  }

  const primaryColor = tenant.branding.primaryColor || '#1E3A8A';
  const accentColor = tenant.branding.accentColor || '#2563EB';

  const hasFeature = tenant.hasFeature('feature_cbt_exams');
  if (!hasFeature) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-slate-900 text-white rounded-3xl shadow-xl border border-slate-800 text-center my-12">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold">CBT Online Testing Not Available</h1>
        <p className="text-slate-400 text-xs mt-2 leading-relaxed">
          The Computer-Based Testing module has not been activated for your school. Please check back later or contact your school administrator.
        </p>
      </div>
    );
  }

  const db = getTenantDb(tenant.id);
  const isParent = user.role === 'parent';

  // 1. Resolve student IDs
  let studentIds: string[] = [];

  if (isParent) {
    const { getParentWardsForUser } = await import('@/lib/guardian');
    const parentData = await getParentWardsForUser(tenant.id, user);
    studentIds = parentData.studentIds;
  } else if (user.studentId) {
    studentIds = [user.studentId];
  }

  if (studentIds.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl shadow-xs text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-slate-900">No Student Profile Linked</h2>
        <p className="text-xs text-slate-500 mt-1">
          Your portal login account does not have a linked student admission record. Please contact the school office.
        </p>
      </div>
    );
  }

  // 2. Fetch students, enrollments and published exams
  const studentsWithExams: StudentWithExams[] = [];
  const tenantCurriculum = await getTenantCurriculum(tenant.id);

  for (const sid of studentIds) {
    const student = await db.student.findUnique({
      where: { id: sid },
      select: { id: true, name: true, admissionNumber: true, guardianContactInfo: true },
    }).catch(() => null);

    if (!student) continue;

    const enrollment = await db.enrollment.findFirst({
      where: { studentId: sid, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { classLevel: true },
    }).catch(() => null);

    const classLevelId = enrollment?.classLevelId;

    let exams: any[] = [];
    if (classLevelId) {
      const allowedSubjectIds = resolveStudentSubjectIds({
        classLevelId,
        classLevel: enrollment?.classLevel,
        curriculum: tenantCurriculum,
        studentContactInfo: student.guardianContactInfo,
      });

      const rawExams = await prisma.cbtExam.findMany({
        where: {
          tenantId: tenant.id,
          classLevelId,
          isPublished: true,
        },
        include: {
          subject: true,
          classLevel: true,
          term: { include: { session: true } },
          questions: { select: { id: true, points: true } },
          attempts: {
            where: { studentId: sid },
            select: {
              id: true,
              score: true,
              maxScore: true,
              submittedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      exams = rawExams.filter((e) => allowedSubjectIds.includes(e.subjectId));
    }

    studentsWithExams.push({
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admissionNumber,
      className: enrollment?.classLevel?.name || 'Unassigned Class',
      exams: exams.map((e) => {
        const attempt = e.attempts[0];
        return {
          id: e.id,
          title: e.title,
          durationMins: e.durationMins,
          totalMarks: e.totalMarks,
          subjectName: e.subject.name,
          classLevelName: e.classLevel.name,
          termName: e.term.name,
          sessionLabel: e.term.session?.label || '',
          questionCount: e.questions.length,
          attempt: attempt
            ? {
                id: attempt.id,
                score: attempt.score,
                maxScore: attempt.maxScore,
                percentage: Math.round((attempt.score / attempt.maxScore) * 100),
                submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
              }
            : null,
        };
      }),
    });
  }

  return (
    <CbtPortalClient
      slug={slug}
      primaryColor={primaryColor}
      accentColor={accentColor}
      students={studentsWithExams}
      isParent={isParent}
    />
  );
}
