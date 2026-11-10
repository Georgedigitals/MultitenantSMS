import { prisma } from '../src/lib/prisma';
import {
  isReservedSlug,
  isValidSlugFormat,
  getTenantContext,
  isClassLevelWithinTenantRange,
} from '../src/lib/tenant';

async function runTests() {
  console.log('🧪 Starting Module 1 Automated Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  }

  // Test 1: Global ClassLevel Ladder
  console.log('Test Suite 1: Global ClassLevel ladder (§4.1)');
  const allClassLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });
  assert(allClassLevels.length === 15, 'ClassLevel has exactly 15 ordered levels');
  assert(allClassLevels[0].name === 'Nursery 1' && allClassLevels[0].orderIndex === 1, 'First class level is Nursery 1 at index 1');
  assert(allClassLevels[14].name === 'SSS 3' && allClassLevels[14].orderIndex === 15, 'Highest class level is SSS 3 at index 15');

  // Test 2: Reserved Slugs & Slug Validation (§3.2)
  console.log('\nTest Suite 2: Reserved Slugs & Slug Validation (§3.2)');
  assert(isReservedSlug('admin') === true, 'admin is rejected as a reserved slug');
  assert(isReservedSlug('api') === true, 'api is rejected as a reserved slug');
  assert(isReservedSlug('www') === true, 'www is rejected as a reserved slug');
  assert(isReservedSlug('apex') === false, 'apex is allowed as non-reserved');
  assert(isValidSlugFormat('my-school-123') === true, 'my-school-123 is valid format');
  assert(isValidSlugFormat('ab') === false, 'ab (< 3 chars) is rejected');
  assert(isValidSlugFormat('School_Name!') === false, 'Invalid chars rejected');

  // Test 3: Tenant Context Loader (§3.1)
  console.log('\nTest Suite 3: Tenant Context Loader (§3.1)');
  const apex = await getTenantContext({ slug: 'apex' });
  assert(apex !== null, 'Apex tenant context successfully loaded');
  assert(apex?.slug === 'apex', 'Tenant slug matches apex');
  assert(apex?.name === 'Apex Academy', 'Tenant name matches Apex Academy');
  assert(apex?.currentSession?.label === '2024/2025', 'Active session resolved to 2024/2025');
  assert(apex?.currentSession?.currentTerm?.name === '1st Term', 'Active term resolved to 1st Term');

  // Test 4: Unknown Subdomain Returns Null / 404 (§3.5)
  console.log('\nTest Suite 4: Non-existent Subdomain (§3.5)');
  const unknownTenant = await getTenantContext({ slug: 'non-existent-school-xyz' });
  assert(unknownTenant === null, 'Unknown tenant returns null (triggers 404, never falls through)');

  // Test 5: Feature Flag Resolution & Immediate Overrides (§8.1)
  console.log('\nTest Suite 5: Feature Flag System (§8.1)');
  // Growth plan defaults: result_pins=true, school_fees=true, custom_domain=false
  assert(apex?.hasFeature('result_pins') === true, 'Growth plan has result_pins enabled');
  assert(apex?.hasFeature('custom_domain') === false, 'Growth plan has custom_domain disabled');

  // Test override: toggle custom_domain to true for apex
  await prisma.tenantFeatureOverride.upsert({
    where: {
      tenantId_featureKey: {
        tenantId: apex!.id,
        featureKey: 'custom_domain',
      },
    },
    update: { enabled: true },
    create: {
      tenantId: apex!.id,
      featureKey: 'custom_domain',
      enabled: true,
    },
  });

  const apexWithOverride = await getTenantContext({ slug: 'apex' });
  assert(
    apexWithOverride?.hasFeature('custom_domain') === true,
    'Super admin override enables custom_domain immediately without plan change'
  );

  // Clean up override after test
  await prisma.tenantFeatureOverride.delete({
    where: {
      tenantId_featureKey: {
        tenantId: apex!.id,
        featureKey: 'custom_domain',
      },
    },
  });

  const apexRestored = await getTenantContext({ slug: 'apex' });
  assert(
    apexRestored?.hasFeature('custom_domain') === false,
    'Removing override immediately reverts to plan default'
  );

  // Test 6: Contiguous Class Range Filtering (§4.1)
  console.log('\nTest Suite 6: Class Range Filtering (§4.1)');
  const primary3 = allClassLevels.find((c) => c.name === 'Primary 3')!;
  const withinRange = await isClassLevelWithinTenantRange(apex!.id, primary3.id);
  assert(withinRange === true, 'Primary 3 is within Nursery 1 - SSS 3 range');

  console.log(`\n========================================`);
  console.log(`Total tests run: ${passed + failed}`);
  console.log(`Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
