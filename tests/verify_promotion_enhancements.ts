import { prisma } from '../src/lib/prisma';
import {
  getStudentPromotionRoster,
  executeSessionPromotion,
} from '../src/lib/promotion';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS  ${message}`);
}

async function runPromotionEnhancementTests() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 9 Enhanced — School Owner Promotion Engine Tests');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
    include: {
      sessions: {
        include: { terms: true },
      },
    },
  });

  if (!tenant || tenant.sessions.length === 0) {
    throw new Error('Apex tenant fixture missing');
  }

  const fromSession = tenant.sessions[0];
  const term = fromSession.terms[0];

  // Target new session
  const targetSession = await prisma.academicSession.create({
    data: {
      tenantId: tenant.id,
      label: `2026/2027 Test Promotion ${Date.now()}`,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-07-31'),
      isCurrent: false,
    },
  });

  const classLevels = await prisma.classLevel.findMany({ orderBy: { orderIndex: 'asc' } });
  const juniorLevel = classLevels[0];
  const nextLevel = classLevels[1];

  // Create student with fee debt and published exam scores
  const debtorStudent = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'Fee Bond Student',
    },
  });

  await prisma.enrollment.create({
    data: {
      studentId: debtorStudent.id,
      sessionId: fromSession.id,
      classLevelId: juniorLevel.id,
      status: 'active',
    },
  });

  // Assign an unpaid fee to debtorStudent
  const unpaidFee = await prisma.feeItem.create({
    data: {
      tenantId: tenant.id,
      termId: term.id,
      name: 'Session Promotion Debt Fee',
      amount: 25000.0,
      classLevelId: juniorLevel.id,
    },
  });

  // Create a subject and published result entry to test average score computation
  const subject = await prisma.subject.findFirst({
    where: { tenantId: tenant.id },
  });

  if (subject) {
    await prisma.resultEntry.create({
      data: {
        studentId: debtorStudent.id,
        subjectId: subject.id,
        termId: term.id,
        teacherId: (await prisma.staff.findFirst({ where: { tenantId: tenant.id } }))?.id || '',
        scoreData: { ca: 30, exam: 50, total: 80 },
        grade: 'A',
        status: 'published',
      },
    });
  }

  console.log('[Group 1: Roster Academic Performance & Debt Indicators]');
  const roster = await getStudentPromotionRoster(tenant.id, fromSession.id);
  const debtorRosterItem = roster.students.find((s) => s.studentId === debtorStudent.id);

  assert(debtorRosterItem !== undefined, 'Debtor student found in promotion roster');
  assert(debtorRosterItem?.hasFeeDebt === true, 'Fee debt flagged on student roster row');
  assert(debtorRosterItem?.feeDebtAmount !== undefined && debtorRosterItem.feeDebtAmount >= 25000, 'Fee debt amount includes assigned fees (>= ₦25,000)');

  if (subject) {
    assert(debtorRosterItem?.averageScore === 80, 'Published exam score correctly computed into 80% average');
  }

  console.log('\n[Group 2: Per-Student Fee Exemption (Principal Bond Waiver)]');
  // Enable fee block policy
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { blockPromotionOnFeeBalance: true },
  });

  // Test 1: Unexempted promotion with debt should be blocked
  let unexemptedBlocked = false;
  try {
    await executeSessionPromotion(tenant.id, fromSession.id, targetSession.id, [
      {
        studentId: debtorStudent.id,
        decision: 'promote',
        exemptFeeBlock: false,
      },
    ]);
  } catch (err: any) {
    if (err.message.includes('Promotion blocked') && err.message.includes('outstanding fee balance')) {
      unexemptedBlocked = true;
    }
  }
  assert(unexemptedBlocked, 'Unexempted debtor promotion strictly blocked by policy');

  // Test 2: Passing exemptFeeBlock: true allows the school owner to promote the student on bond
  const resultWithBond = await executeSessionPromotion(
    tenant.id,
    fromSession.id,
    targetSession.id,
    [
      {
        studentId: debtorStudent.id,
        decision: 'promote',
        exemptFeeBlock: true, // Principal granted fee exemption / payment bond
      },
    ]
  );

  assert(resultWithBond.success === true, 'Promotion executed successfully with Principal Bond Exemption');
  assert(resultWithBond.createdEnrollmentsCount === 1, '1 new enrollment created in target session');

  const newEnrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_sessionId: {
        studentId: debtorStudent.id,
        sessionId: targetSession.id,
      },
    },
  });

  assert(newEnrollment !== null, 'New enrollment exists in target session');
  assert(newEnrollment?.classLevelId === nextLevel.id, `Student advanced to next class level (${nextLevel.name})`);

  // Verify historical enrollment is untouched
  const oldEnrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_sessionId: {
        studentId: debtorStudent.id,
        sessionId: fromSession.id,
      },
    },
  });
  assert(oldEnrollment !== null, 'Historical enrollment record is intact and immutable');
  assert(oldEnrollment?.classLevelId === juniorLevel.id, 'Historical class level remains unchanged');

  // Cleanup
  await prisma.resultEntry.deleteMany({ where: { studentId: debtorStudent.id } });
  await prisma.feeItem.delete({ where: { id: unpaidFee.id } });
  await prisma.student.delete({ where: { id: debtorStudent.id } });
  await prisma.academicSession.delete({ where: { id: targetSession.id } });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  All Promotion Enhancement Tests Passed Successfully!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

runPromotionEnhancementTests()
  .catch((e) => {
    console.error('Test execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
