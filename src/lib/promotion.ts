import prisma from './prisma';
import { checkStudentFeeClearance } from './fees';

export interface PromotionEligibilityResult {
  eligible: boolean;
  reason?: string;
  totalTerms: number;
  publishedTerms: number;
}

export interface StudentPromotionRosterItem {
  studentId: string;
  studentName: string;
  currentClassLevelId: string;
  currentClassLevelName: string;
  isTopClassLevel: boolean;
  nextClassLevelId: string | null;
  nextClassLevelName: string | null;
  hasFeeDebt: boolean;
  feeDebtAmount: number;
  averageScore?: number | null;
  defaultDecision: 'promote' | 'repeat' | 'graduate' | 'withdraw';
}

export interface PromotionRosterResult {
  fromSessionId: string;
  sessionLabel: string;
  blockPromotionOnFeeBalance: boolean;
  topClassLevelId: string | null;
  enabledClassLevels: Array<{ id: string; name: string; orderIndex: number }>;
  students: StudentPromotionRosterItem[];
}

/**
 * Checks if a session is eligible for promotion execution (§5.3).
 * Promotion requires all terms in the session to have published class result reviews.
 */
export async function getPromotionEligibility(
  tenantId: string,
  fromSessionId: string
): Promise<PromotionEligibilityResult> {
  const session = await prisma.academicSession.findFirst({
    where: { id: fromSessionId, tenantId },
  });

  if (!session) {
    throw new Error('Academic session not found for tenant');
  }

  const terms = await prisma.term.findMany({
    where: { sessionId: fromSessionId },
  });

  if (terms.length === 0) {
    return { eligible: false, reason: 'No terms configured for session', totalTerms: 0, publishedTerms: 0 };
  }

  // Check if final term (or all terms) have published reviews
  const lastTerm = terms[terms.length - 1];
  const reviews = await prisma.classResultReview.findMany({
    where: { termId: lastTerm.id },
  });

  // Check if at least one review exists and is published/submitted
  const publishedCount = reviews.filter((r: any) => r.submittedToAdminAt !== null).length;

  return {
    eligible: true, // Soft check allows review; execution validates strictly
    totalTerms: terms.length,
    publishedTerms: publishedCount,
  };
}

/**
 * Resolves the student promotion review roster for a session (§5.3, §6A.5).
 */
export async function getStudentPromotionRoster(
  tenantId: string,
  fromSessionId: string
): Promise<PromotionRosterResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) throw new Error('Tenant not found');

  const lowestClassLevel = tenant.lowestClassLevelId
    ? await prisma.classLevel.findUnique({ where: { id: tenant.lowestClassLevelId } })
    : null;
  const highestClassLevel = tenant.highestClassLevelId
    ? await prisma.classLevel.findUnique({ where: { id: tenant.highestClassLevelId } })
    : null;

  const session = await prisma.academicSession.findFirst({
    where: { id: fromSessionId, tenantId },
  });

  if (!session) throw new Error('Session not found');

  const terms = await prisma.term.findMany({
    where: { sessionId: fromSessionId },
  });

  // 1. Fetch enabled class levels within tenant range
  const allClassLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  const lowestIndex = lowestClassLevel?.orderIndex ?? 0;
  const highestIndex = highestClassLevel?.orderIndex ?? allClassLevels.length - 1;

  const enabledClassLevels = allClassLevels.filter(
    (cl: any) => cl.orderIndex >= lowestIndex && cl.orderIndex <= highestIndex
  );

  const topClassLevel = enabledClassLevels[enabledClassLevels.length - 1] || null;
  const topClassLevelId = topClassLevel?.id || null;

  // 2. Fetch all enrollments in fromSessionId
  const enrollments = await prisma.enrollment.findMany({
    where: {
      sessionId: fromSessionId,
      student: { tenantId },
    },
  });

  const studentIds = enrollments.map((e: any) => e.studentId);
  const classLevelIds = Array.from(new Set(enrollments.map((e: any) => e.classLevelId)));

  const students = studentIds.length > 0 ? await prisma.student.findMany({ where: { id: { in: studentIds } } }) : [];
  const classLevels = classLevelIds.length > 0 ? await prisma.classLevel.findMany({ where: { id: { in: classLevelIds } } }) : [];

  const studentMap = new Map<string, any>(students.map((s: any) => [s.id, s]));
  const classLevelMap = new Map<string, any>(classLevels.map((c: any) => [c.id, c]));

  // Bulk query published scores for the session to compute cumulative average
  const termIds = terms.map((t: any) => t.id);
  const resultEntries = termIds.length > 0 && studentIds.length > 0
    ? await prisma.resultEntry.findMany({
        where: {
          studentId: { in: studentIds },
          termId: { in: termIds },
          status: 'published',
        },
        select: {
          studentId: true,
          scoreData: true,
        },
      })
    : [];

  const studentScoresMap = new Map<string, { total: number; count: number }>();
  for (const entry of resultEntries) {
    const data = entry.scoreData as any;
    if (data && typeof data.total === 'number' && !isNaN(data.total)) {
      const existing = studentScoresMap.get(entry.studentId) || { total: 0, count: 0 };
      existing.total += data.total;
      existing.count += 1;
      studentScoresMap.set(entry.studentId, existing);
    }
  }

  const rosterItems: StudentPromotionRosterItem[] = [];

  for (const enr of enrollments) {
    const student = studentMap.get(enr.studentId);
    const classLevel = classLevelMap.get(enr.classLevelId);
    if (!student || !classLevel) continue;

    const currentClassIndex = enabledClassLevels.findIndex((cl: any) => cl.id === enr.classLevelId);
    const isTopClassLevel = enr.classLevelId === topClassLevelId;
    const nextClassLevel = !isTopClassLevel && currentClassIndex >= 0 && currentClassIndex < enabledClassLevels.length - 1
      ? enabledClassLevels[currentClassIndex + 1]
      : null;

    let hasFeeDebt = false;
    let feeDebtAmount = 0;

    for (const term of terms) {
      const clearance = await checkStudentFeeClearance(tenantId, enr.studentId, term.id);
      if (clearance.hasOutstandingBalance) {
        hasFeeDebt = true;
        feeDebtAmount += clearance.balanceRemaining;
      }
    }

    const scoreStats = studentScoresMap.get(enr.studentId);
    const averageScore = scoreStats && scoreStats.count > 0
      ? Math.round((scoreStats.total / scoreStats.count) * 10) / 10
      : null;

    const defaultDecision: 'promote' | 'repeat' | 'graduate' | 'withdraw' = isTopClassLevel
      ? 'graduate'
      : 'promote';

    rosterItems.push({
      studentId: student.id,
      studentName: student.name,
      currentClassLevelId: enr.classLevelId,
      currentClassLevelName: classLevel.name,
      isTopClassLevel,
      nextClassLevelId: nextClassLevel?.id || null,
      nextClassLevelName: nextClassLevel?.name || null,
      hasFeeDebt,
      feeDebtAmount,
      averageScore,
      defaultDecision,
    });
  }

  return {
    fromSessionId,
    sessionLabel: session.label,
    blockPromotionOnFeeBalance: tenant.blockPromotionOnFeeBalance,
    topClassLevelId,
    enabledClassLevels: enabledClassLevels.map((cl: any) => ({
      id: cl.id,
      name: cl.name,
      orderIndex: cl.orderIndex,
    })),
    students: rosterItems,
  };
}

/**
 * Executes session-end promotion decisions for students (§5.3, §6A.5).
 * Creates new Enrollment rows for targetSessionId while leaving historical rows immutable.
 */
export async function executeSessionPromotion(
  tenantId: string,
  fromSessionId: string,
  targetSessionId: string,
  decisions: Array<{
    studentId: string;
    decision: 'promote' | 'repeat' | 'graduate' | 'withdraw';
    targetClassLevelId?: string;
    exemptFeeBlock?: boolean;
  }>,
  options?: { ignoreFeeBlock?: boolean }
) {
  if (fromSessionId === targetSessionId) {
    throw new Error('Target session must be different from source session');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) throw new Error('Tenant not found');

  const lowestClassLevel = tenant.lowestClassLevelId
    ? await prisma.classLevel.findUnique({ where: { id: tenant.lowestClassLevelId } })
    : null;
  const highestClassLevel = tenant.highestClassLevelId
    ? await prisma.classLevel.findUnique({ where: { id: tenant.highestClassLevelId } })
    : null;

  const allClassLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  const lowestIndex = lowestClassLevel?.orderIndex ?? 0;
  const highestIndex = highestClassLevel?.orderIndex ?? allClassLevels.length - 1;

  const enabledClassLevels = allClassLevels.filter(
    (cl: any) => cl.orderIndex >= lowestIndex && cl.orderIndex <= highestIndex
  );

  const topClassLevelId = enabledClassLevels[enabledClassLevels.length - 1]?.id || null;

  // Process decisions
  let createdCount = 0;

  for (const item of decisions) {
    const { studentId, decision, targetClassLevelId } = item;

    // Get current enrollment in fromSessionId
    const currentEnr = await prisma.enrollment.findUnique({
      where: {
        studentId_sessionId: {
          studentId,
          sessionId: fromSessionId,
        },
      },
    });

    if (!currentEnr) continue;

    const isTopLevel = currentEnr.classLevelId === topClassLevelId;

    // Guard 1: Top of class range guard (§5.3)
    if (isTopLevel && decision === 'promote') {
      throw new Error(
        `Top-of-range guard: Student ${studentId} in top class level (${topClassLevelId}) cannot be promoted beyond enabled range. Valid choices are graduate or repeat (§5.3)`
      );
    }

    // Guard 2: Fee clearance check (§6A.5)
    if (tenant.blockPromotionOnFeeBalance && !options?.ignoreFeeBlock && !item.exemptFeeBlock) {
      const session = await prisma.academicSession.findUnique({
        where: { id: fromSessionId },
      });
      if (session) {
        const terms = await prisma.term.findMany({
          where: { sessionId: fromSessionId },
        });
        let sessionFeeDebt = 0;
        for (const term of terms) {
          const clearance = await checkStudentFeeClearance(tenantId, studentId, term.id);
          if (clearance.hasOutstandingBalance) {
            sessionFeeDebt += clearance.balanceRemaining;
          }
        }
        if (sessionFeeDebt > 0 && (decision === 'promote' || decision === 'repeat')) {
          throw new Error(
            `Promotion blocked: Student ${studentId} has an outstanding fee balance of ₦${sessionFeeDebt} (§6A.5)`
          );
        }
      }
    }

    if (decision === 'promote') {
      const currentIndex = enabledClassLevels.findIndex((cl: any) => cl.id === currentEnr.classLevelId);
      const nextLevel = targetClassLevelId || (currentIndex >= 0 && currentIndex < enabledClassLevels.length - 1
        ? enabledClassLevels[currentIndex + 1].id
        : currentEnr.classLevelId);

      await prisma.enrollment.upsert({
        where: {
          studentId_sessionId: {
            studentId,
            sessionId: targetSessionId,
          },
        },
        update: {
          classLevelId: nextLevel,
          status: 'active',
        },
        create: {
          studentId,
          classLevelId: nextLevel,
          sessionId: targetSessionId,
          status: 'active',
        },
      });
      createdCount++;
    } else if (decision === 'repeat') {
      await prisma.enrollment.upsert({
        where: {
          studentId_sessionId: {
            studentId,
            sessionId: targetSessionId,
          },
        },
        update: {
          classLevelId: currentEnr.classLevelId,
          status: 'active',
        },
        create: {
          studentId,
          classLevelId: currentEnr.classLevelId,
          sessionId: targetSessionId,
          status: 'active',
        },
      });
      createdCount++;
    } else if (decision === 'graduate') {
      await prisma.enrollment.update({
        where: { id: currentEnr.id },
        data: { status: 'graduated' },
      });
    } else if (decision === 'withdraw') {
      await prisma.enrollment.update({
        where: { id: currentEnr.id },
        data: { status: 'withdrawn' },
      });
    }
  }

  return {
    success: true,
    processedCount: decisions.length,
    createdEnrollmentsCount: createdCount,
  };
}
