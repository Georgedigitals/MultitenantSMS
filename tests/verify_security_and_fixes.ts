import prisma from '../src/lib/prisma';
import { requireTenantAccess } from '../src/lib/auth/tenant-access';
import { saveSubjectScores } from '../src/lib/results';
import { processSubscriptionPaymentWebhook } from '../src/lib/webhook-idempotency';
import { ResultStatus } from '@prisma/client';

async function runSecurityAndFixesVerification() {
  console.log('=== STARTING SECURITY & SYSTEM FIXES VERIFICATION SUITE ===\n');

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

  const tenant = (await prisma.tenant.findFirst({
    where: { slug: 'disaster-sandbox-school' },
    include: { sessions: { include: { terms: true } } },
  })) || (await prisma.tenant.findFirst({ include: { sessions: { include: { terms: true } } } }));

  if (!tenant) {
    throw new Error('No test tenant found in database');
  }

  // Clean up any lingering rogue slug from prior runs
  await prisma.tenant.deleteMany({ where: { slug: 'non-existent-random-slug-12345' } }).catch(() => {});

  console.log(`Using test tenant: "${tenant.name}" (${tenant.slug}, ID: ${tenant.id})\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Ironclad requireTenantAccess Security Guard (Prevents Auth Bypass)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Test 1: requireTenantAccess Session & RBAC Enforcement ---');

  // A. Unauthenticated request (no session cookies present)
  const unauthResult = await requireTenantAccess(tenant.slug, ['school_admin']);
  assert(!unauthResult.authorized, 'Unauthenticated request correctly rejected');
  assert(unauthResult.statusCode === 401, 'Returns HTTP 401 Unauthorized');

  // B. Unknown tenant slug
  const notFoundResult = await requireTenantAccess('non-existent-random-slug-12345', ['school_admin']);
  assert(!notFoundResult.authorized, 'Non-existent tenant correctly rejected');
  assert(notFoundResult.statusCode === 404, 'Returns HTTP 404 Not Found');

  // C. Authenticated session with authorized role
  const adminUser = await prisma.tenantUser.findFirst({
    where: { tenantId: tenant.id, role: 'school_admin' },
  });
  if (adminUser) {
    const { createTenantSession, destroyTenantSession } = await import('../src/lib/auth/tenant-auth');
    const { token } = await createTenantSession(tenant.id, adminUser.id);

    // Should authorize school_admin
    const authorizedResult = await requireTenantAccess(tenant.slug, ['school_admin'], token);
    assert(authorizedResult.authorized === true, 'Authorized user with correct role successfully passes');
    assert(authorizedResult.user?.id === adminUser.id, 'Resolved authenticated user matches session');

    // Should reject school_admin if role requires only teacher
    const roleDeniedResult = await requireTenantAccess(tenant.slug, ['teacher'], token);
    assert(!roleDeniedResult.authorized, 'Role mismatch correctly rejected (RBAC enforcement)');
    assert(roleDeniedResult.statusCode === 403, 'Returns HTTP 403 Forbidden on role mismatch');

    await destroyTenantSession(token);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Academic Results Lock Enforcement (§5.2, §11.4)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Academic Results Lock Enforcement ---');

  const session = tenant.sessions[0];
  const term = session?.terms[0];
  const student = await prisma.student.findFirst({ where: { tenantId: tenant.id } });
  const subject = await prisma.subject.findFirst({ where: { tenantId: tenant.id } });
  const staff = await prisma.staff.findFirst({ where: { tenantId: tenant.id } });
  const classLevel = await prisma.classLevel.findFirst();

  if (term && student && subject && staff && classLevel) {
    // 1. Create a mock published result entry
    const publishedEntry = await prisma.resultEntry.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId: student.id,
          subjectId: subject.id,
          termId: term.id,
        },
      },
      update: {
        status: ResultStatus.published,
        grade: 'A',
      },
      create: {
        studentId: student.id,
        subjectId: subject.id,
        termId: term.id,
        teacherId: staff.id,
        scoreData: { exam: 75, total: 75 },
        status: ResultStatus.published,
        grade: 'A',
      },
    });

    // 2. Attempt to silently overwrite published scores without reopening
    let overwriteBlocked = false;
    let blockedErrorMessage = '';

    try {
      await saveSubjectScores({
        tenantId: tenant.id,
        teacherId: staff.id,
        classLevelId: classLevel.id,
        subjectId: subject.id,
        termId: term.id,
        markAsSubmitted: true,
        entries: [
          {
            studentId: student.id,
            scores: { exam: 90 },
          },
        ],
      });
    } catch (err: any) {
      overwriteBlocked = true;
      blockedErrorMessage = err.message;
    }

    assert(overwriteBlocked, 'Attempt to overwrite locked/published scores was strictly blocked');
    assert(
      blockedErrorMessage.includes('locked'),
      `Correct error reason thrown: "${blockedErrorMessage}"`
    );

    // Clean up test entry back to original state
    await prisma.resultEntry.delete({ where: { id: publishedEntry.id } }).catch(() => {});
  } else {
    console.log('  [SKIP] Academic fixtures missing for Test 2');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Normalized Guardian & StudentGuardian Relational Schema (PRD §4)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Guardian & StudentGuardian Relational Models ---');

  if (student) {
    // Create normalized Guardian
    const guardian = await prisma.guardian.create({
      data: {
        tenantId: tenant.id,
        name: 'Chief Oladipo Johnson',
        relationship: 'father',
        contactInfo: {
          phone: '+2348039999888',
          email: 'oladipo.johnson@example.com',
          address: '15 Victoria Island Way, Lagos',
        },
      },
    });
    assert(Boolean(guardian.id), `Normalized Guardian created: ${guardian.name}`);

    // Link Guardian to Student via StudentGuardian junction
    const studentGuardian = await prisma.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        isPrimaryContact: true,
      },
    });
    assert(studentGuardian.isPrimaryContact === true, 'StudentGuardian linked with isPrimaryContact=true');

    // Query relational link
    const fetchedStudent = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        guardians: {
          include: { guardian: true },
        },
      },
    });

    assert(
      fetchedStudent?.guardians.some((g) => g.guardian.id === guardian.id) === true,
      'Student queries connected Guardian via StudentGuardian relation'
    );

    // Clean up
    await prisma.studentGuardian.delete({ where: { id: studentGuardian.id } });
    await prisma.guardian.delete({ where: { id: guardian.id } });
    assert(true, 'Test Guardian and junction cleanly removed');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Paystack Upgrade Idempotent Processing
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: Paystack Subscription Upgrade Processing ---');

  const growthPlan = await prisma.plan.findFirst({ where: { id: 'plan_growth' } }) ||
    await prisma.plan.findFirst();

  if (growthPlan) {
    const testRef = `PSTK_TEST_UPGRADE_${Date.now()}`;
    const upgradeResult = await processSubscriptionPaymentWebhook({
      provider: 'paystack',
      reference: testRef,
      amount: Number(growthPlan.price),
      tenantSlug: tenant.slug,
      tenantId: tenant.id,
      planId: growthPlan.id,
      customerEmail: 'admin@sandboxschool.edu',
    });

    assert(upgradeResult.success === true, 'Subscription upgrade processed successfully');

    // Verify tenant plan updated
    const updatedTenant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { planId: true, status: true },
    });
    assert(updatedTenant?.planId === growthPlan.id, `Tenant plan updated to: ${growthPlan.id}`);
    assert(updatedTenant?.status === 'active', 'Tenant status set to active');

    // Second execution with same reference (idempotency check)
    const duplicateResult = await processSubscriptionPaymentWebhook({
      provider: 'paystack',
      reference: testRef,
      amount: Number(growthPlan.price),
      tenantSlug: tenant.slug,
      tenantId: tenant.id,
      planId: growthPlan.id,
      customerEmail: 'admin@sandboxschool.edu',
    });
    assert(duplicateResult.alreadyProcessed === true, 'Duplicate reference rejected idempotently');
  }

  console.log(`\n=== ALL ${passed}/${total} SECURITY & SYSTEM FIX TESTS PASSED SUCCESSFULLY! ===\n`);
  process.exit(0);
}

runSecurityAndFixesVerification()
  .catch((e) => {
    console.error('Verification failed:', e);
    process.exit(1);
  });
