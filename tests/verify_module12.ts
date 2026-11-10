import prisma from '../src/lib/prisma';
import {
  tenantHasFeature,
  getTenantFeatureMap,
  setTenantFeatureOverride,
  removeTenantFeatureOverride,
  updateTenantPlan,
} from '../src/lib/features';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runModule12Tests() {
  console.log('====================================================');
  console.log('  Module 12: Plans, Feature Flags & Billing Verification');
  console.log('====================================================');

  try {
    // 1. Setup Test Plans, Features, and Tenants
    console.log('\n--- Test 1: Setup Plans, Features & Tenants ---');
    const feature1 = await prisma.feature.upsert({
      where: { key: 'grading_customization' },
      update: {},
      create: {
        key: 'grading_customization',
        name: 'Grading Customization',
        description: 'Edit assessment components and grading scales',
      },
    });

    const feature2 = await prisma.feature.upsert({
      where: { key: 'school_fees' },
      update: {},
      create: {
        key: 'school_fees',
        name: 'School Fees Module',
        description: 'Manage school fee items and collection',
      },
    });

    const planBasic = await prisma.plan.create({
      data: {
        name: `Basic Plan ${Date.now()}`,
        studentCeiling: 100,
        price: 20.00,
      },
    });

    const planPro = await prisma.plan.create({
      data: {
        name: `Pro Plan ${Date.now()}`,
        studentCeiling: 500,
        price: 80.00,
      },
    });

    // Attach feature1 to Basic, feature1 + feature2 to Pro
    await prisma.planFeature.upsert({
      where: { planId_featureKey: { planId: planBasic.id, featureKey: feature1.key } },
      update: { enabledByDefault: true },
      create: { planId: planBasic.id, featureKey: feature1.key, enabledByDefault: true },
    });

    await prisma.planFeature.upsert({
      where: { planId_featureKey: { planId: planPro.id, featureKey: feature1.key } },
      update: { enabledByDefault: true },
      create: { planId: planPro.id, featureKey: feature1.key, enabledByDefault: true },
    });

    await prisma.planFeature.upsert({
      where: { planId_featureKey: { planId: planPro.id, featureKey: feature2.key } },
      update: { enabledByDefault: true },
      create: { planId: planPro.id, featureKey: feature2.key, enabledByDefault: true },
    });

    const tenantBasic = await prisma.tenant.create({
      data: {
        name: 'Basic School',
        slug: `basic-school-${Date.now()}`,
        status: 'active',
        planId: planBasic.id,
      },
    });

    assert(Boolean(tenantBasic.id), 'Created Basic Plan test tenant');

    // 2. Single Feature Check & Plan Defaults
    console.log('\n--- Test 2: Plan Defaults Resolution ---');
    const hasGradingBasic = await tenantHasFeature(tenantBasic.id, 'grading_customization');
    const hasFeesBasic = await tenantHasFeature(tenantBasic.id, 'school_fees');

    assert(hasGradingBasic === true, 'Basic tenant has grading_customization enabled via Plan default');
    assert(hasFeesBasic === false, 'Basic tenant has school_fees disabled via Plan default');

    // 3. Tenant Feature Override Precedence (§8.1)
    console.log('\n--- Test 3: Tenant Feature Override Precedence ---');
    // Enable school_fees override on Basic tenant (feature disabled by plan)
    await setTenantFeatureOverride(tenantBasic.id, 'school_fees', true);
    const hasFeesOverridden = await tenantHasFeature(tenantBasic.id, 'school_fees');
    assert(hasFeesOverridden === true, 'Tenant override (true) takes precedence over Plan default (false)');

    // Disable grading_customization override on Basic tenant (feature enabled by plan)
    await setTenantFeatureOverride(tenantBasic.id, 'grading_customization', false);
    const hasGradingOverridden = await tenantHasFeature(tenantBasic.id, 'grading_customization');
    assert(hasGradingOverridden === false, 'Tenant override (false) takes precedence over Plan default (true)');

    const featureMapOverride = await getTenantFeatureMap(tenantBasic.id);
    const feesMapItem = featureMapOverride.features.find((f) => f.key === 'school_fees');
    assert(feesMapItem?.isOverride === true, 'Feature map correctly flags school_fees as Super Admin Override');

    // 4. Reversion to Plan Default & Plan Upgrade
    console.log('\n--- Test 4: Reverting Overrides & Plan Upgrades ---');
    await removeTenantFeatureOverride(tenantBasic.id, 'school_fees');
    const hasFeesReverted = await tenantHasFeature(tenantBasic.id, 'school_fees');
    assert(hasFeesReverted === false, 'Reverted school_fees back to Plan default (false)');

    await updateTenantPlan(tenantBasic.id, planPro.id);
    const hasFeesUpgraded = await tenantHasFeature(tenantBasic.id, 'school_fees');
    assert(hasFeesUpgraded === true, 'Upgrading tenant to Pro plan enables school_fees via new Plan default');

    // 5. Codebase Audit — Zero Hardcoded Plan Checks (§8.1)
    console.log('\n--- Test 5: Codebase Audit (§8.1) ---');
    const srcDir = path.join(process.cwd(), 'src');
    
    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(scanFiles(filePath));
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
          results.push(filePath);
        }
      }
      return results;
    }

    const allSrcFiles = scanFiles(srcDir);
    let hardcodedViolations: string[] = [];
    const forbiddenPatterns = [/plan\s*===\s*['"]enterprise['"]/i, /plan\s*===\s*['"]pro['"]/i, /plan\s*===\s*['"]basic['"]/i];

    for (const file of allSrcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          hardcodedViolations.push(`${path.basename(file)}: ${pattern}`);
        }
      }
    }

    assert(hardcodedViolations.length === 0, 'Codebase contains 0 hardcoded plan name checks (all checks use tenantHasFeature)');

    // Clean up test data
    console.log('\n--- Cleaning up test records ---');
    await prisma.tenantFeatureOverride.deleteMany({ where: { tenantId: tenantBasic.id } });
    await prisma.tenant.delete({ where: { id: tenantBasic.id } });
    await prisma.planFeature.deleteMany({ where: { planId: { in: [planBasic.id, planPro.id] } } });
    await prisma.plan.deleteMany({ where: { id: { in: [planBasic.id, planPro.id] } } });

    console.log('\n====================================================');
    console.log('  ✅ ALL MODULE 12 VERIFICATION TESTS PASSED!');
    console.log('====================================================');
  } catch (error) {
    console.error('\n❌ Module 12 verification failed:', error);
    process.exit(1);
  }
  process.exit(0);
}

runModule12Tests();
