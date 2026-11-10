import prisma from '../src/lib/prisma';
import {
  startImpersonation,
  endImpersonation,
  updateTenantStatus,
  getPlatformFinancialOverview,
} from '../src/lib/super-admin';

async function verifyModule13() {
  console.log('=== STARTING MODULE 13 VERIFICATION SUITE ===\n');

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

  try {
    // 1. Fetch a SuperAdmin and a Tenant to test with
    const superAdmin = await prisma.superAdmin.findFirst();
    const tenant = await prisma.tenant.findFirst();

    if (!superAdmin || !tenant) {
      throw new Error('Database must have at least 1 SuperAdmin and 1 Tenant seeded to run tests');
    }

    console.log(`Using Super Admin: ${superAdmin.email}, Tenant: ${tenant.slug}`);

    // Test 1: Impersonation mandatory reason validation (§9.1)
    console.log('\n--- Test 1: Mandatory Reason Validation ---');
    let threwError = false;
    try {
      await startImpersonation({
        superAdminId: superAdmin.id,
        tenantId: tenant.id,
        reason: '   ', // whitespace only
      });
    } catch (err: any) {
      threwError = true;
      assert(
        err.message.includes('non-empty reason is required'),
        'Throws error when reason is empty or whitespace'
      );
    }
    assert(threwError, 'Reject impersonation start without reason');

    // Test 2: Successful Impersonation Start (§9)
    console.log('\n--- Test 2: Impersonation Session Start & Audit Log ---');
    const reasonText = 'Investigating teacher grade entry issue ticket #1024';
    const startResult = await startImpersonation({
      superAdminId: superAdmin.id,
      tenantId: tenant.id,
      reason: reasonText,
    });

    assert(Boolean(startResult.logId), 'Returns valid logId on impersonation start');
    assert(startResult.tenantId === tenant.id, 'Returns correct target tenantId');

    const dbLog = await prisma.impersonationLog.findUnique({
      where: { id: startResult.logId },
    });
    assert(Boolean(dbLog), 'ImpersonationLog record exists in DB');
    assert(dbLog?.reason === reasonText, 'ImpersonationLog reason matches input reason');
    assert(dbLog?.endedAt === null, 'Active impersonation log has endedAt = null');

    // Test 3: Impersonation Session End (§9)
    console.log('\n--- Test 3: Impersonation Session End ---');
    await endImpersonation(startResult.logId);
    const updatedDbLog = await prisma.impersonationLog.findUnique({
      where: { id: startResult.logId },
    });
    assert(updatedDbLog?.endedAt !== null, 'Ended impersonation log has non-null endedAt timestamp');

    // Test 4: Tenant Status Toggle (§9)
    console.log('\n--- Test 4: Tenant Status Management ---');
    const originalStatus = tenant.status;
    const suspended = await updateTenantStatus(tenant.id, 'suspended');
    assert(suspended.status === 'suspended', 'Tenant status updated to suspended');

    const restored = await updateTenantStatus(tenant.id, originalStatus);
    assert(restored.status === originalStatus, `Tenant status restored back to ${originalStatus}`);

    // Test 5: Platform Financial Overview & Revenue Separation (§9)
    console.log('\n--- Test 5: Platform Financial Overview & Revenue Separation ---');
    const overview = await getPlatformFinancialOverview();

    assert(
      typeof overview.platformRevenue.subscriptionRevenue === 'number',
      'Platform subscription revenue is numeric'
    );
    assert(
      typeof overview.platformRevenue.pinRevenue === 'number',
      'Platform PIN revenue is numeric'
    );
    assert(
      typeof overview.platformRevenue.totalPlatformRevenue === 'number',
      'Total platform revenue is numeric'
    );
    assert(
      overview.platformRevenue.totalPlatformRevenue ===
        overview.platformRevenue.subscriptionRevenue + overview.platformRevenue.pinRevenue,
      'Total platform revenue equals subscription + PIN revenue'
    );

    assert(
      typeof overview.schoolFeeVolume.totalFeeCollected === 'number',
      'School fee collected volume is numeric and separated'
    );
    assert(
      typeof overview.schoolFeeVolume.totalFeeOutstanding === 'number',
      'School fee outstanding volume is numeric and separated'
    );
    assert(
      Array.isArray(overview.tenantFinancials),
      'Per-tenant financials breakdown is returned as array'
    );

    console.log('\nFinancial Metrics Sample:');
    console.log('  Platform Revenue:', overview.platformRevenue);
    console.log('  School Fee Volume:', overview.schoolFeeVolume);

    console.log(`\n=== MODULE 13 VERIFICATION SUCCESSFUL (${passed}/${total} tests passed) ===`);
  } catch (err) {
    console.error(`\n❌ MODULE 13 VERIFICATION FAILED (${passed}/${total} passed):`, err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyModule13();
