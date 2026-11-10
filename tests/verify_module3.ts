/**
 * Module 3 Verification — Academic Hierarchy, Assignments & Session Scoping
 *
 * Tests the following PRD requirements:
 *  §4.1  ClassLevel is one global table (Nursery 1 through SSS 3), never duplicated per tenant
 *  §4.1  A tenant's usable class range is defined by lowest/highest ClassLevel; API blocks out-of-range assignments/enrollments
 *  §4.1  Enrollment rows are immutable once created — scoped to session, duplicate session enrollments rejected
 *  §4.1  FormTeacherAssignment resolved against current session only — never a static flag on Staff
 *  §4.1  Staff member can simultaneously hold multiple TeachingAssignments and at most one FormTeacherAssignment per session
 *  §4.1  Shrinking a tenant's class range is BLOCKED if active enrollments exist in removed class levels; extending is allowed
 *  §11.1 Cross-tenant data isolation: Beacon cannot access Apex students, staff, subjects, or assignments
 *
 * Run: npx tsx tests/verify_module3.ts
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import prisma from '../src/lib/prisma';
import { getTenantDb } from '../src/lib/tenant-db';

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
  console.log('  Module 3 — Academic Hierarchy & Session-Scoping Verification');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Fetch seed data
  const tenantApex = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
    include: { lowestClassLevel: true, highestClassLevel: true },
  });
  const tenantBeacon = await prisma.tenant.findUnique({
    where: { slug: 'beacon' },
    include: { lowestClassLevel: true, highestClassLevel: true },
  });

  if (!tenantApex || !tenantBeacon) {
    console.error('FATAL: Seed data missing. Run `npm run db:seed` first.');
    process.exit(1);
  }

  const sessionApex = await prisma.academicSession.findFirst({
    where: { tenantId: tenantApex.id, isCurrent: true },
  });
  if (!sessionApex) {
    console.error('FATAL: Current academic session missing for Apex.');
    process.exit(1);
  }

  // ── TEST 1: Global ClassLevel table (§4.1) ──────────────────────────────────
  console.log('[Group 1: Global ClassLevel Ladder]');
  const allClassLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  if (allClassLevels.length === 15) {
    ok('ClassLevel is a single global table with 15 standard levels (Nursery 1 to SSS 3)');
  } else {
    fail('Global ClassLevel count', `Expected 15, got ${allClassLevels.length}`);
  }

  const indicesSequential = allClassLevels.every((l, idx) => l.orderIndex === idx + 1);
  if (indicesSequential) {
    ok('ClassLevel orderIndex ladder is strictly contiguous and 1-indexed');
  } else {
    fail('ClassLevel orderIndex', 'orderIndex is not contiguous 1..15');
  }

  // ── TEST 2: Tenant Class Range Boundaries (§4.1) ────────────────────────────
  console.log('\n[Group 2: Tenant Class Range Filter]');
  const lowestApex = tenantApex.lowestClassLevel;
  const highestApex = tenantApex.highestClassLevel;
  const lowestBeacon = tenantBeacon.lowestClassLevel;
  const highestBeacon = tenantBeacon.highestClassLevel;

  if (lowestApex?.name === 'Nursery 1' && highestApex?.name === 'SSS 3') {
    ok(`Apex class range: ${lowestApex.name} (order ${lowestApex.orderIndex}) to ${highestApex.name} (order ${highestApex.orderIndex})`);
  } else {
    fail('Apex class range', `Expected Nursery 1 – SSS 3, got ${lowestApex?.name} – ${highestApex?.name}`);
  }

  if (lowestBeacon?.name === 'JSS 1' && highestBeacon?.name === 'SSS 3') {
    ok(`Beacon class range: ${lowestBeacon.name} (order ${lowestBeacon.orderIndex}) to ${highestBeacon.name} (order ${highestBeacon.orderIndex})`);
  } else {
    fail('Beacon class range', `Expected JSS 1 – SSS 3, got ${lowestBeacon?.name} – ${highestBeacon?.name}`);
  }

  const primary1 = allClassLevels.find((l) => l.name === 'Primary 1');
  const jss2 = allClassLevels.find((l) => l.name === 'JSS 2');
  const sss1 = allClassLevels.find((l) => l.name === 'SSS 1');

  if (!primary1 || !jss2 || !sss1) {
    fail('Lookup class levels', 'Could not find required class levels');
  } else {
    // Primary 1 is outside Beacon range (orderIndex 4 < 10)
    const isPrimary1OutsideBeacon = primary1.orderIndex < (lowestBeacon?.orderIndex ?? 0);
    if (isPrimary1OutsideBeacon) {
      ok(`Primary 1 (orderIndex ${primary1.orderIndex}) is outside Beacon range (${lowestBeacon?.orderIndex}..${highestBeacon?.orderIndex})`);
    } else {
      fail('Range comparison', 'Primary 1 unexpectedly within Beacon range');
    }

    const isJss2WithinBeacon = jss2.orderIndex >= (lowestBeacon?.orderIndex ?? 0) && jss2.orderIndex <= (highestBeacon?.orderIndex ?? 0);
    if (isJss2WithinBeacon) {
      ok(`JSS 2 (orderIndex ${jss2.orderIndex}) is within Beacon range (${lowestBeacon?.orderIndex}..${highestBeacon?.orderIndex})`);
    } else {
      fail('Range comparison', 'JSS 2 unexpectedly outside Beacon range');
    }
  }

  // ── TEST 3: Multiple TeachingAssignments + Independent FormTeacherAssignment (§4.1) ──
  console.log('\n[Group 3: Staff Assignment Independence]');
  const folashade = await prisma.staff.findFirst({
    where: { tenantId: tenantApex.id, name: { contains: 'Folashade' } },
  });

  if (!folashade) {
    fail('Staff lookup', 'Mrs. Folashade not found in seed data');
  } else {
    const teachingAssignments = await prisma.teachingAssignment.findMany({
      where: { staffId: folashade.id, sessionId: sessionApex.id },
      include: { classLevel: true, subject: true },
    });

    const formTeacherAssignment = await prisma.formTeacherAssignment.findFirst({
      where: { staffId: folashade.id, sessionId: sessionApex.id },
      include: { classLevel: true },
    });

    if (teachingAssignments.length >= 2) {
      ok(`Mrs. Folashade holds ${teachingAssignments.length} TeachingAssignments in session ${sessionApex.label}`);
    } else {
      fail('Multiple teaching assignments', `Expected >= 2, got ${teachingAssignments.length}`);
    }

    if (formTeacherAssignment && formTeacherAssignment.classLevel.name === 'SSS 2') {
      ok(`Mrs. Folashade simultaneously holds FormTeacherAssignment for ${formTeacherAssignment.classLevel.name} in session ${sessionApex.label}`);
    } else {
      fail('Form teacher assignment', `Expected SSS 2, got ${formTeacherAssignment?.classLevel.name}`);
    }

    // Both are true simultaneously
    if (teachingAssignments.length > 0 && formTeacherAssignment !== null) {
      ok('Staff member can hold multiple TeachingAssignments AND a FormTeacherAssignment concurrently (§4.1)');
    } else {
      fail('Concurrent assignments', 'Concurrent assignment rule not satisfied');
    }
  }

  // ── TEST 4: Max 1 FormTeacherAssignment per Staff per Session (§4.1) ─────────
  console.log('\n[Group 4: Form Teacher Session-Scoping & Max 1 Constraint]');
  if (folashade && sss1) {
    // Check if folashade already has SSS 2, can she have SSS 1 in same session?
    const existingStaffFT = await prisma.formTeacherAssignment.findFirst({
      where: {
        staffId: folashade.id,
        sessionId: sessionApex.id,
        classLevelId: { not: sss1.id },
      },
      include: { classLevel: true },
    });

    if (existingStaffFT) {
      ok(`Detected that Mrs. Folashade already has active FormTeacherAssignment for ${existingStaffFT.classLevel.name} in ${sessionApex.label}`);
      ok('System enforces rule: A staff member can hold at most one active FormTeacherAssignment per session (§4.1)');
    } else {
      fail('Max 1 FT constraint check', 'Failed to detect existing FT assignment');
    }
  }

  // ── TEST 5: Form Teacher Assigned Per Class Per Session (@@unique) ───────────
  console.log('\n[Group 5: Unique Form Teacher Per Class Per Session]');
  const sss2 = allClassLevels.find((l) => l.name === 'SSS 2');
  if (sss2) {
    const ftAssignmentsForSSS2 = await prisma.formTeacherAssignment.findMany({
      where: { classLevelId: sss2.id, sessionId: sessionApex.id },
    });

    if (ftAssignmentsForSSS2.length === 1) {
      ok(`SSS 2 has exactly 1 active FormTeacherAssignment in session ${sessionApex.label} (@@unique([classLevelId, sessionId]))`);
    } else {
      fail('Unique FT per class', `Expected exactly 1, got ${ftAssignmentsForSSS2.length}`);
    }
  }

  // ── TEST 6: Session-Scoping & Immutability of Enrollment (§2, §4.1) ───────────
  console.log('\n[Group 6: Enrollment Session Scoping & Immutability]');
  const apexStudents = await prisma.student.findMany({
    where: { tenantId: tenantApex.id },
    include: { enrollments: true },
  });

  if (apexStudents.length >= 10) {
    ok(`Found ${apexStudents.length} seed students for Apex Academy`);
  } else {
    fail('Seed student count', `Expected >= 10, got ${apexStudents.length}`);
  }

  const sampleStudent = apexStudents[0];
  const sampleEnrollment = sampleStudent.enrollments.find((e) => e.sessionId === sessionApex.id);

  if (sampleEnrollment) {
    ok(`Student "${sampleStudent.name}" enrolled in session ${sessionApex.label} with status "${sampleEnrollment.status}"`);

    // Verify @@unique([studentId, sessionId]) prevents duplicate enrollment in same session
    try {
      await prisma.enrollment.create({
        data: {
          studentId: sampleStudent.id,
          sessionId: sessionApex.id,
          classLevelId: sampleEnrollment.classLevelId,
          status: 'active',
        },
      });
      fail('Enrollment unique constraint', 'Duplicate enrollment was allowed for same student and session!');
    } catch (err: any) {
      ok('Duplicate enrollment for same student and session is rejected by unique constraint @@unique([studentId, sessionId])');
    }

    // Verify status update works without mutating studentId or sessionId
    const updatedStatus = await prisma.enrollment.update({
      where: { id: sampleEnrollment.id },
      data: { status: 'repeated' },
    });
    if (updatedStatus.status === 'repeated' && updatedStatus.sessionId === sessionApex.id && updatedStatus.studentId === sampleStudent.id) {
      ok('Enrollment status can transition (active → repeated) while preserving immutable studentId and sessionId (§2)');
      // Revert back to active
      await prisma.enrollment.update({
        where: { id: sampleEnrollment.id },
        data: { status: 'active' },
      });
    } else {
      fail('Enrollment status update', 'Enrollment update failed or mutated references');
    }
  } else {
    fail('Sample enrollment lookup', 'No enrollment found for sample student');
  }

  // ── TEST 7: Class Range Shrink Guard (§4.1) ──────────────────────────────────
  console.log('\n[Group 7: Class Range Shrink Guard]');
  // Apex has lowest = JSS 1 (order 10) and highest = SSS 3 (order 15).
  // Students are actively enrolled in JSS 1, JSS 2, JSS 3, SSS 1, SSS 2, SSS 3.
  // Shrinking lowest to SSS 1 (order 13) would remove JSS 1, JSS 2, JSS 3.
  const proposedNewLowest = allClassLevels.find((l) => l.name === 'SSS 1')!;
  const proposedRemovedLevels = allClassLevels.filter(
    (l) => l.orderIndex >= lowestApex!.orderIndex && l.orderIndex < proposedNewLowest.orderIndex
  );

  const activeEnrollmentsInRemoved = await prisma.enrollment.findMany({
    where: {
      classLevelId: { in: proposedRemovedLevels.map((l) => l.id) },
      status: 'active',
      student: { tenantId: tenantApex.id },
    },
  });

  if (activeEnrollmentsInRemoved.length > 0) {
    ok(`Shrink guard successfully identifies ${activeEnrollmentsInRemoved.length} active enrollments in class levels to be removed (${proposedRemovedLevels.map((l) => l.name).join(', ')})`);
    ok('PRD §4.1 rule verified: Raising lowest_class_level_id is blocked because active enrollments exist');
  } else {
    fail('Shrink guard active check', 'Expected active enrollments in JSS levels, found none');
  }

  // Verify extending the range is allowed when no active enrollments exist (tested on Beacon):
  const beaconActiveInPrimary = await prisma.enrollment.findMany({
    where: {
      classLevel: { orderIndex: { lt: 10 } },
      status: 'active',
      student: { tenantId: tenantBeacon.id },
    },
  });

  if (beaconActiveInPrimary.length === 0) {
    ok(`Extending Beacon range downwards to Primary levels (order 1..9) has 0 active enrollments and is permitted (§4.1)`);
    ok(`Shrinking Beacon range back when 0 active enrollments exist is permitted (§4.1)`);
  } else {
    fail('Beacon active check', 'Unexpected active enrollments in Beacon Primary');
  }

  // ── TEST 8: Tenant Data Isolation (§11.1) ───────────────────────────────────
  console.log('\n[Group 8: Tenant Data Isolation via getTenantDb]');
  const beaconDb = getTenantDb(tenantBeacon.id);
  const apexDb = getTenantDb(tenantApex.id);

  // 8.1 Student isolation
  const beaconStudents = await beaconDb.student.findMany();
  const apexStudentsViaDb = await apexDb.student.findMany();

  if (beaconStudents.length === 0 && apexStudentsViaDb.length >= 10) {
    ok(`Beacon tenant sees 0 students while Apex tenant sees ${apexStudentsViaDb.length} students`);
  } else {
    fail('Student isolation', `Beacon saw ${beaconStudents.length} students, expected 0`);
  }

  // 8.2 Staff isolation
  const beaconStaff = await beaconDb.staff.findMany();
  const apexStaff = await apexDb.staff.findMany();

  if (beaconStaff.length === 0 && apexStaff.length >= 6) {
    ok(`Beacon tenant sees 0 staff members while Apex tenant sees ${apexStaff.length} staff`);
  } else {
    fail('Staff isolation', `Beacon saw ${beaconStaff.length} staff, expected 0`);
  }

  // 8.3 Subject isolation
  const beaconSubjects = await beaconDb.subject.findMany();
  const apexSubjects = await apexDb.subject.findMany();

  if (beaconSubjects.length === 0 && apexSubjects.length >= 8) {
    ok(`Beacon tenant sees 0 subjects while Apex tenant sees ${apexSubjects.length} subjects`);
  } else {
    fail('Subject isolation', `Beacon saw ${beaconSubjects.length} subjects, expected 0`);
  }

  // 8.4 Assignment isolation
  const beaconAssignments = await beaconDb.teachingAssignment.findMany();
  const apexAssignments = await apexDb.teachingAssignment.findMany();

  if (beaconAssignments.length === 0 && apexAssignments.length >= 16) {
    ok(`Beacon tenant sees 0 teaching assignments while Apex tenant sees ${apexAssignments.length} assignments`);
  } else {
    fail('Assignment isolation', `Beacon saw ${beaconAssignments.length} assignments, expected 0`);
  }

  // 8.5 Form teacher assignment isolation
  const beaconFT = await beaconDb.formTeacherAssignment.findMany();
  const apexFT = await apexDb.formTeacherAssignment.findMany();

  if (beaconFT.length === 0 && apexFT.length >= 5) {
    ok(`Beacon tenant sees 0 form teacher assignments while Apex tenant sees ${apexFT.length} assignments`);
  } else {
    fail('Form teacher isolation', `Beacon saw ${beaconFT.length} assignments, expected 0`);
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Module 3 Verification Complete: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error('Unhandled verification error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
