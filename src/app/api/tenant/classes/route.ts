import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';
import {
  EDUCATION_SYSTEM_PRESETS,
  ensureTenantOwnedClassLevels,
  getPresetByKey,
  getTenantClassLevels,
  syncTenantClassRange,
} from '@/lib/class-levels';

export async function GET() {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['school_admin', 'teacher'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId;
    const [levels, ownedCount] = await Promise.all([
      getTenantClassLevels(tenantId, { filterLegacyByRange: true }),
      prisma.classLevel.count({ where: { tenantId } }),
    ]);

    return NextResponse.json({
      classes: levels,
      hasCustomClasses: ownedCount > 0,
      presets: EDUCATION_SYSTEM_PRESETS.map(({ key, label, region, classes }) => ({
        key,
        label,
        region,
        count: classes.length,
        sample: classes.slice(0, 4).join(', '),
      })),
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/classes]', err);
    return NextResponse.json({ error: err?.message || 'Failed to load classes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school administrators can manage classes.' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId;
    const body = await req.json();

    // Mode 1: Apply a 1-click country/curriculum preset (only when no active enrollments block replacement)
    if (body.action === 'apply_preset') {
      const preset = getPresetByKey(body.presetKey);

      const [enrollmentCount, feeCount, cbtCount] = await Promise.all([
        prisma.enrollment.count({ where: { student: { tenantId } } }),
        prisma.feeItem.count({ where: { tenantId, classLevelId: { not: null } } }),
        prisma.cbtExam.count({ where: { tenantId } }),
      ]);

      if (enrollmentCount > 0 || feeCount > 0 || cbtCount > 0) {
        return NextResponse.json(
          {
            error:
              'Cannot replace all classes with a preset because students, fees, or exams are already linked. You can rename or add classes individually instead.',
          },
          { status: 409 }
        );
      }

      const created = await prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { lowestClassLevelId: null, highestClassLevelId: null },
        });
        await tx.classLevel.deleteMany({ where: { tenantId } });

        const rows = [];
        for (let i = 0; i < preset.classes.length; i++) {
          const row = await tx.classLevel.create({
            data: {
              tenantId,
              name: preset.classes[i],
              orderIndex: i + 1,
            },
          });
          rows.push(row);
        }

        if (rows.length > 0) {
          await tx.tenant.update({
            where: { id: tenantId },
            data: {
              lowestClassLevelId: rows[0].id,
              highestClassLevelId: rows[rows.length - 1].id,
            },
          });
        }

        return rows;
      });

      await recordAuditLog({
        tenantId,
        actorId: auth.user.id,
        actorName: auth.user.staffProfile?.name || auth.user.username,
        actorRole: auth.user.role,
        action: 'CLASS_PRESET_APPLIED',
        entityType: 'ClassLevel',
        entityId: tenantId,
        details: { presetKey: preset.key, count: created.length },
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true, classes: created });
    }

    // Mode 2: Add a single custom class
    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    if (!rawName || rawName.length > 60) {
      return NextResponse.json({ error: 'Class name is required (1–60 characters).' }, { status: 400 });
    }

    const currentLevels = await ensureTenantOwnedClassLevels(tenantId);
    const duplicate = currentLevels.find(
      (c) => c.name.toLowerCase() === rawName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json({ error: `A class named "${rawName}" already exists.` }, { status: 409 });
    }

    const maxOrder = currentLevels.reduce((acc, c) => Math.max(acc, c.orderIndex), 0);
    const created = await prisma.classLevel.create({
      data: {
        tenantId,
        name: rawName,
        orderIndex: maxOrder + 1,
      },
    });

    await syncTenantClassRange(tenantId);

    await recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'CLASS_CREATED',
      entityType: 'ClassLevel',
      entityId: created.id,
      details: { name: created.name, orderIndex: created.orderIndex },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, classLevel: created }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/tenant/classes]', err);
    return NextResponse.json({ error: err?.message || 'Failed to create class.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school administrators can edit classes.' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId;
    const body = await req.json();

    // Ensure tenant owns its own rows before mutating
    const ownedLevels = await ensureTenantOwnedClassLevels(tenantId);

    // Mode A: Reorder classes atomically
    if (Array.isArray(body.orderedIds)) {
      const orderedIds = body.orderedIds.filter((id: unknown): id is string => typeof id === 'string');
      const ownedSet = new Set(ownedLevels.map((l) => l.id));
      if (orderedIds.length !== ownedLevels.length || orderedIds.some((id: string) => !ownedSet.has(id))) {
        return NextResponse.json({ error: 'Invalid class order list.' }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        // Phase 1: shift out of range to avoid unique (tenantId, orderIndex) collisions
        for (let i = 0; i < orderedIds.length; i++) {
          await tx.classLevel.update({
            where: { id: orderedIds[i] },
            data: { orderIndex: 10000 + i + 1 },
          });
        }
        // Phase 2: write clean 1..N sequence
        for (let i = 0; i < orderedIds.length; i++) {
          await tx.classLevel.update({
            where: { id: orderedIds[i] },
            data: { orderIndex: i + 1 },
          });
        }
      });

      await syncTenantClassRange(tenantId);
      const refreshed = await getTenantClassLevels(tenantId);
      return NextResponse.json({ success: true, classes: refreshed });
    }

    // Mode B: Rename a class
    const id = typeof body.id === 'string' ? body.id : '';
    const newName = typeof body.name === 'string' ? body.name.trim() : '';
    if (!id || !newName || newName.length > 60) {
      return NextResponse.json({ error: 'Valid class id and new name (1–60 chars) are required.' }, { status: 400 });
    }

    const target = ownedLevels.find((l) => l.id === id);
    if (!target) {
      return NextResponse.json({ error: 'Class not found for this school.' }, { status: 404 });
    }

    const duplicate = ownedLevels.find(
      (l) => l.id !== id && l.name.toLowerCase() === newName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json({ error: `Another class is already named "${newName}".` }, { status: 409 });
    }

    const updated = await prisma.classLevel.update({
      where: { id },
      data: { name: newName },
    });

    await recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'CLASS_RENAMED',
      entityType: 'ClassLevel',
      entityId: updated.id,
      details: { previousName: target.name, newName: updated.name },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, classLevel: updated });
  } catch (err: any) {
    console.error('[PATCH /api/tenant/classes]', err);
    return NextResponse.json({ error: err?.message || 'Failed to update class.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school administrators can delete classes.' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId;
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Class id is required.' }, { status: 400 });

    const ownedLevels = await ensureTenantOwnedClassLevels(tenantId);
    const target = ownedLevels.find((l) => l.id === id);
    if (!target) {
      return NextResponse.json({ error: 'Class not found for this school.' }, { status: 404 });
    }
    if (ownedLevels.length <= 1) {
      return NextResponse.json({ error: 'A school must have at least one class level.' }, { status: 409 });
    }

    const [enrollments, feeItems, cbtExams, timetableSlots] = await Promise.all([
      prisma.enrollment.count({ where: { classLevelId: id, student: { tenantId } } }),
      prisma.feeItem.count({ where: { tenantId, classLevelId: id } }),
      prisma.cbtExam.count({ where: { tenantId, classLevelId: id } }),
      prisma.timetableSlot.count({ where: { tenantId, classLevelId: id } }),
    ]);

    if (enrollments > 0 || feeItems > 0 || cbtExams > 0 || timetableSlots > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete "${target.name}" while it has linked records (${enrollments} enrollments, ${feeItems} fee items, ${cbtExams} exams, ${timetableSlots} timetable slots). Rename it or move records first.`,
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.updateMany({
        where: { id: tenantId, lowestClassLevelId: id },
        data: { lowestClassLevelId: null },
      });
      await tx.tenant.updateMany({
        where: { id: tenantId, highestClassLevelId: id },
        data: { highestClassLevelId: null },
      });
      await tx.classLevel.delete({ where: { id } });

      const remaining = await tx.classLevel.findMany({
        where: { tenantId },
        orderBy: { orderIndex: 'asc' },
      });
      for (let i = 0; i < remaining.length; i++) {
        await tx.classLevel.update({
          where: { id: remaining[i].id },
          data: { orderIndex: 10000 + i + 1 },
        });
      }
      for (let i = 0; i < remaining.length; i++) {
        await tx.classLevel.update({
          where: { id: remaining[i].id },
          data: { orderIndex: i + 1 },
        });
      }
    });

    await syncTenantClassRange(tenantId);

    await recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'CLASS_DELETED',
      entityType: 'ClassLevel',
      entityId: id,
      details: { name: target.name },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/classes]', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete class.' }, { status: 500 });
  }
}
