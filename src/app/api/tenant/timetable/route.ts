import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import {
  getClassTimetable,
  saveTimetableSlot,
  autoGenerateClassTimetable,
  swapTimetableSlots,
  copyClassTimetable,
  clearClassTimetable,
} from '@/lib/timetable';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const classLevelId = searchParams.get('classLevelId');
    const sessionId = searchParams.get('sessionId') || undefined;

    if (!slug || !classLevelId) {
      return NextResponse.json({ error: 'slug and classLevelId are required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('timetable')) return NextResponse.json({ error: 'Class Timetable is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await getClassTimetable(tenant.id, classLevelId, sessionId);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error fetching class timetable:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch timetable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      slug,
      action,
      classLevelId,
      dayOfWeek,
      periodId,
      subjectId,
      staffId,
      room,
      sessionId,
      ignoreClash = false,
      sourceClassLevelId,
      targetClassLevelId,
      slot1,
      slot2,
    } = body;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('timetable')) return NextResponse.json({ error: 'Class Timetable is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || !['school_admin', 'teacher'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 403 });
    }

    // 1. ACTION: Auto-generate full schedule for class
    if (action === 'auto_generate') {
      if (auth.user.role !== 'school_admin') {
        return NextResponse.json({ error: 'Only school administrators can auto-generate timetables' }, { status: 403 });
      }
      if (!classLevelId) {
        return NextResponse.json({ error: 'classLevelId is required for auto-generation' }, { status: 400 });
      }

      const result = await autoGenerateClassTimetable({
        tenantId: tenant.id,
        classLevelId,
        sessionId: sessionId || null,
      });
      return NextResponse.json(result);
    }

    // 2. ACTION: Swap two slots
    if (action === 'swap_slots') {
      if (auth.user.role !== 'school_admin') {
        return NextResponse.json({ error: 'Only school administrators can swap timetable slots' }, { status: 403 });
      }
      if (!classLevelId || !slot1 || !slot2) {
        return NextResponse.json({ error: 'classLevelId, slot1, and slot2 are required for swapping' }, { status: 400 });
      }

      const result = await swapTimetableSlots({
        tenantId: tenant.id,
        classLevelId,
        slot1,
        slot2,
        ignoreClash,
      });

      if (!result.success && result.clash) {
        return NextResponse.json(
          { error: result.message, clash: true, clashDetails: result.clashDetails },
          { status: 409 }
        );
      }

      return NextResponse.json(result);
    }

    // 3. ACTION: Copy timetable from another class
    if (action === 'copy_class') {
      if (auth.user.role !== 'school_admin') {
        return NextResponse.json({ error: 'Only school administrators can copy timetables' }, { status: 403 });
      }
      if (!sourceClassLevelId || !targetClassLevelId) {
        return NextResponse.json({ error: 'sourceClassLevelId and targetClassLevelId are required' }, { status: 400 });
      }

      const result = await copyClassTimetable({
        tenantId: tenant.id,
        sourceClassLevelId,
        targetClassLevelId,
        sessionId: sessionId || null,
      });
      return NextResponse.json(result);
    }

    // 4. ACTION: Clear entire timetable for class
    if (action === 'clear_all') {
      if (auth.user.role !== 'school_admin') {
        return NextResponse.json({ error: 'Only school administrators can clear timetables' }, { status: 403 });
      }
      if (!classLevelId) {
        return NextResponse.json({ error: 'classLevelId is required' }, { status: 400 });
      }

      const result = await clearClassTimetable({
        tenantId: tenant.id,
        classLevelId,
      });
      return NextResponse.json(result);
    }

    // 5. DEFAULT ACTION: Save single slot
    if (!classLevelId || dayOfWeek === undefined || !periodId) {
      return NextResponse.json(
        { error: 'classLevelId, dayOfWeek, and periodId are required' },
        { status: 400 }
      );
    }

    const result = await saveTimetableSlot({
      tenantId: tenant.id,
      classLevelId,
      dayOfWeek: Number(dayOfWeek),
      periodId,
      subjectId: subjectId || null,
      staffId: staffId || null,
      room: room || null,
      sessionId: sessionId || null,
      ignoreClash,
    });

    if (!result.success && result.clash) {
      return NextResponse.json(
        {
          error: result.message,
          clash: true,
          clashDetails: result.clashDetails,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error saving timetable slot:', err);
    return NextResponse.json({ error: err.message || 'Failed to update timetable slot' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const classLevelId = searchParams.get('classLevelId');
    const dayOfWeek = searchParams.get('dayOfWeek');
    const periodId = searchParams.get('periodId');

    if (!slug || !classLevelId || dayOfWeek === undefined || !periodId) {
      return NextResponse.json(
        { error: 'slug, classLevelId, dayOfWeek, and periodId are required' },
        { status: 400 }
      );
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('timetable')) return NextResponse.json({ error: 'Class Timetable is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school admin can delete timetable slots' }, { status: 403 });
    }

    const result = await saveTimetableSlot({
      tenantId: tenant.id,
      classLevelId,
      dayOfWeek: Number(dayOfWeek),
      periodId,
      subjectId: null,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error deleting timetable slot:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete slot' }, { status: 500 });
  }
}
