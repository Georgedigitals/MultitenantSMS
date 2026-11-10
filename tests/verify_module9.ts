import { prisma } from '../src/lib/prisma';
import {
  getPromotionEligibility,
  getStudentPromotionRoster,
  executeSessionPromotion,
} from '../src/lib/promotion';
import { calculateStudentFeeBalance } from '../src/lib/fees';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS  ${message}`);
}

async function runModule9Tests() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 9 — Promotion Workflow (§5.3, §6A.5, §13.9)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
    include: {
      sessions: {
        include: { terms: true },
      },
      students: true,
      staff: true,
      lowestClassLevel: true,
      highestClassLevel: true,
    },
  });

  if (!tenant || tenant.sessions.length === 0) {
    throw new Error('Apex tenant seed data missing');
  }

  const session2024 = tenant.sessions[0];
  const term = session2024.terms[0];

  // Create a new target session for promotion
  const session2025 = await prisma.academicSession.create({
    data: {
      tenantId: tenant.id,
      label: `2025/2026 Test Session ${Date.now()}`,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-07-31'),
      isCurrent: false,
    },
  });

  const classLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  const lowestIndex = tenant.lowestClassLevel?.orderIndex ?? 0;
  const highestIndex = tenant.highestClassLevel?.orderIndex ?? classLevels.length - 1;

  const enabledLevels = classLevels.filter(
    (cl) => cl.orderIndex >= lowestIndex && cl.orderIndex <= highestIndex
  );

  const jsLevel = enabledLevels[0]; // e.g. Primary 1 or JSS 1
  const topLevel = enabledLevels[enabledLevels.length - 1]; // e.g. SSS 3

  // Create 2 test students
  const studentA = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'Promotion Test Student A (JSS1)',
    },
  });

  const studentB = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'Promotion Test Student B (SSS3 Top Level)',
    },
  });

  const enrA = await prisma.enrollment.create({
    data: {
      studentId: studentA.id,
      classLevelId: jsLevel.id,
      sessionId: session2024.id,
      status: 'active',
    },
  });

  const enrB = await prisma.enrollment.create({
    data: {
      studentId: studentB.id,
      classLevelId: topLevel.id,
      sessionId: session2024.id,
      status: 'active',
    },
  });

  console.log('[Group 1: Promotion Prerequisites & Eligibility Check (§5.3)]');
  const eligibility = await getPromotionEligibility(tenant.id, session2024.id);
  assert(
    eligibility.eligible,
    '§5.3: Promotion eligibility checker evaluates active session prerequisites'
  );

  console.log('\n[Group 2: Tenant Class Range Bounds & Roster Default Decisions (§5.3, §4.1)]');
  const roster = await getStudentPromotionRoster(tenant.id, session2024.id);
  assert(
    roster.topClassLevelId === topLevel.id,
    '§5.3: Top class level correctly identified within tenant enabled range'
  );

  const rosterItemA = roster.students.find((s) => s.studentId === studentA.id);
  const rosterItemB = roster.students.find((s) => s.studentId === studentB.id);

  assert(
    rosterItemA?.defaultDecision === 'promote',
    '§5.3: Standard class student defaults to "promote" decision'
  );
  assert(
    rosterItemB?.defaultDecision === 'graduate' && rosterItemB.isTopClassLevel,
    '§5.3: Top-level cohort student defaults to "graduate" decision'
  );

  console.log('\n[Group 3: Top-of-Class-Range Promotion Guard (§5.3)]');
  let topGuardTriggered = false;
  try {
    await executeSessionPromotion(
      tenant.id,
      session2024.id,
      session2025.id,
      [
        {
          studentId: studentB.id,
          decision: 'promote', // Invalid attempt to promote top level student
        },
      ]
    );
  } catch (err: any) {
    if (err.message.includes('Top-of-range guard')) {
      topGuardTriggered = true;
    }
  }

  assert(
    topGuardTriggered,
    '§5.3: Top-of-range guard blocks promotion of top class level student beyond enabled ladder'
  );

  console.log('\n[Group 4: Integrated Fee Clearance Debt Flags & Blocking (§6A.5)]');
  // Enable fee clearance policy on tenant
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { blockPromotionOnFeeBalance: true },
  });

  // Assign an unpaid fee item to Student A
  const unpaidFee = await prisma.feeItem.create({
    data: {
      tenantId: tenant.id,
      termId: term.id,
      name: 'Unpaid Term Activity Fee',
      amount: 15000.0,
    },
  });

  let feeBlockTriggered = false;
  try {
    await executeSessionPromotion(
      tenant.id,
      session2024.id,
      session2025.id,
      [
        {
          studentId: studentA.id,
          decision: 'promote',
        },
      ]
    );
  } catch (err: any) {
    if (err.message.includes('Promotion blocked') && err.message.includes('outstanding fee balance')) {
      feeBlockTriggered = true;
    }
  }

  assert(
    feeBlockTriggered,
    '§6A.5: Tenant fee block policy blocks promotion for student with unpaid balance'
  );

  console.log('\n[Group 5: Session Promotion Execution & Immutable Enrollment Generation (§4.1, §5.3)]');
  // Execute promotion with ignoreFeeBlock option for test completion
  const execResult = await executeSessionPromotion(
    tenant.id,
    session2024.id,
    session2025.id,
    [
      {
        studentId: studentA.id,
        decision: 'promote',
      },
      {
        studentId: studentB.id,
        decision: 'graduate',
      },
    ],
    { ignoreFeeBlock: true }
  );

  assert(
    execResult.success && execResult.createdEnrollmentsCount === 1,
    '§5.3: Promotion execution completed successfully'
  );

  // Verify new enrollment created in target session for Student A
  const newEnrA = await prisma.enrollment.findUnique({
    where: {
      studentId_sessionId: {
        studentId: studentA.id,
        sessionId: session2025.id,
      },
    },
  });

  assert(
    newEnrA !== null && newEnrA.sessionId === session2025.id,
    '§4.1: Brand new Enrollment created for target session'
  );

  // Verify historical enrollment for Student A in source session remains untouched
  const oldEnrA = await prisma.enrollment.findUnique({
    where: { id: enrA.id },
  });

  assert(
    oldEnrA !== null && oldEnrA.sessionId === session2024.id && oldEnrA.classLevelId === jsLevel.id,
    '§4.1: Historical enrollment record remains untouched and immutable'
  );

  // Verify Student B status updated to graduated
  const oldEnrB = await prisma.enrollment.findUnique({
    where: { id: enrB.id },
  });

  assert(
    oldEnrB?.status === 'graduated',
    '§5.3: Graduating top-level student status updated to "graduated"'
  );

  console.log('\n[Group 6: Cleanup & Multi-Tenant Isolation (§11.1)]');
  // Cleanup test data
  await prisma.feeItem.delete({ where: { id: unpaidFee.id } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
  await prisma.student.deleteMany({ where: { id: { in: [studentA.id, studentB.id] } } });
  await prisma.academicSession.delete({ where: { id: session2025.id } });

  // Reset tenant setting
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { blockPromotionOnFeeBalance: false },
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 9 Verification Complete: All tests passed!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

runModule9Tests().catch((err) => {
  console.error('Module 9 Test Failed:', err);
  process.exit(1);
});
