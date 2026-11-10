import 'dotenv/config';
import prisma from '../src/lib/prisma';
import {
  ensureTenantPeriods,
  getClassTimetable,
  autoGenerateClassTimetable,
  swapTimetableSlots,
  copyClassTimetable,
  clearClassTimetable,
} from '../src/lib/timetable';

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
  console.log('  Timetable Smart Engine Verification');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const apex = await prisma.tenant.findUnique({ where: { slug: 'apex' } });
    if (!apex) {
      fail('Seed Data', 'Apex tenant missing');
      process.exit(1);
    }

    const session = await prisma.academicSession.findFirst({
      where: { tenantId: apex.id, isCurrent: true },
    });
    if (!session) {
      fail('Seed Data', 'Academic session missing for Apex');
      process.exit(1);
    }

    const classes = await prisma.classLevel.findMany({
      orderBy: { orderIndex: 'asc' },
      take: 2,
    });
    if (classes.length < 2) {
      fail('Seed Data', 'Need at least 2 classes for testing');
      process.exit(1);
    }

    const [classA, classB] = classes;

    // Ensure periods exist
    const periods = await ensureTenantPeriods(apex.id);
    if (periods.length >= 5) {
      ok(`Bell schedule periods initialized (${periods.length} periods)`);
    } else {
      fail('Bell Schedule', `Expected >= 5 periods, got ${periods.length}`);
    }

    // Ensure classA has teaching assignments
    const teachers = await prisma.staff.findMany({
      where: { tenantId: apex.id, roleBase: 'teacher' },
      take: 3,
    });
    const subjects = await prisma.subject.findMany({
      where: { tenantId: apex.id },
      take: 4,
    });

    if (teachers.length === 0 || subjects.length === 0) {
      fail('Seed Data', 'Teachers or subjects missing');
      process.exit(1);
    }

    // Set up assignments for classA
    await prisma.teachingAssignment.deleteMany({
      where: { classLevelId: classA.id },
    });

    for (let i = 0; i < subjects.length; i++) {
      await prisma.teachingAssignment.create({
        data: {
          classLevelId: classA.id,
          subjectId: subjects[i].id,
          staffId: teachers[i % teachers.length].id,
          sessionId: session.id,
        },
      });
    }
    ok(`Assigned ${subjects.length} subjects to ${classA.name}`);

    // 1. Test Auto-Generation
    const autoGenResult = await autoGenerateClassTimetable({
      tenantId: apex.id,
      classLevelId: classA.id,
      sessionId: session.id,
    });

    if (autoGenResult.success && autoGenResult.count > 0) {
      ok(`Auto-generate produced ${autoGenResult.count} periods across Monday to Friday`);
    } else {
      fail('Auto-generate', 'Auto-generation returned 0 slots or failed');
    }

    // Verify slots in DB
    const slotsA = await prisma.timetableSlot.findMany({
      where: { tenantId: apex.id, classLevelId: classA.id },
    });
    if (slotsA.length === autoGenResult.count) {
      ok(`Database holds exactly ${slotsA.length} slots for ${classA.name}`);
    } else {
      fail('Slot Verification', `DB has ${slotsA.length}, expected ${autoGenResult.count}`);
    }

    // 2. Test Slot Swapper
    if (slotsA.length >= 2) {
      const slot1 = { dayOfWeek: slotsA[0].dayOfWeek, periodId: slotsA[0].periodId };
      const slot2 = { dayOfWeek: slotsA[1].dayOfWeek, periodId: slotsA[1].periodId };
      const s1SubjBefore = slotsA[0].subjectId;
      const s2SubjBefore = slotsA[1].subjectId;

      const swapRes = await swapTimetableSlots({
        tenantId: apex.id,
        classLevelId: classA.id,
        slot1,
        slot2,
      });

      if (swapRes.success) {
        // Verify slots swapped
        const s1After = await prisma.timetableSlot.findUnique({
          where: {
            classLevelId_dayOfWeek_periodId: {
              classLevelId: classA.id,
              dayOfWeek: slot1.dayOfWeek,
              periodId: slot1.periodId,
            },
          },
        });
        const s2After = await prisma.timetableSlot.findUnique({
          where: {
            classLevelId_dayOfWeek_periodId: {
              classLevelId: classA.id,
              dayOfWeek: slot2.dayOfWeek,
              periodId: slot2.periodId,
            },
          },
        });

        if (s1After?.subjectId === s2SubjBefore && s2After?.subjectId === s1SubjBefore) {
          ok('Slot Swapper atomically exchanged subject positions between two periods');
        } else {
          fail('Slot Swapper', 'Slots did not swap subjects properly');
        }
      } else {
        fail('Slot Swapper', swapRes.message || 'Swap failed');
      }
    }

    // 3. Test Copy Class Timetable
    const copyResult = await copyClassTimetable({
      tenantId: apex.id,
      sourceClassLevelId: classA.id,
      targetClassLevelId: classB.id,
      sessionId: session.id,
    });

    if (copyResult.success && copyResult.count > 0) {
      const slotsB = await prisma.timetableSlot.findMany({
        where: { tenantId: apex.id, classLevelId: classB.id },
      });
      if (slotsB.length === copyResult.count) {
        ok(`Copy Class successfully replicated ${slotsB.length} slots from ${classA.name} to ${classB.name}`);
      } else {
        fail('Copy Class', `Target class has ${slotsB.length} slots, expected ${copyResult.count}`);
      }
    } else {
      fail('Copy Class', 'Copy class returned false or count 0');
    }

    // 4. Test Clear All Slots
    const clearResult = await clearClassTimetable({
      tenantId: apex.id,
      classLevelId: classB.id,
    });

    if (clearResult.success) {
      const slotsBAfter = await prisma.timetableSlot.count({
        where: { tenantId: apex.id, classLevelId: classB.id },
      });
      if (slotsBAfter === 0) {
        ok(`Clear Timetable cleanly removed all slots (${clearResult.count} slots deleted)`);
      } else {
        fail('Clear Timetable', `Still found ${slotsBAfter} slots after clearing`);
      }
    } else {
      fail('Clear Timetable', 'Clear timetable failed');
    }

    // 5. Verify getClassTimetable API shape
    const timetableData = await getClassTimetable(apex.id, classA.id, session.id);
    if (timetableData.periods.length > 0 && timetableData.slots.length > 0 && timetableData.teachingAssignments.length > 0) {
      ok('getClassTimetable returns complete structure (periods, slots, teachingAssignments, classLevel)');
    } else {
      fail('getClassTimetable', 'Structure missing expected fields');
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`  Timetable Verification Complete: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════════════════\n');
  } catch (err: any) {
    fail('Unexpected Exception', err.message || String(err));
  } finally {
    await prisma.$disconnect();
  }
}

run();

