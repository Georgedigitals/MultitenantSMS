/**
 * Tenant Class Range Settings API
 * GET   /api/tenant/settings/class-range?slug=apex
 * PATCH /api/tenant/settings/class-range (school_admin only)
 *
 * Enforces PRD §4.1:
 * - ClassLevel is global ladder
 * - Tenant defines lowest_class_level_id and highest_class_level_id
 * - Shrinking a tenant's class range (raising lowest or lowering highest) is BLOCKED
 *   if active enrollments exist in the class level being removed.
 * - Extending the range is always allowed.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { findTenantBySlugOrDomain } from '@/lib/tenant';

async function resolveTenant(slug: string | null) {
  if (!slug) return null;
  return findTenantBySlugOrDomain(slug, undefined, {
      lowestClassLevel: true,
      highestClassLevel: true,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const allLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  const lowest = tenant.lowestClassLevel;
  const highest = tenant.highestClassLevel;

  const usableLevels = allLevels.filter((lvl: any) => {
    if (!lowest || !highest) return true;
    return lvl.orderIndex >= lowest.orderIndex && lvl.orderIndex <= highest.orderIndex;
  });

  return NextResponse.json({
    currentRange: {
      lowestClassLevel: lowest,
      highestClassLevel: highest,
    },
    allLevels,
    usableLevels,
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { slug, lowestClassLevelId, highestClassLevelId } = body;

  if (!slug || !lowestClassLevelId || !highestClassLevelId) {
    return NextResponse.json(
      { error: 'slug, lowestClassLevelId, and highestClassLevelId are required' },
      { status: 400 }
    );
  }

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can update class range settings' }, { status: 403 });
  }

  const [newLvlLow, newLvlHigh] = await Promise.all([
    prisma.classLevel.findUnique({ where: { id: lowestClassLevelId } }),
    prisma.classLevel.findUnique({ where: { id: highestClassLevelId } }),
  ]);

  if (!newLvlLow || !newLvlHigh) {
    return NextResponse.json({ error: 'Specified lowest or highest class level does not exist' }, { status: 404 });
  }

  if (newLvlLow.orderIndex > newLvlHigh.orderIndex) {
    return NextResponse.json(
      { error: 'Lowest class level cannot be higher than highest class level' },
      { status: 422 }
    );
  }

  const currLow = tenant.lowestClassLevel;
  const currHigh = tenant.highestClassLevel;

  // §4.1: Shrink guard check
  const removedLevelIds: string[] = [];

  if (currLow && newLvlLow.orderIndex > currLow.orderIndex) {
    // Bottom range raised: levels from currLow.orderIndex to newLvlLow.orderIndex - 1 are removed
    const removedBottom = await prisma.classLevel.findMany({
      where: {
        orderIndex: {
          gte: currLow.orderIndex,
          lt: newLvlLow.orderIndex,
        },
      },
      select: { id: true, name: true },
    });
    removedLevelIds.push(...removedBottom.map((l: any) => l.id));
  }

  if (currHigh && newLvlHigh.orderIndex < currHigh.orderIndex) {
    // Top range lowered: levels from newLvlHigh.orderIndex + 1 to currHigh.orderIndex are removed
    const removedTop = await prisma.classLevel.findMany({
      where: {
        orderIndex: {
          gt: newLvlHigh.orderIndex,
          lte: currHigh.orderIndex,
        },
      },
      select: { id: true, name: true },
    });
    removedLevelIds.push(...removedTop.map((l: any) => l.id));
  }

  if (removedLevelIds.length > 0) {
    // Check if active enrollments exist in any removed class levels for this tenant's students
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        classLevelId: { in: removedLevelIds },
        status: 'active',
        student: { tenantId: tenant.id },
      },
      include: {
        classLevel: true,
        student: true,
      },
    });

    if (activeEnrollments.length > 0) {
      const affectedClassNames = Array.from(new Set(activeEnrollments.map((e: any) => e.classLevel.name)));
      return NextResponse.json(
        {
          error: `Cannot shrink class range: ${activeEnrollments.length} active student enrollment(s) exist in removed level(s) (${affectedClassNames.join(', ')}). PRD §4.1 requires resolving active enrollments before shrinking the school range.`,
          affectedClasses: affectedClassNames,
          activeEnrollmentCount: activeEnrollments.length,
        },
        { status: 422 }
      );
    }
  }

  // Safe to update (either extended or shrunk with no active enrollments)
  const updatedTenant = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      lowestClassLevelId,
      highestClassLevelId,
    },
    include: {
      lowestClassLevel: true,
      highestClassLevel: true,
    },
  });

  return NextResponse.json({
    success: true,
    range: {
      lowestClassLevel: updatedTenant.lowestClassLevel,
      highestClassLevel: updatedTenant.highestClassLevel,
    },
  });
}
