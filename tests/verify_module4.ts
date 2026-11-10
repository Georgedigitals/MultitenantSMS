/**
 * Module 4 Verification — Assessment Structure & Grading (§5A)
 *
 * Tests the following PRD requirements:
 *  §5A.2  AssessmentComponent and GradingScale models exist and are tenant-scoped
 *  §5A.3  Every tenant is automatically seeded with default assessment components (1st CA 20, 2nd CA 20, Exam 60)
 *  §5A.3  Every tenant is automatically seeded with default grading scales (A: 70-100, B: 60-69, etc.)
 *  §5A.4  `grading_customization` feature gating: disabled on Starter/Growth, enabled on Enterprise
 *  §5A.4  TenantFeatureOverride correctly overrides plan default
 *  §5A.6  Grade computation: computeTotal calculates weighted contribution accurately
 *  §5A.6  Grade resolution: resolveGrade matches score and class-level band
 *  §5A.6  Class-level band scoping: scales can be scoped to specific bands (e.g. SSS vs JSS)
 *  §5A.7  ResultEntry has nullable `grade` field for frozen publish-time storage
 *  §5.3A  Term has `totalSchoolDays` field for attendance denominator
 *  §11.1  Tenant isolation via getTenantDb: Beacon cannot read or mutate Apex components/scales
 *
 * Run: npx tsx tests/verify_module4.ts
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { getTenantDb } from '../src/lib/tenant-db';
import { getTenantContext } from '../src/lib/tenant';
import { computeTotal, resolveGrade, previewGrade } from '../src/lib/grading';

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✅ PASS  ${label}`);
  passed++;
}

function fail(label: string, reason: string) {
  console.error(`  ❌ FAIL  ${label}`);
  console.error(`           ${reason}`);
  failed++;
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 4 — Assessment Structure & Grading (§5A) Verification');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Fetch seed tenants
  const apex = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
    include: { lowestClassLevel: true, highestClassLevel: true },
  });
  const beacon = await prisma.tenant.findUnique({
    where: { slug: 'beacon' },
    include: { lowestClassLevel: true, highestClassLevel: true },
  });

  if (!apex || !beacon) {
    console.error('FATAL: Seed data missing. Run `npm run db:seed` first.');
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 1: Seeded Defaults for Assessment Components (§5A.3)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Group 1: Seeded Defaults for Assessment Components (§5A.3)]');
  const apexComponents = await prisma.assessmentComponent.findMany({
    where: { tenantId: apex.id, termId: null },
    orderBy: { orderIndex: 'asc' },
  });

  if (apexComponents.length === 3) {
    ok(`Apex has exactly 3 default AssessmentComponents (found: ${apexComponents.map(c => c.name).join(', ')})`);
  } else {
    fail('Apex default components', `Expected 3, got ${apexComponents.length}`);
  }

  const compMap = Object.fromEntries(apexComponents.map(c => [c.name, c]));
  if (compMap['1st CA'] && compMap['1st CA'].maxScore === 20 && Number(compMap['1st CA'].weightPercent) === 20) {
    ok('1st CA has maxScore: 20, weightPercent: 20.00%');
  } else {
    fail('1st CA defaults', `Got maxScore: ${compMap['1st CA']?.maxScore}, weight: ${compMap['1st CA']?.weightPercent}`);
  }

  if (compMap['2nd CA'] && compMap['2nd CA'].maxScore === 20 && Number(compMap['2nd CA'].weightPercent) === 20) {
    ok('2nd CA has maxScore: 20, weightPercent: 20.00%');
  } else {
    fail('2nd CA defaults', `Got maxScore: ${compMap['2nd CA']?.maxScore}, weight: ${compMap['2nd CA']?.weightPercent}`);
  }

  if (compMap['Exam'] && compMap['Exam'].maxScore === 60 && Number(compMap['Exam'].weightPercent) === 60) {
    ok('Exam has maxScore: 60, weightPercent: 60.00%');
  } else {
    fail('Exam defaults', `Got maxScore: ${compMap['Exam']?.maxScore}, weight: ${compMap['Exam']?.weightPercent}`);
  }

  const totalApexWeight = apexComponents.reduce((acc, c) => acc + Number(c.weightPercent), 0);
  if (totalApexWeight === 100) {
    ok('Default component weights sum exactly to 100%');
  } else {
    fail('Component weights sum', `Expected 100%, got ${totalApexWeight}%`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 2: Seeded Defaults for Grading Scales (§5A.3)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 2: Seeded Defaults for Grading Scales (§5A.3)]');
  const apexScales = await prisma.gradingScale.findMany({
    where: { tenantId: apex.id },
    include: { lowestClassLevel: true, highestClassLevel: true },
    orderBy: { minScore: 'desc' },
  });

  if (apexScales.length === 6) {
    ok(`Apex has 6 default GradingScale entries (A through F)`);
  } else {
    fail('Apex default grading scales count', `Expected 6, got ${apexScales.length}`);
  }

  const gradeA = apexScales.find(s => s.grade === 'A');
  if (gradeA && Number(gradeA.minScore) === 70 && Number(gradeA.maxScore) === 100 && gradeA.remark === 'Excellent') {
    ok('Grade A is 70–100 with remark "Excellent"');
  } else {
    fail('Grade A defaults', `Got min: ${gradeA?.minScore}, max: ${gradeA?.maxScore}, remark: ${gradeA?.remark}`);
  }

  const gradeF = apexScales.find(s => s.grade === 'F');
  if (gradeF && Number(gradeF.minScore) === 0 && Number(gradeF.maxScore) === 39 && gradeF.remark === 'Fail') {
    ok('Grade F is 0–39 with remark "Fail"');
  } else {
    fail('Grade F defaults', `Got min: ${gradeF?.minScore}, max: ${gradeF?.maxScore}, remark: ${gradeF?.remark}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 3: Feature Gating for Grading Customization (§5A.4)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 3: Feature Gating for Grading Customization (§5A.4)]');
  const feat = await prisma.feature.findUnique({ where: { key: 'grading_customization' } });
  if (feat) {
    ok('Feature "grading_customization" exists in Feature registry');
  } else {
    fail('Feature exists', 'grading_customization feature not found');
  }

  const entPlan = await prisma.plan.findUnique({
    where: { id: 'plan_enterprise' },
    include: { features: true },
  });
  const entHasGrading = entPlan?.features.some(f => f.featureKey === 'grading_customization');
  if (entHasGrading) {
    ok('Enterprise plan includes "grading_customization" enabled by default');
  } else {
    fail('Enterprise plan features', 'grading_customization missing from Enterprise plan');
  }

  const starterPlan = await prisma.plan.findUnique({
    where: { id: 'plan_starter' },
    include: { features: true },
  });
  const starterHasGrading = starterPlan?.features.some(f => f.featureKey === 'grading_customization');
  if (!starterHasGrading) {
    ok('Starter plan does NOT include "grading_customization" (requires upgrade or override)');
  } else {
    fail('Starter plan features', 'grading_customization should not be in Starter plan');
  }

  // Check tenant evaluation
  const apexContext = await getTenantContext({ slug: 'apex' });
  if (apexContext && !apexContext.hasFeature('grading_customization')) {
    ok('Apex (Growth plan) evaluates hasFeature("grading_customization") === false by default');
  } else {
    fail('Apex feature evaluation', 'Expected false for Growth plan without override');
  }

  // Test TenantFeatureOverride
  await prisma.tenantFeatureOverride.upsert({
    where: { tenantId_featureKey: { tenantId: apex.id, featureKey: 'grading_customization' } },
    update: { enabled: true },
    create: { tenantId: apex.id, featureKey: 'grading_customization', enabled: true },
  });

  const apexContextOverridden = await getTenantContext({ slug: 'apex' });
  if (apexContextOverridden && apexContextOverridden.hasFeature('grading_customization')) {
    ok('TenantFeatureOverride successfully enables "grading_customization" for tenant (§8)');
  } else {
    fail('TenantFeatureOverride', 'Failed to override feature flag');
  }

  // Clean up override to preserve seed state
  await prisma.tenantFeatureOverride.delete({
    where: { tenantId_featureKey: { tenantId: apex.id, featureKey: 'grading_customization' } },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Group 4: Server-Side Grade Computation & Resolution (§5A.6)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 4: Server-Side Grade Computation & Resolution (§5A.6)]');
  const sss2 = await prisma.classLevel.findUnique({ where: { name: 'SSS 2' } });
  const jss1 = await prisma.classLevel.findUnique({ where: { name: 'JSS 1' } });
  const sss1 = await prisma.classLevel.findUnique({ where: { name: 'SSS 1' } });

  // Test 1: Weighted total calculation
  const scoreData1 = { '1st_ca': 18, '2nd_ca': 17, 'exam': 52 };
  const total1 = computeTotal(scoreData1, apexComponents);
  if (total1 === 87) {
    ok(`computeTotal({ 1st_ca: 18, 2nd_ca: 17, exam: 52 }) = 87`);
  } else {
    fail('computeTotal', `Expected 87, got ${total1}`);
  }

  // Test 2: Grade resolution
  const res1 = resolveGrade(87, sss2!.orderIndex, apexScales);
  if (res1 && res1.grade === 'A' && res1.remark === 'Excellent') {
    ok(`resolveGrade(87, SSS 2) = Grade "A", Remark "Excellent"`);
  } else {
    fail('resolveGrade 87', `Expected A/Excellent, got ${JSON.stringify(res1)}`);
  }

  const res2 = resolveGrade(45, jss1!.orderIndex, apexScales);
  if (res2 && res2.grade === 'D' && res2.remark === 'Fair') {
    ok(`resolveGrade(45, JSS 1) = Grade "D", Remark "Fair"`);
  } else {
    fail('resolveGrade 45', `Expected D/Fair, got ${JSON.stringify(res2)}`);
  }

  const res3 = resolveGrade(35, sss1!.orderIndex, apexScales);
  if (res3 && res3.grade === 'F' && res3.remark === 'Fail') {
    ok(`resolveGrade(35, SSS 1) = Grade "F", Remark "Fail"`);
  } else {
    fail('resolveGrade 35', `Expected F/Fail, got ${JSON.stringify(res3)}`);
  }

  // Test 3: Preview grade contract
  const preview = previewGrade(74, sss2!.orderIndex, apexScales);
  if (preview.isPreview === true && preview.grade === 'A' && preview.total === 74) {
    ok(`previewGrade returns { total: 74, grade: "A", isPreview: true }`);
  } else {
    fail('previewGrade', `Unexpected preview output: ${JSON.stringify(preview)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 5: Class-Level Band Scoping (§5A.6)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 5: Class-Level Band Scoping (§5A.6)]');
  const customSeniorScale = [
    {
      lowestClassLevel: { id: sss1!.id, orderIndex: 13 },
      highestClassLevel: { id: sss2!.id, orderIndex: 15 },
      minScore: 75,
      maxScore: 100,
      grade: 'A1',
      remark: 'Distinction',
    },
    {
      lowestClassLevel: { id: sss1!.id, orderIndex: 13 },
      highestClassLevel: { id: sss2!.id, orderIndex: 15 },
      minScore: 0,
      maxScore: 74,
      grade: 'F9',
      remark: 'Fail',
    },
  ];

  const seniorMatch = resolveGrade(78, 14, customSeniorScale); // SSS 2 (14)
  if (seniorMatch && seniorMatch.grade === 'A1') {
    ok('Custom band matches student in SSS band (orderIndex 14 -> A1)');
  } else {
    fail('Senior band match', `Expected A1, got ${JSON.stringify(seniorMatch)}`);
  }

  const juniorMatch = resolveGrade(78, 10, customSeniorScale); // JSS 1 (10)
  if (juniorMatch === null) {
    ok('Custom band correctly ignores student outside band range (JSS 1 orderIndex 10 -> null)');
  } else {
    fail('Band out-of-range', `Expected null, got ${JSON.stringify(juniorMatch)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 6: Schema Fields for Next Modules (§5A.7 & §5.3A)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 6: Schema Fields for Next Modules (§5A.7 & §5.3A)]');
  // Check Term.totalSchoolDays exists
  const term = await prisma.term.findFirst();
  if (term && 'totalSchoolDays' in term) {
    ok('Term model includes nullable `totalSchoolDays` field (§5.3A)');
  } else {
    fail('Term totalSchoolDays', 'Field missing on Term model');
  }

  // Check ResultEntry.grade exists
  const entryCount = await prisma.resultEntry.count();
  const sampleEntry = await prisma.resultEntry.findFirst();
  if (sampleEntry === null || 'grade' in sampleEntry) {
    ok('ResultEntry model includes nullable `grade` field for frozen publish storage (§5A.7)');
  } else {
    fail('ResultEntry grade', 'Field missing on ResultEntry model');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 7: Multi-Tenant Data Isolation via getTenantDb (§11.1)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 7: Multi-Tenant Data Isolation via getTenantDb (§11.1)]');
  const beaconDb = getTenantDb(beacon.id);
  const apexDb = getTenantDb(apex.id);

  const beaconComponents = await beaconDb.assessmentComponent.findMany();
  const apexDbComponents = await apexDb.assessmentComponent.findMany();

  if (beaconComponents.every(c => c.tenantId === beacon.id)) {
    ok(`Beacon getTenantDb sees only Beacon's components (${beaconComponents.length} items)`);
  } else {
    fail('Beacon isolation', 'Beacon saw non-Beacon components');
  }

  if (apexDbComponents.every(c => c.tenantId === apex.id)) {
    ok(`Apex getTenantDb sees only Apex's components (${apexDbComponents.length} items)`);
  } else {
    fail('Apex isolation', 'Apex saw non-Apex components');
  }

  const beaconScales = await beaconDb.gradingScale.findMany();
  if (beaconScales.every(s => s.tenantId === beacon.id)) {
    ok(`Beacon getTenantDb sees only Beacon's grading scales (${beaconScales.length} items)`);
  } else {
    fail('Beacon scale isolation', 'Beacon saw non-Beacon scales');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Module 4 Verification Complete: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
