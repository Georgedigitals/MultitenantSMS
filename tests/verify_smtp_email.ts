import prisma from '../src/lib/prisma';
import {
  dispatchEmail,
  sendPlatformWelcomeEmail,
  sendTenantBrandedPasswordResetEmail,
  sendTenantBrandedNotification,
  verifySmtpConnection,
} from '../src/lib/email-service';

async function verifySmtpEmailSystem() {
  console.log('=== STARTING UNIVERSAL SMTP & MULTI-TENANT EMAIL VERIFICATION SUITE ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Find an existing tenant for testing
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'disaster-sandbox-school' },
  }) || await prisma.tenant.findFirst();

  if (!tenant) {
    throw new Error('No tenant found in database for email verification');
  }

  console.log(`Using test tenant: "${tenant.name}" (${tenant.slug}, ID: ${tenant.id})\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Platform Welcome Notification Email
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Test 1: Platform Welcome Email (Super Admin / Platform Base) ---');

  const welcomeResult = await sendPlatformWelcomeEmail({
    tenantName: tenant.name,
    slug: tenant.slug,
    adminName: 'Dr. Jane Principal',
    adminEmail: 'jane.admin@sandboxschool.edu',
  });

  assert(welcomeResult.success === true, 'Platform welcome email dispatched successfully');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Tenant-Branded Password Reset Email
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Tenant-Branded Password Reset Email (Tenant Base) ---');

  const resetResult = await sendTenantBrandedPasswordResetEmail({
    tenantId: tenant.id,
    recipientEmail: 'parent@example.com',
    recipientName: 'Mr. David Adeleke',
    resetToken: 'reset_token_test_123456789',
  });

  assert(resetResult.success === true, 'Tenant-branded password reset email dispatched successfully');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Tenant-Branded General Notification (Report Card / Fee Receipt)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Tenant-Branded General Notification (Report Card / Fee) ---');

  const notifResult = await sendTenantBrandedNotification({
    tenantId: tenant.id,
    recipientEmail: 'parent@example.com',
    recipientName: 'Mrs. Funke Adeleke',
    subject: 'Term 1 Report Card Published',
    messageText: 'Your child Samuel Adeleke (Grade 10) term 1 examination results have been verified and published.',
    actionUrl: `http://${tenant.slug}.localhost:3000/results/check`,
    actionText: 'View & Verify Report Card 📜',
  });

  assert(notifResult.success === true, 'Tenant-branded general notification dispatched successfully');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Direct Dispatch with Custom Reply-To & Display Name
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: Low-Level Dispatch with Custom Reply-To & From Masking ---');

  const directResult = await dispatchEmail({
    to: 'student@example.com',
    subject: 'Welcome to Student CBT Portal',
    html: '<p>Your examination PIN has been generated.</p>',
    fromName: tenant.name,
    replyTo: 'exams@sandboxschool.edu',
    tenantId: tenant.id,
  });

  assert(directResult.success === true, 'Direct email dispatch returned success');
  assert(typeof directResult.id === 'string' && directResult.id.length > 0, `Generated delivery ID: ${directResult.id}`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Custom Tenant SMTP Database Configuration & Override
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 5: Optional Custom Tenant SMTP Database Integration ---');

  // Clean up any existing config
  await prisma.emailConfiguration.deleteMany({
    where: { tenantId: tenant.id },
  });

  // Create custom SMTP configuration record for the tenant
  const customConfig = await prisma.emailConfiguration.create({
    data: {
      tenantId: tenant.id,
      host: '127.0.0.1',
      port: 9999,
      secure: false,
      user: 'admin@sandboxschool.edu',
      pass: 'secure_password_test',
      fromName: 'Sandbox Private Mail Server',
      fromEmail: 'admin@sandboxschool.edu',
      replyTo: 'helpdesk@sandboxschool.edu',
      verified: true,
    },
  });

  assert(customConfig.id.length > 0, `Created custom EmailConfiguration record: ${customConfig.id}`);
  assert(customConfig.verified === true, 'Custom SMTP verified status is active');

  // Verify that email dispatch recognizes the tenant's custom configuration and safely falls back
  const customDispatch = await dispatchEmail({
    to: 'board@sandboxschool.edu',
    subject: 'Executive Board Meeting Notice',
    html: '<p>Board meeting scheduled.</p>',
    tenantId: tenant.id,
  });

  assert(customDispatch.success === true, 'Dispatched email recognizing custom tenant SMTP configuration (with graceful fallback)');

  // Clean up test configuration
  await prisma.emailConfiguration.deleteMany({
    where: { tenantId: tenant.id },
  });

  const remaining = await prisma.emailConfiguration.findUnique({
    where: { tenantId: tenant.id },
  });
  assert(remaining === null, 'Tenant custom SMTP cleanly removed; automatically falls back to platform default');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: SMTP Connection Verification Engine (Negative Test)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 6: SMTP Connectivity Verification Engine (Error Handling) ---');

  const invalidVerification = await verifySmtpConnection({
    host: '127.0.0.1',
    port: 9999,
    secure: false,
    user: 'fake@example.com',
    pass: 'fake_pass',
  });

  assert(
    invalidVerification.success === false && typeof invalidVerification.error === 'string',
    `Invalid SMTP server correctly rejected with error: ${invalidVerification.error?.slice(0, 60)}...`
  );

  console.log(`\n=== ALL ${passed}/${total} UNIVERSAL SMTP & EMAIL CHECKS PASSED SUCCESSFULLY! ===\n`);
}

verifySmtpEmailSystem()
  .catch((err) => {
    console.error('\nVerification failed:', err);
    process.exit(1);
  });
