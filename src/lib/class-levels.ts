import prisma from '@/lib/prisma';
export {
  EDUCATION_SYSTEM_PRESETS,
  getPresetByKey,
  type EducationSystemKey,
  type EducationSystemPreset,
} from '@/lib/class-level-presets';

/**
 * Returns the ordered ClassLevel records for a tenant.
 * - If the tenant has created/seeded its own tenant-owned ClassLevels, returns those.
 * - Otherwise falls back cleanly to legacy global ClassLevels (tenantId: null),
 *   optionally filtered to the tenant's lowestClassLevelId..highestClassLevelId range.
 */
export async function getTenantClassLevels(
  tenantId: string,
  options?: { filterLegacyByRange?: boolean }
) {
  const owned = await prisma.classLevel.findMany({
    where: { tenantId },
    orderBy: { orderIndex: 'asc' },
  });

  if (owned.length > 0) {
    return owned;
  }

  const globalLevels = await prisma.classLevel.findMany({
    where: { tenantId: null },
    orderBy: { orderIndex: 'asc' },
  });

  if (!options?.filterLegacyByRange) {
    return globalLevels;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { lowestClassLevelId: true, highestClassLevelId: true },
  });

  if (!tenant?.lowestClassLevelId || !tenant?.highestClassLevelId) {
    return globalLevels;
  }

  const lowest = globalLevels.find((l) => l.id === tenant.lowestClassLevelId);
  const highest = globalLevels.find((l) => l.id === tenant.highestClassLevelId);
  if (!lowest || !highest) return globalLevels;

  return globalLevels.filter(
    (l) => l.orderIndex >= lowest.orderIndex && l.orderIndex <= highest.orderIndex
  );
}

/**
 * Ensures a tenant owns its own private ClassLevel rows.
 * If the tenant is still using legacy global ClassLevels, atomically clones its active
 * class range into tenant-owned rows and remaps all tenant-scoped references so zero data breaks.
 */
export async function ensureTenantOwnedClassLevels(tenantId: string) {
  const existing = await prisma.classLevel.findMany({
    where: { tenantId },
    orderBy: { orderIndex: 'asc' },
  });
  if (existing.length > 0) return existing;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { lowestClassLevelId: true, highestClassLevelId: true },
  });

  const globalLevels = await prisma.classLevel.findMany({
    where: { tenantId: null },
    orderBy: { orderIndex: 'asc' },
  });

  const lowest = globalLevels.find((l) => l.id === tenant?.lowestClassLevelId);
  const highest = globalLevels.find((l) => l.id === tenant?.highestClassLevelId);
  const sourceLevels =
    lowest && highest
      ? globalLevels.filter((l) => l.orderIndex >= lowest.orderIndex && l.orderIndex <= highest.orderIndex)
      : globalLevels;

  return prisma.$transaction(async (tx) => {
    const idMap = new Map<string, string>();
    const created: Array<{ id: string; name: string; orderIndex: number; tenantId: string | null }> = [];

    for (let i = 0; i < sourceLevels.length; i++) {
      const src = sourceLevels[i];
      const row = await tx.classLevel.create({
        data: {
          tenantId,
          name: src.name,
          orderIndex: i + 1,
        },
      });
      idMap.set(src.id, row.id);
      created.push(row);
    }

    // Remap all tenant-scoped foreign keys referencing old global classLevelIds
    const sessions = await tx.academicSession.findMany({
      where: { tenantId },
      select: { id: true, terms: { select: { id: true } } },
    });
    const sessionIds = sessions.map((s) => s.id);
    const termIds = sessions.flatMap((s) => s.terms.map((t) => t.id));

    for (const [oldId, newId] of idMap.entries()) {
      if (sessionIds.length > 0) {
        await tx.enrollment.updateMany({
          where: { sessionId: { in: sessionIds }, classLevelId: oldId },
          data: { classLevelId: newId },
        });
        await tx.teachingAssignment.updateMany({
          where: { sessionId: { in: sessionIds }, classLevelId: oldId },
          data: { classLevelId: newId },
        });
        await tx.formTeacherAssignment.updateMany({
          where: { sessionId: { in: sessionIds }, classLevelId: oldId },
          data: { classLevelId: newId },
        });
      }
      if (termIds.length > 0) {
        await tx.classResultReview.updateMany({
          where: { termId: { in: termIds }, classLevelId: oldId },
          data: { classLevelId: newId },
        });
        await tx.reportCardAssessment.updateMany({
          where: { termId: { in: termIds }, classLevelId: oldId },
          data: { classLevelId: newId },
        });
      }
      await tx.feeItem.updateMany({
        where: { tenantId, classLevelId: oldId },
        data: { classLevelId: newId },
      });
      await tx.cbtExam.updateMany({
        where: { tenantId, classLevelId: oldId },
        data: { classLevelId: newId },
      });
      await tx.timetableSlot.updateMany({
        where: { tenantId, classLevelId: oldId },
        data: { classLevelId: newId },
      });
      await tx.gradingScale.updateMany({
        where: { tenantId, lowestClassLevelId: oldId },
        data: { lowestClassLevelId: newId },
      });
      await tx.gradingScale.updateMany({
        where: { tenantId, highestClassLevelId: oldId },
        data: { highestClassLevelId: newId },
      });
    }

    if (created.length > 0) {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          lowestClassLevelId: created[0].id,
          highestClassLevelId: created[created.length - 1].id,
        },
      });
    }

    return created;
  });
}

/**
 * Syncs Tenant.lowestClassLevelId and highestClassLevelId to match the tenant's first & last ClassLevel.
 */
export async function syncTenantClassRange(tenantId: string) {
  const levels = await prisma.classLevel.findMany({
    where: { tenantId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true },
  });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      lowestClassLevelId: levels[0]?.id || null,
      highestClassLevelId: levels[levels.length - 1]?.id || null,
    },
  });
}
