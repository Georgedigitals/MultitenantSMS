import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import prisma from '@/lib/prisma';
import { generateStudentReportCard, ReportCardData } from '@/lib/report-card';
import { calculateStudentFeeBalance } from '@/lib/fees';
import PortalResultsClient from './portal-results-client';

interface PortalResultsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalResultsPage({ params }: PortalResultsPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  const { user } = auth;
  if (user.role === 'school_admin' || user.role === 'teacher') redirect(`/${slug}/dashboard`);

  // Fetch full tenant details with plan for PIN requirement check
  const tenantFull = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    include: { plan: true },
  });

  const [availablePin, pinGateway] = await Promise.all([
    prisma.generatedPin.findFirst({
      where: { tenantId: tenant.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null, batch: { status: 'completed' } },
      include: { batch: { select: { pricePerPin: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.tenantPaymentGateway.findUnique({ where: { tenantId: tenant.id }, select: { enabled: true } }),
  ]);

  const pinRequired = Boolean(tenantFull?.plan?.pinRequired);
  const pinPrice = availablePin ? Number(availablePin.batch.pricePerPin) : Number(tenantFull?.pinPrice || 1000);
  const pinOnlineEnabled = Boolean(availablePin && pinGateway?.enabled && tenantFull?.hasOnlinePinPayment);
  const bankDetails = {
    bankName: tenantFull?.bankName || null,
    bankAccountNumber: tenantFull?.bankAccountNumber || null,
    bankAccountName: tenantFull?.bankAccountName || null,
  };

  const db = getTenantDb(tenant.id);
  const isParent = user.role === 'parent';
  const primaryColor = tenant.branding.primaryColor || '#1E3A8A';
  const currentSession = await prisma.academicSession.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
    include: { terms: { orderBy: { startDate: 'desc' } } },
  });

  // Resolve which students to show
  let studentIds: string[] = [];
  let userEmail = '';

  if (isParent) {
    const { getParentWardsForUser } = await import('@/lib/guardian');
    const parentData = await getParentWardsForUser(tenant.id, user);
    studentIds = parentData.studentIds;
    userEmail = (parentData.guardian?.contactInfo as any)?.email || user.username;
  } else if (user.studentId) {
    studentIds = [user.studentId];
  }

  if (studentIds.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-slate-900">Academic Results</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-800 text-sm font-medium">
          No student records are linked to your portal account. Please contact the school administration.
        </div>
      </div>
    );
  }

  // Fetch all students and their published results per term
  const studentsData = await Promise.all(
    studentIds.map(async (sid) => {
      const student = await db.student.findUnique({ where: { id: sid } }).catch(() => null);
      if (!student) return null;

      // All enrollments
      const enrollments = await db.enrollment.findMany({
        where: { studentId: sid },
        orderBy: { createdAt: 'desc' },
        include: { classLevel: true },
      }).catch(() => []);

      // Published result terms
      const publishedTermEntries = await db.resultEntry.findMany({
        where: {
          studentId: sid,
          status: 'published',
        },
        select: { termId: true },
        distinct: ['termId'],
      }).catch(() => []);

      const termIds = publishedTermEntries.map((r) => r.termId);

      // Fetch result entries per term & check PIN access status
      const termResults = await Promise.all(
        termIds.map(async (termId: string) => {
          const term = await db.term.findUnique({
            where: { id: termId },
            include: { session: true },
          }).catch(() => null);
          if (!term) return null;

          const entries = await db.resultEntry.findMany({
            where: { studentId: sid, termId },
            include: { subject: true },
          }).catch(() => []);

          if (entries.length === 0) return null;

          // Check if term is unlocked via PIN & Fee Clearance + load active PIN status for shared Parent/Student visibility
          let isUnlocked = false;
          let activePin: { code: string; usesRemaining: number; maxUses: number } | null = null;
          if (pinRequired) {
            const { verifyPinAccess } = await import('@/lib/pin');
            const access = await verifyPinAccess(tenant.id, sid, termId, undefined, { consumeUse: false });
            isUnlocked = access.isUnlocked;

            const [genPin, digPin] = await Promise.all([
              prisma.generatedPin.findFirst({
                where: { tenantId: tenant.id, studentId: sid, termId, soldAt: { not: null } },
                orderBy: { soldAt: 'desc' },
                select: { pinCode: true, usesCount: true, batch: { select: { maxUsesPerPin: true } } },
              }),
              prisma.resultPIN.findFirst({
                where: { studentId: sid, termId, status: 'active', student: { tenantId: tenant.id } },
                orderBy: { createdAt: 'desc' },
                select: { code: true, usesCount: true, maxUses: true },
              }),
            ]);
            const found = genPin
              ? { code: genPin.pinCode, usesCount: genPin.usesCount ?? 0, maxUses: genPin.batch?.maxUsesPerPin ?? 5 }
              : digPin
                ? { code: digPin.code, usesCount: digPin.usesCount ?? 0, maxUses: digPin.maxUses ?? 5 }
                : null;
            if (found) {
              activePin = {
                code: found.code,
                usesRemaining: Math.max(0, found.maxUses - found.usesCount),
                maxUses: found.maxUses,
              };
            }
          } else if (tenantFull?.blockResultOnFeeBalance) {
            const feeBal = await calculateStudentFeeBalance(tenant.id, sid, termId).catch(() => null);
            isUnlocked = !feeBal || feeBal.balanceRemaining <= 0;
          } else {
            isUnlocked = true;
          }

          let reportCard: ReportCardData | null = null;
          if (isUnlocked) {
            try {
              reportCard = await generateStudentReportCard(tenant.id, sid, termId);
            } catch (rcErr) {
              console.warn('[Portal ReportCard Generation]', rcErr);
            }
          }

          const totalScore = entries.reduce((sum: number, e: any) => {
            const val = typeof (e.scoreData as any)?.total === 'number'
              ? (e.scoreData as any).total
              : Number((e as any).totalScore) || 0;
            return sum + val;
          }, 0);

          const avg = !isUnlocked
            ? 'Locked'
            : reportCard
              ? `${reportCard.summary.averageScore.toFixed(1)}`
              : entries.length > 0
                ? (totalScore / entries.length).toFixed(1)
                : 'N/A';

          return {
            termId,
            termName: (term as any).name || 'Term',
            sessionLabel: (term as any).session?.label || '',
            entries: isUnlocked ? entries : [],
            avg,
            count: reportCard ? reportCard.summary.subjectsCount : entries.length,
            isUnlocked,
            activePin,
            reportCard,
          };
        })
      );

      const feeBalances = currentSession ? await Promise.all(currentSession.terms.map(async (term) => {
        const balance = await calculateStudentFeeBalance(tenant.id, sid, term.id).catch(() => null);
        if (!balance || balance.totalAssigned <= 0) return null;
        const verification = await prisma.feePaymentVerification.findFirst({
          where: { tenantId: tenant.id, studentId: sid, termId: term.id, status: 'pending' },
          select: { id: true, amount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        return {
          termId: term.id,
          termName: term.name,
          sessionLabel: currentSession.label,
          assigned: balance.totalAssigned,
          paid: balance.totalPaid,
          outstanding: balance.balanceRemaining,
          pendingTransfer: verification ? { id: verification.id, amount: Number(verification.amount) } : null,
        };
      })) : [];

      return {
        student: {
          id: student.id,
          name: student.name,
        },
        currentClass: (enrollments[0] as any)?.classLevel?.name || 'N/A',
        termResults: termResults.filter(Boolean) as any[],
        feeBalances: feeBalances.filter(Boolean),
      };
    })
  );

  const validStudents = studentsData.filter(Boolean) as any[];

  return (
    <PortalResultsClient
      slug={slug}
      tenantName={tenant.name}
      primaryColor={primaryColor}
      isParent={isParent}
      pinRequired={pinRequired}
      pinPrice={pinPrice}
      pinOnlineEnabled={pinOnlineEnabled}
      bankDetails={bankDetails}
      studentsData={validStudents}
      userEmail={userEmail}
    />
  );
}
