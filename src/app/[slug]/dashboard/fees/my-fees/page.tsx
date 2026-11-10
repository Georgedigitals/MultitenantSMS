import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { calculateStudentFeeBalance } from '@/lib/fees';
import prisma from '@/lib/prisma';
import DashboardNav from '@/components/dashboard-nav';
import MyFeesClient from './my-fees-client';

interface MyFeesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MyFeesPage({ params }: MyFeesPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  const { user } = auth;

  const hasFeeFeature = tenant.hasFeature('school_fees');
  if (!hasFeeFeature) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <DashboardNav slug={slug} role={user.role} />
        <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-2xl mt-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mb-4 border border-amber-500/20">
            
          </div>
          <h2 className="text-xl font-bold mb-2">School Fee Tracking Not Enabled</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Fee payment records and online receipts are currently not active for {tenant.name}. Please contact the school administration for guidance.
          </p>
        </div>
      </div>
    );
  }

  // Determine student ID
  let studentId = user.studentId;

  // If user is parent or admin viewing my-fees, resolve target student
  if (!studentId) {
    const firstStudent = await prisma.student.findFirst({
      where: { tenantId: tenant.id },
      select: { id: true },
    });
    studentId = firstStudent?.id || null;
  }

  if (!studentId) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <DashboardNav slug={slug} role={user.role} />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          No student profile linked to this account.
        </div>
      </div>
    );
  }

  const activeSession = tenant.currentSession;
  const activeTerm = activeSession?.currentTerm;

  const feeBalance = activeTerm
    ? await calculateStudentFeeBalance(tenant.id, studentId, activeTerm.id)
    : null;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <DashboardNav slug={slug} role={user.role} />
      <MyFeesClient
        slug={slug}
        tenantName={tenant.name}
        studentName={student?.name || 'Student'}
        activeTerm={activeTerm ? { id: activeTerm.id, name: activeTerm.name, sessionLabel: activeSession?.label || '' } : null}
        feeBalance={feeBalance}
      />
    </div>
  );
}
