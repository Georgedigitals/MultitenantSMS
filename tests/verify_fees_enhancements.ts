import { prisma } from '../src/lib/prisma';
import {
  calculateStudentFeeBalance,
  copyFeeItemsBetweenTerms,
  recordFeeAdjustment,
  removeFeeAdjustment,
} from '../src/lib/fees';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS  ${message}`);
}

async function runFeesEnhancementTests() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 8 Enhanced — School Owner Fee Workflow Tests');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Setup Test Fixtures (Apex tenant)
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
    include: {
      sessions: {
        include: { terms: true },
      },
      students: true,
    },
  });

  if (!tenant || tenant.sessions.length === 0 || tenant.sessions[0].terms.length === 0) {
    throw new Error('Apex tenant test fixture missing');
  }

  const session = tenant.sessions[0];
  let term1 = session.terms[0];
  let term2 = session.terms[1];

  // If session only has 1 term, create term 2 for testing clone
  if (!term2) {
    term2 = await prisma.term.create({
      data: {
        sessionId: session.id,
        name: 'Second Term (Clone Test)',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-04-10'),
      },
    });
  }

  const classLevels = await prisma.classLevel.findMany({ orderBy: { orderIndex: 'asc' } });
  const sampleClass = classLevels[0];

  // Clean up any existing items in term 2
  await prisma.feeItem.deleteMany({
    where: { tenantId: tenant.id, termId: term2.id },
  });

  // Ensure term 1 has at least 2 fee items (1 global, 1 class-scoped)
  await prisma.feeItem.deleteMany({
    where: { tenantId: tenant.id, termId: term1.id },
  });

  const term1GlobalItem = await prisma.feeItem.create({
    data: {
      tenantId: tenant.id,
      termId: term1.id,
      name: 'Term 1 Tuition Base',
      amount: 40000.0,
      classLevelId: null,
    },
  });

  const term1ClassItem = await prisma.feeItem.create({
    data: {
      tenantId: tenant.id,
      termId: term1.id,
      name: 'Class Specific Lab Fee',
      amount: 10000.0,
      classLevelId: sampleClass.id,
    },
  });

  console.log('[Group 1: 1-Click Fee Structure Cloning (§6A.3)]');

  // Test exact copy (0% adjustment)
  const copiedItems = await copyFeeItemsBetweenTerms(tenant.id, term1.id, term2.id, 0);
  assert(copiedItems.length === 2, 'Cloned exactly 2 fee items from Term 1 to Term 2');

  const clonedGlobal = copiedItems.find((i) => i.classLevelId === null);
  const clonedClass = copiedItems.find((i) => i.classLevelId === sampleClass.id);

  assert(Number(clonedGlobal?.amount) === 40000, 'Global fee amount matches source (₦40,000)');
  assert(Number(clonedClass?.amount) === 10000, 'Class-scoped fee matches source (₦10,000)');

  // Clean term 2 and test percentage inflation adjustment (+10%)
  await prisma.feeItem.deleteMany({ where: { tenantId: tenant.id, termId: term2.id } });
  const inflatedItems = await copyFeeItemsBetweenTerms(tenant.id, term1.id, term2.id, 10);
  const inflatedGlobal = inflatedItems.find((i) => i.classLevelId === null);
  assert(Number(inflatedGlobal?.amount) === 44000, 'Inflation applied correctly: 40,000 + 10% = ₦44,000');

  console.log('\n[Group 2: Student Fee Concessions (Discounts & Waivers) (§6A.2)]');

  // Create or pick a test student
  const testStudent = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'Concession Test Student',
    },
  });

  // Enroll student in sampleClass for term 1 session
  await prisma.enrollment.upsert({
    where: {
      studentId_sessionId: {
        studentId: testStudent.id,
        sessionId: session.id,
      },
    },
    update: { classLevelId: sampleClass.id, status: 'active' },
    create: {
      studentId: testStudent.id,
      sessionId: session.id,
      classLevelId: sampleClass.id,
      status: 'active',
    },
  });

  // Calculate initial balance (Tuition 40,000 + Lab 10,000 = ₦50,000)
  const initialBal = await calculateStudentFeeBalance(tenant.id, testStudent.id, term1.id);
  assert(initialBal.totalAssigned === 50000, 'Initial assigned fees equal ₦50,000');
  assert(initialBal.totalAdjustments === 0, 'Initial adjustments equal 0');
  assert(initialBal.balanceRemaining === 50000, 'Initial balance remaining equals ₦50,000');

  // Apply a sibling discount of ₦15,000 on tuition
  const adjustment = await recordFeeAdjustment(
    tenant.id,
    testStudent.id,
    term1GlobalItem.id,
    'discount',
    15000
  );
  assert(adjustment.id !== undefined, 'Recorded ₦15,000 discount concession');

  // Check dynamically updated balance
  const balAfterAdj = await calculateStudentFeeBalance(tenant.id, testStudent.id, term1.id);
  assert(balAfterAdj.totalAdjustments === 15000, 'Dynamic total adjustments reflect ₦15,000');
  assert(balAfterAdj.balanceRemaining === 35000, 'Balance remaining reduced to ₦35,000 (50,000 - 15,000)');

  // Revoke the adjustment
  await removeFeeAdjustment(tenant.id, testStudent.id, term1GlobalItem.id);
  const balAfterRevoke = await calculateStudentFeeBalance(tenant.id, testStudent.id, term1.id);
  assert(balAfterRevoke.totalAdjustments === 0, 'Adjustment removed cleanly (0 adjustments)');
  assert(balAfterRevoke.balanceRemaining === 50000, 'Balance reverted to full ₦50,000');

  console.log('\n[Group 3: Multi-Tenant Isolation Enforcement (§11.1)]');
  let crossTenantBlocked = false;
  try {
    // Attempting to clone or adjust across a fake or mismatched tenant
    await copyFeeItemsBetweenTerms('fake_tenant_id_999', term1.id, term2.id, 0);
  } catch (err: any) {
    crossTenantBlocked = true;
  }
  assert(crossTenantBlocked, 'Cross-tenant fee cloning rejected with unauthorized error');

  // Cleanup test student
  await prisma.student.delete({ where: { id: testStudent.id } });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  All Fee Enhancement Tests Passed Successfully!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

runFeesEnhancementTests()
  .catch((e) => {
    console.error('Test execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

