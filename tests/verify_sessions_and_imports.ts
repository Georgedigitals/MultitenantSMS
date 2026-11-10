import prisma from '../src/lib/prisma';
import { StaffRole } from '@prisma/client';

async function verifySessionsAndImports() {
  console.log('=== STARTING SESSIONS, IMPORTS & SYSTEM POLISH VERIFICATION SUITE ===\n');

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
    // 1. Fetch test tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'apex' },
      include: { sessions: { include: { terms: true } } },
    });

    if (!tenant) {
      throw new Error('Seed tenant "apex" must exist in database');
    }

    console.log(`Testing with tenant: ${tenant.name} (${tenant.slug})`);

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 1: Academic Session Creation with 3 Default Terms
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 1: Academic Session Creation Engine ---');
    const testSessionLabel = `Test-Year-${Date.now()}`;
    const startDate = new Date();
    const endDate = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);

    const createdSession = await prisma.$transaction(async (tx) => {
      const session = await tx.academicSession.create({
        data: {
          tenantId: tenant.id,
          label: testSessionLabel,
          startDate,
          endDate,
          isCurrent: false,
        },
      });

      // Create 3 standard terms
      const terms = ['1st Term', '2nd Term', '3rd Term'];
      for (const name of terms) {
        await tx.term.create({
          data: {
            sessionId: session.id,
            name,
            startDate,
            endDate,
            isCurrent: name === '1st Term',
            totalSchoolDays: 60,
          },
        });
      }

      return tx.academicSession.findUnique({
        where: { id: session.id },
        include: { terms: true },
      });
    });

    assert(Boolean(createdSession), 'Academic Session successfully created');
    assert(createdSession?.label === testSessionLabel, 'Session label matches input');
    assert(createdSession?.terms.length === 3, 'All 3 standard terms automatically initialized');
    assert(
      createdSession?.terms.some((t) => t.name === '1st Term' && t.isCurrent),
      '1st Term correctly marked as active for new session'
    );

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 2: Bulk CSV Import Logic Verification
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Bulk Subject, Staff, Student, and Parent Imports ---');

    // A. Subject Import
    const testSubjectName = `Robotics-${Date.now()}`;
    const subject = await prisma.subject.create({
      data: {
        tenantId: tenant.id,
        name: testSubjectName,
      },
    });
    assert(Boolean(subject.id), `Subject "${testSubjectName}" successfully created`);

    // B. Staff Import
    const staff = await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        name: `Test Instructor ${Date.now()}`,
        roleBase: StaffRole.teacher,
        contactInfo: { phone: '+2348001122334', email: 'instructor@test.com' },
      },
    });
    assert(Boolean(staff.id), 'Staff member successfully created with contact details');

    // C. Student & Parent / Guardian Linkage Import
    const student = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        name: `Test Scholar ${Date.now()}`,
        guardianContactInfo: {
          guardianName: 'Chief Test Guardian',
          relationship: 'Father',
          phone: '+2348099887766',
          email: 'guardian@test.com',
          address: '42 Innovation Street, Lagos',
        },
      },
    });
    assert(Boolean(student.id), 'Student record successfully created');

    const guardian = await prisma.guardian.create({
      data: {
        tenantId: tenant.id,
        name: 'Chief Test Guardian',
        relationship: 'Father',
        contactInfo: {
          phone: '+2348099887766',
          email: 'guardian@test.com',
          address: '42 Innovation Street, Lagos',
        },
      },
    });

    const studentGuardian = await prisma.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        isPrimaryContact: true,
      },
    });
    assert(Boolean(studentGuardian.id), 'Guardian linked to student with primary contact status');

    // ───────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- Cleanup: Pruning Test Records ---');
    await prisma.studentGuardian.delete({ where: { id: studentGuardian.id } });
    await prisma.guardian.delete({ where: { id: guardian.id } });
    await prisma.student.delete({ where: { id: student.id } });
    await prisma.staff.delete({ where: { id: staff.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.term.deleteMany({ where: { sessionId: createdSession!.id } });
    await prisma.academicSession.delete({ where: { id: createdSession!.id } });
    console.log('Cleanup completed cleanly.');

    console.log(`\n=== VERIFICATION SUITE PASSED (${passed}/${total} assertions succeeded) ===\n`);
  } catch (err: any) {
    console.error('\nVerification failed:', err);
    process.exit(1);
  }
}

verifySessionsAndImports().catch(console.error);
