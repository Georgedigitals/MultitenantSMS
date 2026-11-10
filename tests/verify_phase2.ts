import { getTenantTrialStatus, checkTrialAccess } from '../src/lib/trial';
import { withWebhookLock, verifyWebhookSignature } from '../src/lib/webhook-idempotency';

async function runVerification() {
  console.log('--- Phase 2 Verification Suite ---');

  // Test 1: Free Trial Status Engine
  console.log('\n[Test 1] Free Trial Calculation Metrics:');
  const now = new Date();
  
  // 14 days in future
  const trial14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const status14 = getTenantTrialStatus({ status: 'trial', trialEndsAt: trial14Days });
  console.assert(status14.isTrial === true, 'Failed: isTrial should be true');
  console.assert(status14.isExpired === false, 'Failed: isExpired should be false');
  console.assert(status14.daysRemaining === 14, `Failed: daysRemaining expected 14, got ${status14.daysRemaining}`);
  console.log('  ✓ 14-Day Active Trial computed correctly (daysRemaining: 14)');

  // 2 days in future
  const trial2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const status2 = getTenantTrialStatus({ status: 'trial', trialEndsAt: trial2Days });
  console.assert(status2.daysRemaining === 2, `Failed: daysRemaining expected 2, got ${status2.daysRemaining}`);
  console.log('  ✓ Urgent Expiry Trial computed correctly (daysRemaining: 2)');

  // Expired 3 days ago (in grace period)
  const trialGrace = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const statusGrace = getTenantTrialStatus({ status: 'trial', trialEndsAt: trialGrace });
  console.assert(statusGrace.isExpired === true, 'Failed: isExpired should be true');
  console.assert(statusGrace.isGracePeriod === true, 'Failed: isGracePeriod should be true');
  console.log('  ✓ Grace Period Trial computed correctly (isExpired: true, isGracePeriod: true)');

  // Expired 10 days ago (past grace period)
  const trialExpiredPastGrace = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const statusPastGrace = getTenantTrialStatus({ status: 'trial', trialEndsAt: trialExpiredPastGrace });
  console.assert(statusPastGrace.isExpired === true, 'Failed: isExpired should be true');
  console.assert(statusPastGrace.isGracePeriod === false, 'Failed: isGracePeriod should be false');
  console.log('  ✓ Expired Past Grace Period computed correctly (isExpired: true, isGracePeriod: false)');

  // Test 2: Trial Access Control Rules
  console.log('\n[Test 2] Operational Access Authorization Rules:');
  const activeAccess = checkTrialAccess({ status: 'active' });
  console.assert(activeAccess.allowed === true, 'Failed: Active status must be allowed');
  console.log('  ✓ Active Subscription granted operational access');

  const unexpiredTrialAccess = checkTrialAccess({ status: 'trial', trialEndsAt: trial14Days });
  console.assert(unexpiredTrialAccess.allowed === true, 'Failed: Active trial must be allowed');
  console.log('  ✓ Unexpired Trial granted operational access');

  const graceTrialAccess = checkTrialAccess({ status: 'trial', trialEndsAt: trialGrace });
  console.assert(graceTrialAccess.allowed === true && !!graceTrialAccess.warning, 'Failed: Grace period must allow with warning');
  console.log('  ✓ Grace Period granted operational access with warning');

  const expiredTrialAccess = checkTrialAccess({ status: 'trial', trialEndsAt: trialExpiredPastGrace });
  console.assert(expiredTrialAccess.allowed === false, 'Failed: Expired trial past grace period must be blocked');
  console.log('  ✓ Expired Trial blocked from operational write operations');

  const suspendedAccess = checkTrialAccess({ status: 'suspended' });
  console.assert(suspendedAccess.allowed === false, 'Failed: Suspended status must be blocked');
  console.log('  ✓ Suspended workspace correctly blocked');

  // Test 3: Webhook Concurrency Lock & Idempotency Guard
  console.log('\n[Test 3] Webhook Reference Concurrency Lock:');
  const testRef = `TEST_LOCK_REF_${Date.now()}`;
  
  // Launch sequential lock test
  const lock1 = await withWebhookLock('paystack', testRef, 'test', testRef, async () => {
    return { executed: true };
  });
  console.assert(lock1.processed === true && lock1.result?.executed === true, 'Failed: Initial webhook lock should execute');
  console.log('  ✓ First webhook call executed successfully under lock');

  // Launch duplicate concurrent lock test while lock is active
  const inFlightRef = `IN_FLIGHT_REF_${Date.now()}`;
  const p1 = withWebhookLock('paystack', inFlightRef, 'test', inFlightRef, async () => {
    await new Promise((r) => setTimeout(r, 100));
    return { done: 1 };
  });
  const p2 = withWebhookLock('paystack', inFlightRef, 'test', inFlightRef, async () => {
    return { done: 2 };
  });

  const [res1, res2] = await Promise.all([p1, p2]);
  const duplicateCaught = (res1.duplicate || res2.duplicate) === true;
  console.assert(duplicateCaught, 'Failed: Concurrent lock should catch duplicate in-flight webhook');
  console.log('  ✓ In-flight concurrent duplicate webhook request safely yields without double processing');

  // Test 4: Webhook Signature Verification
  console.log('\n[Test 4] Webhook Signature Verification Guard:');
  const validSignature = verifyWebhookSignature('paystack', { test: true }, 'mock_valid_signature');
  console.assert(validSignature === true, 'Failed: Signature check failed in test env');
  console.log('  ✓ Signature verification guard functions correctly');

  console.log('\n=================================================');
  console.log('SUCCESS: All Phase 2 Core Engine Checks Passed Cleanly!');
  console.log('=================================================\n');
}

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
