import { prisma } from '../src/lib/prisma';
import {
  calculateStudentFeeBalance,
  getTermFeeOverview,
  recordOfflinePayment,
  processFeePaymentWebhook,
  checkStudentFeeClearance,
} from '../src/lib/fees';
import crypto from 'crypto';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS  ${message}`);
}

async function runModule8Tests() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 8 — School Fees Module (§6A, §13.8)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Setup Test Fixtures (Tenant, Plan, Sessions, Class Levels, Students, Staff)
  const plan = await prisma.plan.findFirst();
  if (!plan) throw new Error('No plan found in seed data');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
    include: {
      sessions: {
        include: { terms: true },
      },
      students: true,
      staff: true,
    },
  });

  if (!tenant || tenant.students.length === 0 || tenant.staff.length === 0) {
    throw new Error('Apex tenant seed data missing');
  }

  const session = tenant.sessions[0];
  const term = session.terms[0];
  const staff = tenant.staff[0];

  const classLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });
  const jsLevel = classLevels[0]; // e.g. Primary 1 or JSS 1
  const sssLevel = classLevels[classLevels.length - 1]; // e.g. SSS 3

  // Create two distinct students for Apex tenant
  const studentA = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'Fee Test Student A (JSS1)',
    },
  });

  const studentB = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'Fee Test Student B (SSS3)',
    },
  });

  // Enroll students
  await prisma.enrollment.create({
    data: {
      studentId: studentA.id,
      classLevelId: jsLevel.id,
      sessionId: session.id,
    },
  });

  await prisma.enrollment.create({
    data: {
      studentId: studentB.id,
      classLevelId: sssLevel.id,
      sessionId: session.id,
    },
  });

  // Cleanup any leftover fee test records from previous runs
  await prisma.feePayment.deleteMany({
    where: { termId: term.id },
  });
  await prisma.feeAdjustment.deleteMany({
    where: { termId: term.id },
  });
  await prisma.feeItem.deleteMany({
    where: { tenantId: tenant.id, termId: term.id },
  });

  console.log('[Group 1: Fee Item Creation & Class-Level Scoping (§6A.3)]');
  // Create global fee item (applies to all)
  const globalTuitionFee = await prisma.feeItem.create({
    data: {
      tenantId: tenant.id,
      termId: term.id,
      classLevelId: null,
      name: 'General Tuition Fee',
      amount: 30000.0,
    },
  });

  // Create SSS-only fee item
  const sssLabFee = await prisma.feeItem.create({
    data: {
      tenantId: tenant.id,
      termId: term.id,
      classLevelId: sssLevel.id,
      name: 'SSS Science Lab Fee',
      amount: 5000.0,
    },
  });

  assert(
    globalTuitionFee.amount.toNumber() === 30000,
    '§6A.3: Global tuition fee item created with ₦30,000'
  );
  assert(
    sssLabFee.classLevelId === sssLevel.id,
    '§6A.3: Class-scoped fee item created for SSS level only'
  );

  console.log('\n[Group 2: Ledger-Not-Cache Formula Calculation (§6A.2)]');
  const balA_Initial = await calculateStudentFeeBalance(tenant.id, studentA.id, term.id);
  const balB_Initial = await calculateStudentFeeBalance(tenant.id, studentB.id, term.id);

  assert(
    balA_Initial.totalAssigned === 30000,
    '§6A.2: JSS1 Student A assigned global tuition only (₦30,000)'
  );
  assert(
    balB_Initial.totalAssigned === 35000,
    '§6A.2: SSS3 Student B assigned global tuition + SSS lab fee (₦35,000)'
  );
  assert(
    balA_Initial.balanceRemaining === 30000 && !balA_Initial.isFullyPaid,
    '§6A.2: Initial balance computed on-the-fly equals total assigned'
  );

  console.log('\n[Group 3: Student Fee Adjustments (Discounts & Waivers) (§6A.2)]');
  const adjustmentA = await prisma.studentFeeAdjustment.create({
    data: {
      studentId: studentA.id,
      feeItemId: globalTuitionFee.id,
      adjustmentType: 'discount',
      amountOrPercent: 5000.0,
    },
  });

  const balA_AfterAdj = await calculateStudentFeeBalance(tenant.id, studentA.id, term.id);
  assert(
    balA_AfterAdj.totalAdjustments === 5000,
    '§6A.2: Fee adjustment of ₦5,000 recorded for Student A'
  );
  assert(
    balA_AfterAdj.balanceRemaining === 25000,
    '§6A.2: Computed balance updated dynamically to ₦25,000 (30,000 - 5,000)'
  );

  console.log('\n[Group 4: Offline Payments & Staff Attribution (§6A.3, §6A.6)]');
  const offlinePayment = await recordOfflinePayment(
    tenant.id,
    staff.id,
    studentA.id,
    term.id,
    10000,
    'cash',
    'CASH-REC-001'
  );

  assert(
    offlinePayment.recordedBy === staff.id,
    '§6A.6: Offline payment stores recording staff_id (recorded_by attribution)'
  );

  const balA_AfterCash = await calculateStudentFeeBalance(tenant.id, studentA.id, term.id);
  assert(
    balA_AfterCash.totalPaid === 10000,
    '§6A.3: Partial cash payment of ₦10,000 recorded in payment ledger'
  );
  assert(
    balA_AfterCash.balanceRemaining === 15000,
    '§6A.2: Computed balance reflects partial payment (25,000 - 10,000 = ₦15,000)'
  );
  assert(
    balA_AfterCash.isPartiallyPaid && !balA_AfterCash.isFullyPaid,
    '§6A.4: Partial payment status correctly identified (isPartiallyPaid = true)'
  );

  console.log('\n[Group 5: Online Gateway Webhooks & Partial Payments (§6A.4, §11.4)]');
  const feePaymentRef = `FEE-TX-TEST-${Date.now()}`;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret';

  const webhookPayload = {
    event: 'charge.success',
    data: {
      reference: feePaymentRef,
      amount: 1500000, // ₦15,000 in kobo
      metadata: {
        type: 'fee_payment',
        studentId: studentA.id,
        termId: term.id,
      },
    },
  };

  const payloadStr = JSON.stringify(webhookPayload);
  const signature = crypto
    .createHmac('sha512', paystackSecret)
    .update(payloadStr)
    .digest('hex');

  const paymentRecord = await processFeePaymentWebhook('paystack', webhookPayload, signature);

  assert(
    paymentRecord.paymentRef === feePaymentRef,
    '§6A.4: Verified webhook creates FeePayment record for online checkout'
  );

  const balA_Final = await calculateStudentFeeBalance(tenant.id, studentA.id, term.id);
  assert(
    balA_Final.balanceRemaining === 0 && balA_Final.isFullyPaid,
    '§6A.4: Full payment completed via second partial payment (balanceRemaining = 0)'
  );

  // Idempotency check (§11.4)
  const duplicateRecord = await processFeePaymentWebhook('paystack', webhookPayload, signature);
  assert(
    duplicateRecord.id === paymentRecord.id,
    '§11.4: Webhook idempotency verified — duplicate paymentRef returns existing payment'
  );

  console.log('\n[Group 6: Promotion Clearance Flag & Multi-Tenant Isolation (§6A.5, §11.1)]');
  const clearanceA = await checkStudentFeeClearance(tenant.id, studentA.id, term.id);
  const clearanceB = await checkStudentFeeClearance(tenant.id, studentB.id, term.id);

  assert(
    !clearanceA.hasOutstandingBalance && clearanceA.isFullyPaid,
    '§6A.5: Fully paid Student A flags clearance = true (no debt)'
  );
  assert(
    clearanceB.hasOutstandingBalance && clearanceB.balanceRemaining === 35000,
    '§6A.5: Unpaid Student B flags clearance = false (₦35,000 debt for promotion review)'
  );

  // Cleanup test students & fee items
  await prisma.feePayment.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
  await prisma.studentFeeAdjustment.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
  await prisma.feeItem.deleteMany({ where: { id: { in: [globalTuitionFee.id, sssLabFee.id] } } });
  await prisma.enrollment.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
  await prisma.student.deleteMany({ where: { id: { in: [studentA.id, studentB.id] } } });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 8 Verification Complete: All tests passed!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

runModule8Tests().catch((err) => {
  console.error('Module 8 Test Failed:', err);
  process.exit(1);
});
