import prisma from '../src/lib/prisma';
import {
  exportTenantDataJSON,
  exportTenantStudentsCSV,
  exportTenantResultsCSV,
  exportTenantFeesCSV,
} from '../src/lib/export';

async function verifyModule14() {
  console.log('=== STARTING MODULE 14 VERIFICATION SUITE ===\n');

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
    // 1. Fetch seeded tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'apex' },
      include: { plan: true },
    });

    if (!tenant) {
      throw new Error('Seed tenant apex must exist to run Module 14 verification');
    }

    console.log(`Testing with tenant: ${tenant.name} (${tenant.slug})`);

    // Test 1: Full JSON Data Export (§11.7, §11.8)
    console.log('\n--- Test 1: Full JSON Data Export ---');
    const jsonDump = await exportTenantDataJSON(tenant.id);

    assert(Boolean(jsonDump.exportedAt), 'JSON dump contains exportedAt timestamp');
    assert(jsonDump.schemaVersion === '1.0', 'JSON dump schemaVersion is 1.0');
    assert(jsonDump.tenant.id === tenant.id, 'JSON dump tenant.id matches target tenant');
    assert(jsonDump.tenant.slug === 'apex', 'JSON dump tenant.slug matches apex');
    assert(Array.isArray(jsonDump.academicSessions), 'JSON dump contains academicSessions array');
    assert(Array.isArray(jsonDump.staff), 'JSON dump contains staff array');
    assert(Array.isArray(jsonDump.students), 'JSON dump contains students array');
    assert(Array.isArray(jsonDump.academicResults), 'JSON dump contains academicResults array');
    assert(Array.isArray(jsonDump.feeItems), 'JSON dump contains feeItems array');
    assert(Array.isArray(jsonDump.feePayments), 'JSON dump contains feePayments array');

    console.log('  JSON Export Summary:', {
      tenant: jsonDump.tenant.name,
      studentsCount: jsonDump.students.length,
      staffCount: jsonDump.staff.length,
      resultsCount: jsonDump.academicResults.length,
      feePaymentsCount: jsonDump.feePayments.length,
    });

    // Test 2: CSV Data Exports (§11.8)
    console.log('\n--- Test 2: CSV Data Exports ---');
    const studentsCSV = await exportTenantStudentsCSV(tenant.id);
    assert(
      studentsCSV.startsWith('Student ID,Student Name,Current Class,Current Session'),
      'Students CSV header row matches expected schema'
    );

    const resultsCSV = await exportTenantResultsCSV(tenant.id);
    assert(
      resultsCSV.startsWith('Result ID,Student ID,Student Name,Session,Term'),
      'Results CSV header row matches expected schema'
    );

    const feesCSV = await exportTenantFeesCSV(tenant.id);
    assert(
      feesCSV.startsWith('Payment ID,Student ID,Student Name,Session,Term'),
      'Fees CSV header row matches expected schema'
    );

    // Test 3: Multi-Tenant Isolation Guard (§11.8)
    console.log('\n--- Test 3: Multi-Tenant Data Isolation Guard ---');
    const defaultPlan = await prisma.plan.findFirst();
    if (!defaultPlan) throw new Error('No default plan found');

    const tenantA = await prisma.tenant.create({
      data: {
        slug: 'export-test-school-a',
        name: 'Export Test School A',
        planId: defaultPlan.id,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: {
        slug: 'export-test-school-b',
        name: 'Export Test School B',
        planId: defaultPlan.id,
      },
    });

    // Create student in Tenant A
    const studentA = await prisma.student.create({
      data: {
        tenantId: tenantA.id,
        name: 'Alice Student A',
      },
    });

    // Create student in Tenant B
    const studentB = await prisma.student.create({
      data: {
        tenantId: tenantB.id,
        name: 'Bob Student B',
      },
    });

    // Verify Tenant A dump contains ONLY student A
    const dumpA = await exportTenantDataJSON(tenantA.id);
    const dumpAStudentIds = dumpA.students.map((s: any) => s.id);
    assert(
      dumpAStudentIds.includes(studentA.id),
      'Tenant A export includes Tenant A student'
    );
    assert(
      !dumpAStudentIds.includes(studentB.id),
      'Tenant A export does NOT include Tenant B student'
    );

    // Verify Tenant B dump contains ONLY student B
    const dumpB = await exportTenantDataJSON(tenantB.id);
    const dumpBStudentIds = dumpB.students.map((s: any) => s.id);
    assert(
      dumpBStudentIds.includes(studentB.id),
      'Tenant B export includes Tenant B student'
    );
    assert(
      !dumpBStudentIds.includes(studentA.id),
      'Tenant B export does NOT include Tenant A student'
    );

    // Clean up isolation test records
    console.log('\nCleaning up isolation test records...');
    await prisma.student.deleteMany({ where: { id: { in: [studentA.id, studentB.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    console.log('Cleanup completed.');

    console.log(`\n=== MODULE 14 VERIFICATION SUCCESSFUL (${passed}/${total} tests passed) ===`);
  } catch (err) {
    console.error(`\n❌ MODULE 14 VERIFICATION FAILED (${passed}/${total} passed):`, err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyModule14();
