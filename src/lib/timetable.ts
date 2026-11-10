import prisma from './prisma';
export * from './timetable-types';
import { DEFAULT_PERIODS } from './timetable-types';

/**
 * Ensures the tenant has default bell schedule periods created.
 */
export async function ensureTenantPeriods(tenantId: string) {
  const count = await prisma.timetablePeriod.count({
    where: { tenantId },
  });

  if (count === 0) {
    await prisma.$transaction(async (tx) => {
      for (const p of DEFAULT_PERIODS) {
        await tx.timetablePeriod.create({
          data: {
            tenantId,
            name: p.name,
            startTime: p.startTime,
            endTime: p.endTime,
            orderIndex: p.orderIndex,
            isBreak: p.isBreak,
          },
        });
      }
    });
  }

  return prisma.timetablePeriod.findMany({
    where: { tenantId },
    orderBy: { orderIndex: 'asc' },
  });
}

/**
 * Fetches the weekly timetable for a given class level.
 */
export async function getClassTimetable(tenantId: string, classLevelId: string, sessionId?: string) {
  await ensureTenantPeriods(tenantId);

  const [periods, slots, teachingAssignments, classLevel] = await Promise.all([
    prisma.timetablePeriod.findMany({
      where: { tenantId },
      orderBy: { orderIndex: 'asc' },
    }),
    prisma.timetableSlot.findMany({
      where: {
        tenantId,
        classLevelId,
        ...(sessionId ? { sessionId } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true, roleBase: true } },
        period: true,
      },
    }),
    prisma.teachingAssignment.findMany({
      where: {
        classLevelId,
        ...(sessionId ? { sessionId } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
      },
    }),
    prisma.classLevel.findUnique({
      where: { id: classLevelId },
      select: { id: true, name: true },
    }),
  ]);

  return {
    classLevel,
    periods,
    slots,
    teachingAssignments: teachingAssignments.map((ta) => ({
      subjectId: ta.subjectId,
      subjectName: ta.subject.name,
      staffId: ta.staffId,
      staffName: ta.staff.name,
    })),
  };
}

/**
 * Checks if a teacher is already scheduled in another class at the same day & period.
 */
export async function checkTeacherClash(options: {
  tenantId: string;
  staffId: string;
  dayOfWeek: number;
  periodId: string;
  excludeClassLevelId?: string;
}) {
  const { tenantId, staffId, dayOfWeek, periodId, excludeClassLevelId } = options;

  const clash = await prisma.timetableSlot.findFirst({
    where: {
      tenantId,
      staffId,
      dayOfWeek,
      periodId,
      ...(excludeClassLevelId ? { classLevelId: { not: excludeClassLevelId } } : {}),
    },
    include: {
      classLevel: { select: { name: true } },
      subject: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });

  if (clash) {
    return {
      hasClash: true,
      message: `${clash.staff?.name || 'Teacher'} is already scheduled to teach ${clash.subject?.name || 'a subject'} in ${clash.classLevel.name} during this period!`,
      clashDetails: {
        className: clash.classLevel.name,
        subjectName: clash.subject?.name,
        teacherName: clash.staff?.name,
      },
    };
  }

  return { hasClash: false };
}

/**
 * Upserts a timetable slot for a class level.
 */
export async function saveTimetableSlot(options: {
  tenantId: string;
  classLevelId: string;
  dayOfWeek: number;
  periodId: string;
  subjectId?: string | null;
  staffId?: string | null;
  room?: string | null;
  sessionId?: string | null;
  ignoreClash?: boolean;
}) {
  const {
    tenantId,
    classLevelId,
    dayOfWeek,
    periodId,
    subjectId,
    staffId: explicitStaffId,
    room,
    sessionId,
    ignoreClash = false,
  } = options;

  // If no subjectId provided, this clears the slot
  if (!subjectId) {
    await prisma.timetableSlot.deleteMany({
      where: {
        classLevelId,
        dayOfWeek,
        periodId,
      },
    });
    return { success: true, cleared: true };
  }

  // Auto-resolve teacher from TeachingAssignment if staffId not explicitly provided
  let resolvedStaffId = explicitStaffId;
  if (!resolvedStaffId) {
    const assignment = await prisma.teachingAssignment.findFirst({
      where: {
        classLevelId,
        subjectId,
        ...(sessionId ? { sessionId } : {}),
      },
      select: { staffId: true },
    });
    if (assignment) resolvedStaffId = assignment.staffId;
  }

  // Teacher clash check
  if (resolvedStaffId && !ignoreClash) {
    const clash = await checkTeacherClash({
      tenantId,
      staffId: resolvedStaffId,
      dayOfWeek,
      periodId,
      excludeClassLevelId: classLevelId,
    });
    if (clash.hasClash) {
      return { success: false, clash: true, message: clash.message, clashDetails: clash.clashDetails };
    }
  }

  const slot = await prisma.timetableSlot.upsert({
    where: {
      classLevelId_dayOfWeek_periodId: {
        classLevelId,
        dayOfWeek,
        periodId,
      },
    },
    create: {
      tenantId,
      sessionId: sessionId || null,
      classLevelId,
      dayOfWeek,
      periodId,
      subjectId,
      staffId: resolvedStaffId || null,
      room: room || null,
    },
    update: {
      subjectId,
      staffId: resolvedStaffId || null,
      room: room !== undefined ? room : undefined,
    },
    include: {
      subject: true,
      staff: true,
      period: true,
    },
  });

  return { success: true, slot };
}

/**
 * Gets the student's active and upcoming classes for today based on current time.
 */
export async function getStudentTodaySchedule(tenantId: string, studentId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: { classLevel: true },
  });

  if (!enrollment) return null;

  const classLevelId = enrollment.classLevelId;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ... 5 = Fri

  const [periods, slots] = await Promise.all([
    prisma.timetablePeriod.findMany({
      where: { tenantId },
      orderBy: { orderIndex: 'asc' },
    }),
    prisma.timetableSlot.findMany({
      where: {
        tenantId,
        classLevelId,
        dayOfWeek: dayOfWeek >= 1 && dayOfWeek <= 5 ? dayOfWeek : 1, // Fallback to Monday if weekend
      },
      include: {
        subject: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
        period: true,
      },
    }),
  ]);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let activeSlot: any = null;
  let upcomingSlot: any = null;

  for (const slot of slots) {
    const [startH, startM] = slot.period.startTime.split(':').map(Number);
    const [endH, endM] = slot.period.endTime.split(':').map(Number);

    const slotStartMin = startH * 60 + startM;
    const slotEndMin = endH * 60 + endM;

    if (currentMinutes >= slotStartMin && currentMinutes <= slotEndMin) {
      activeSlot = slot;
    } else if (currentMinutes < slotStartMin && (!upcomingSlot || slotStartMin < upcomingSlot.startMin)) {
      upcomingSlot = { ...slot, startMin: slotStartMin };
    }
  }

  return {
    className: enrollment.classLevel.name,
    classLevelId,
    dayOfWeek,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    activeSlot,
    upcomingSlot,
    todaySlots: slots,
    periods,
  };
}

/**
 * Returns a teacher's personal weekly teaching timetable across all assigned classes.
 */
export async function getTeacherWeeklyTimetable(tenantId: string, staffId: string) {
  await ensureTenantPeriods(tenantId);

  const [periods, slots, teacher] = await Promise.all([
    prisma.timetablePeriod.findMany({
      where: { tenantId },
      orderBy: { orderIndex: 'asc' },
    }),
    prisma.timetableSlot.findMany({
      where: {
        tenantId,
        staffId,
      },
      include: {
        classLevel: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        period: true,
      },
    }),
    prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, roleBase: true },
    }),
  ]);

  return {
    teacher,
    periods,
    slots,
  };
}

/**
 * Intelligently auto-generates a balanced weekly timetable for a class level.
 * Evenly distributes assigned subjects across non-break periods (Monday-Friday),
 * prioritizing core subjects in morning slots and checking teacher clashes.
 */
export async function autoGenerateClassTimetable(options: {
  tenantId: string;
  classLevelId: string;
  sessionId?: string | null;
}) {
  const { tenantId, classLevelId, sessionId } = options;
  await ensureTenantPeriods(tenantId);

  // 1. Fetch non-break periods ordered by orderIndex
  const teachingPeriods = await prisma.timetablePeriod.findMany({
    where: { tenantId, isBreak: false },
    orderBy: { orderIndex: 'asc' },
  });

  if (teachingPeriods.length === 0) {
    throw new Error('No academic teaching periods configured. Please check Bell Schedule.');
  }

  // 2. Fetch teaching assignments for this class
  const assignments = await prisma.teachingAssignment.findMany({
    where: {
      classLevelId,
      ...(sessionId ? { sessionId } : {}),
    },
    include: {
      subject: true,
      staff: true,
    },
  });

  if (assignments.length === 0) {
    throw new Error('No subjects or teachers assigned to this class yet. Please configure subjects in the Classroom Hub first.');
  }

  // 3. Score subject priority: core academic vs afternoon practicals
  const CORE_REGEX = /(math|english|language|science|physics|chemistry|biology|economics|account|literature)/i;

  const coreAssignments = assignments.filter((a) => CORE_REGEX.test(a.subject.name));
  const otherAssignments = assignments.filter((a) => !CORE_REGEX.test(a.subject.name));

  // Build subject quota queue
  const days = [1, 2, 3, 4, 5]; // Mon - Fri
  const totalSlotsNeeded = days.length * teachingPeriods.length;

  const subjectList: Array<{ subjectId: string; staffId: string }> = [];

  // Core subjects get 4-5 slots per week
  for (const ca of coreAssignments) {
    const count = Math.min(5, Math.max(3, Math.floor(totalSlotsNeeded / assignments.length)));
    for (let i = 0; i < count; i++) {
      subjectList.push({ subjectId: ca.subjectId, staffId: ca.staffId });
    }
  }

  // Other subjects get 2-3 slots per week
  for (const oa of otherAssignments) {
    const count = Math.min(3, Math.max(1, Math.floor((totalSlotsNeeded - subjectList.length) / (otherAssignments.length || 1))));
    for (let i = 0; i < count; i++) {
      subjectList.push({ subjectId: oa.subjectId, staffId: oa.staffId });
    }
  }

  // If there are still empty slots, cycle through assignments until totalSlotsNeeded
  let cycleIdx = 0;
  while (subjectList.length < totalSlotsNeeded) {
    const a = assignments[cycleIdx % assignments.length];
    subjectList.push({ subjectId: a.subjectId, staffId: a.staffId });
    cycleIdx++;
  }

  // Fetch all existing slots across other classes to avoid teacher conflicts
  const externalSlots = await prisma.timetableSlot.findMany({
    where: {
      tenantId,
      classLevelId: { not: classLevelId },
    },
    select: {
      staffId: true,
      dayOfWeek: true,
      periodId: true,
    },
  });

  const clashSet = new Set(
    externalSlots
      .filter((s) => s.staffId)
      .map((s) => `${s.staffId}-${s.dayOfWeek}-${s.periodId}`)
  );

  // Group periods into morning (first half) and afternoon (second half)
  const halfPeriodCount = Math.ceil(teachingPeriods.length / 2);
  const morningPeriods = teachingPeriods.slice(0, halfPeriodCount);
  const afternoonPeriods = teachingPeriods.slice(halfPeriodCount);

  // Build weekly schedule grid
  const generatedSlots: Array<{
    tenantId: string;
    classLevelId: string;
    dayOfWeek: number;
    periodId: string;
    subjectId: string;
    staffId: string;
    sessionId: string | null;
  }> = [];

  const corePool = [...subjectList.filter((s) => coreAssignments.some((ca) => ca.subjectId === s.subjectId))];
  const generalPool = [...subjectList.filter((s) => !coreAssignments.some((ca) => ca.subjectId === s.subjectId))];

  function pickSubject(pool: Array<{ subjectId: string; staffId: string }>, day: number, periodId: string) {
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const key = `${candidate.staffId}-${day}-${periodId}`;
      if (!clashSet.has(key)) {
        pool.splice(i, 1);
        return candidate;
      }
    }
    return pool.shift() || assignments[0];
  }

  for (const day of days) {
    // Fill morning periods with core subjects first
    for (const p of morningPeriods) {
      const item = corePool.length > 0
        ? pickSubject(corePool, day, p.id)
        : (generalPool.length > 0 ? pickSubject(generalPool, day, p.id) : assignments[0]);

      generatedSlots.push({
        tenantId,
        classLevelId,
        dayOfWeek: day,
        periodId: p.id,
        subjectId: item.subjectId,
        staffId: item.staffId,
        sessionId: sessionId || null,
      });
    }

    // Fill afternoon periods with general/practical subjects
    for (const p of afternoonPeriods) {
      const item = generalPool.length > 0
        ? pickSubject(generalPool, day, p.id)
        : (corePool.length > 0 ? pickSubject(corePool, day, p.id) : assignments[0]);

      generatedSlots.push({
        tenantId,
        classLevelId,
        dayOfWeek: day,
        periodId: p.id,
        subjectId: item.subjectId,
        staffId: item.staffId,
        sessionId: sessionId || null,
      });
    }
  }

  // Atomically replace all slots for this class
  await prisma.$transaction(async (tx) => {
    await tx.timetableSlot.deleteMany({
      where: { classLevelId, tenantId },
    });

    for (const slot of generatedSlots) {
      await tx.timetableSlot.create({
        data: slot,
      });
    }
  });

  return {
    success: true,
    count: generatedSlots.length,
    message: `Successfully auto-generated ${generatedSlots.length} balanced period slots across Monday to Friday.`,
  };
}

/**
 * Swaps two timetable slots within the same class level.
 * Either slot may be filled or empty.
 */
export async function swapTimetableSlots(options: {
  tenantId: string;
  classLevelId: string;
  slot1: { dayOfWeek: number; periodId: string };
  slot2: { dayOfWeek: number; periodId: string };
  ignoreClash?: boolean;
}) {
  const { tenantId, classLevelId, slot1, slot2, ignoreClash = false } = options;

  const [s1, s2] = await Promise.all([
    prisma.timetableSlot.findUnique({
      where: {
        classLevelId_dayOfWeek_periodId: {
          classLevelId,
          dayOfWeek: slot1.dayOfWeek,
          periodId: slot1.periodId,
        },
      },
    }),
    prisma.timetableSlot.findUnique({
      where: {
        classLevelId_dayOfWeek_periodId: {
          classLevelId,
          dayOfWeek: slot2.dayOfWeek,
          periodId: slot2.periodId,
        },
      },
    }),
  ]);

  if (!s1 && !s2) {
    return { success: true, message: 'Both slots are empty; no swap needed.' };
  }

  // Check clash for s1 moving to slot2 position
  if (s1?.staffId && !ignoreClash) {
    const clash = await checkTeacherClash({
      tenantId,
      staffId: s1.staffId,
      dayOfWeek: slot2.dayOfWeek,
      periodId: slot2.periodId,
      excludeClassLevelId: classLevelId,
    });
    if (clash.hasClash) {
      return { success: false, clash: true, message: clash.message, clashDetails: clash.clashDetails };
    }
  }

  // Check clash for s2 moving to slot1 position
  if (s2?.staffId && !ignoreClash) {
    const clash = await checkTeacherClash({
      tenantId,
      staffId: s2.staffId,
      dayOfWeek: slot1.dayOfWeek,
      periodId: slot1.periodId,
      excludeClassLevelId: classLevelId,
    });
    if (clash.hasClash) {
      return { success: false, clash: true, message: clash.message, clashDetails: clash.clashDetails };
    }
  }

  await prisma.$transaction(async (tx) => {
    // Delete existing records first to avoid unique constraint collision
    await tx.timetableSlot.deleteMany({
      where: {
        classLevelId,
        OR: [
          { dayOfWeek: slot1.dayOfWeek, periodId: slot1.periodId },
          { dayOfWeek: slot2.dayOfWeek, periodId: slot2.periodId },
        ],
      },
    });

    if (s1) {
      await tx.timetableSlot.create({
        data: {
          tenantId,
          classLevelId,
          dayOfWeek: slot2.dayOfWeek,
          periodId: slot2.periodId,
          subjectId: s1.subjectId,
          staffId: s1.staffId,
          room: s1.room,
          sessionId: s1.sessionId,
        },
      });
    }

    if (s2) {
      await tx.timetableSlot.create({
        data: {
          tenantId,
          classLevelId,
          dayOfWeek: slot1.dayOfWeek,
          periodId: slot1.periodId,
          subjectId: s2.subjectId,
          staffId: s2.staffId,
          room: s2.room,
          sessionId: s2.sessionId,
        },
      });
    }
  });

  return { success: true, message: 'Timetable slots successfully swapped!' };
}

/**
 * Copies the timetable structure from a source class to a target class.
 * Auto-maps teachers assigned to the target class for each matching subject.
 */
export async function copyClassTimetable(options: {
  tenantId: string;
  sourceClassLevelId: string;
  targetClassLevelId: string;
  sessionId?: string | null;
}) {
  const { tenantId, sourceClassLevelId, targetClassLevelId, sessionId } = options;

  const [sourceSlots, targetAssignments] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { tenantId, classLevelId: sourceClassLevelId },
    }),
    prisma.teachingAssignment.findMany({
      where: {
        classLevelId: targetClassLevelId,
        ...(sessionId ? { sessionId } : {}),
      },
    }),
  ]);

  if (sourceSlots.length === 0) {
    throw new Error('Source class does not have any timetable slots to copy.');
  }

  const subjectTeacherMap = new Map(
    targetAssignments.map((ta) => [ta.subjectId, ta.staffId])
  );

  await prisma.$transaction(async (tx) => {
    await tx.timetableSlot.deleteMany({
      where: { tenantId, classLevelId: targetClassLevelId },
    });

    for (const slot of sourceSlots) {
      const targetStaffId = slot.subjectId ? (subjectTeacherMap.get(slot.subjectId) || null) : null;
      await tx.timetableSlot.create({
        data: {
          tenantId,
          classLevelId: targetClassLevelId,
          dayOfWeek: slot.dayOfWeek,
          periodId: slot.periodId,
          subjectId: slot.subjectId,
          staffId: targetStaffId || slot.staffId,
          room: slot.room,
          sessionId: sessionId || slot.sessionId,
        },
      });
    }
  });

  return {
    success: true,
    count: sourceSlots.length,
    message: `Successfully copied ${sourceSlots.length} timetable slots to target class.`,
  };
}

/**
 * Clears all timetable slots for a class level.
 */
export async function clearClassTimetable(options: {
  tenantId: string;
  classLevelId: string;
}) {
  const { tenantId, classLevelId } = options;

  const deleted = await prisma.timetableSlot.deleteMany({
    where: { tenantId, classLevelId },
  });

  return {
    success: true,
    count: deleted.count,
    message: `Timetable cleared (${deleted.count} slots removed).`,
  };
}
