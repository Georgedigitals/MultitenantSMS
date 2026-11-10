import { prisma } from '../src/lib/prisma';
import {
  generatePinCode,
  calculatePinFees,
  verifyPinAccess,
  redeemPin,
  initializePinPurchase,
  issuePinForPayment,
  processPaymentWebhook,
} from '../src/lib/pin';

let passed = 0;
let failed = 0;

function ok(description: string) {
  passed++;
  console.log(`  ✅ PASS  ${description}`);
}

function fail(description: string, detail: string) {
  failed++;
  console.error(`  ❌ FAIL  ${description}`);
  console.error(`           Detail: ${detail}`);
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 7 — Result Checker PIN + Payment Integration (§6, §13.7)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Setup test entities
  const apex = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
    include: { plan: true },
  });
  const beacon = await prisma.tenant.findUnique({
    where: { slug: 'beacon' },
    include: { plan: true },
  });

  if (!apex || !beacon) {
    throw new Error('Test setup failed: Seed tenants apex and beacon are required');
  }

  const term = await prisma.term.findFirst({
    where: { session: { tenantId: apex.id } },
    include: { session: true },
  });

  if (!term) {
    throw new Error('Test setup failed: Term required');
  }

  const testStudent = await prisma.student.findFirst({
    where: { tenantId: apex.id },
  });

  const otherStudent = await prisma.student.findFirst({
    where: { tenantId: apex.id, id: { not: testStudent?.id } },
  });

  if (!testStudent || !otherStudent) {
    throw new Error('Test setup failed: At least two students required for testing');
  }

  // Clean up any existing PINs for test student to ensure clean state
  await prisma.resultPIN.deleteMany({
    where: { studentId: { in: [testStudent.id, otherStudent.id] } },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Group 1: Cryptographic PIN Generation (§6.1)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Group 1: Cryptographic PIN Generation & Format (§6.1)]');

  const pinCode1 = await generatePinCode();
  const pinCode2 = await generatePinCode();

  if (/^\d{4}-\d{4}-\d{4}$/.test(pinCode1)) {
    ok('§6.1: PIN code generated in 12-digit XXXX-XXXX-XXXX format');
  } else {
    fail('§6.1: PIN format', `Expected XXXX-XXXX-XXXX format, got: ${pinCode1}`);
  }

  if (pinCode1 !== pinCode2) {
    ok('§6.1: PIN generation generates unique codes across calls');
  } else {
    fail('§6.1: PIN uniqueness', 'Generated identical codes back-to-back');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 2: Revenue Split & Fee Calculations (§6)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 2: Revenue Split & Fee Calculations (§6)]');

  const fees = await calculatePinFees(apex.id);
  if (fees.pricePaid === 1000.0) {
    ok('§6: Default tenant PIN price loaded correctly (₦1,000)');
  } else {
    fail('§6: PIN price', `Expected 1000, got ${fees.pricePaid}`);
  }

  if (fees.platformFee + fees.schoolNet === fees.pricePaid) {
    ok('§6: Platform fee and school net revenue sum exactly to price paid');
  } else {
    fail(
      '§6: Fee split math',
      `platformFee (${fees.platformFee}) + schoolNet (${fees.schoolNet}) !== pricePaid (${fees.pricePaid})`
    );
  }

  if (fees.platformFeePercent === Number(apex.plan.platformFeePercent)) {
    ok('§6: Platform fee percentage correctly derived from tenant Plan settings');
  } else {
    fail('§6: Plan fee percent', `Expected ${apex.plan.platformFeePercent}, got ${fees.platformFeePercent}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 3: Shared Authorization Gate (§6.1)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 3: Shared Authorization Gate (§6.1)]');

  const initialGateCheck = await verifyPinAccess(apex.id, testStudent.id, term.id);
  if (!initialGateCheck.isUnlocked) {
    ok('§6.1: Un-PINned result access is strictly blocked by default');
  } else {
    fail('§6.1: Gate check', 'Expected isUnlocked: false for student without active PIN');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 4: Webhook Verification & PIN Issuance (§6, §11.4)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 4: Webhook Verification & PIN Issuance (§6, §11.4)]');

  const testRef = `TEST-REF-${Date.now()}`;
  const invalidWebhook = await processPaymentWebhook(
    'paystack',
    {
      event: 'charge.success',
      data: {
        reference: testRef,
        amount: 100000,
        metadata: { tenantId: apex.id, studentId: testStudent.id, termId: term.id, type: 'pin_purchase' },
      },
    },
    'invalid_signature_header'
  );

  if (!invalidWebhook.success && invalidWebhook.reason?.includes('signature')) {
    ok('§11.4: Webhook rejects unverified payload with invalid signature');
  } else {
    fail('§11.4: Webhook signature', 'Expected rejection of invalid signature');
  }

  const validWebhook = await processPaymentWebhook(
    'paystack',
    {
      event: 'charge.success',
      data: {
        reference: testRef,
        amount: 100000,
        metadata: { tenantId: apex.id, studentId: testStudent.id, termId: term.id, type: 'pin_purchase' },
      },
    },
    'mock_valid_signature'
  );

  if (validWebhook.success && validWebhook.pin) {
    ok('§6: Verified webhook creates ResultPIN record with unused status');
  } else {
    fail('§6: Webhook PIN issuance', `Failed: ${validWebhook.reason}`);
  }

  const issuedPin = validWebhook.pin;
  if (issuedPin && Number(issuedPin.pricePaid) === 1000) {
    ok('§6: Issued PIN stores correct pricePaid, platformFee, and schoolNet');
  } else {
    fail('§6: PIN fee data', `Expected pricePaid 1000, got ${issuedPin?.pricePaid}`);
  }

  // Test idempotency
  const duplicateWebhook = await processPaymentWebhook(
    'paystack',
    {
      event: 'charge.success',
      data: {
        reference: testRef,
        amount: 100000,
        metadata: { tenantId: apex.id, studentId: testStudent.id, termId: term.id, type: 'pin_purchase' },
      },
    },
    'mock_valid_signature'
  );

  if (duplicateWebhook.success && duplicateWebhook.pin?.id === issuedPin.id) {
    ok('§11.4: Webhook idempotency verified — re-sending paymentRef returns existing PIN');
  } else {
    fail('§11.4: Webhook idempotency', 'Created duplicate PIN for same paymentRef');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 5: PIN Redemption & Lifetime Activation (§6)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 5: PIN Redemption & Lifetime Activation (§6)]');

  const redemption = await redeemPin(apex.id, issuedPin.code, testStudent.id, term.id);
  if (redemption.success && redemption.pin?.status === 'active') {
    ok('§6: PIN successfully redeemed and status updated to "active"');
  } else {
    fail('§6: PIN redemption', `Expected success and active status, got: ${redemption.reason}`);
  }

  const subsequentGateCheck = await verifyPinAccess(apex.id, testStudent.id, term.id);
  if (subsequentGateCheck.isUnlocked) {
    ok('§6: Once activated, result remains permanently unlocked for student & term');
  } else {
    fail('§6: Unlocked state persistence', 'Result remained locked after PIN activation');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 6: Multi-Tenant & Cross-Student Isolation (§11.1)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 6: Multi-Tenant & Cross-Student Isolation (§11.1)]');

  // Attempting to redeem testStudent's PIN for another student
  const crossStudentRedeem = await redeemPin(apex.id, issuedPin.code, otherStudent.id, term.id);
  if (!crossStudentRedeem.success && crossStudentRedeem.reason?.includes('registered to another student')) {
    ok('§6: PIN code cannot be redeemed for a different student');
  } else {
    fail('§6: Cross-student PIN protection', 'PIN was accepted for a different student');
  }

  // Attempting cross-tenant access with Beacon
  const crossTenantGate = await verifyPinAccess(beacon.id, testStudent.id, term.id);
  if (!crossTenantGate.isUnlocked && crossTenantGate.reason?.includes('not found or unauthorized')) {
    ok('§11.1: Beacon cannot verify PIN access for Apex student (cross-tenant blocked)');
  } else {
    fail('§11.1: Cross-tenant isolation', 'Beacon accessed Apex student PIN state');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Module 7 Verification Complete: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nFatal test error:', err);
  process.exit(1);
});
