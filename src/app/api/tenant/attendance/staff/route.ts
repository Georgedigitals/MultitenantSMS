import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getDailyStaffAttendanceRoster, normalizeAttendanceDate } from '@/lib/staff-attendance';
import { StaffAttendanceStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const dateParam = searchParams.get('date');

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.hasFeature('staff_attendance')) return NextResponse.json({ error: 'Staff Attendance is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school administrators can view staff attendance rosters' }, { status: 403 });
    }

    const targetDate = dateParam || new Date().toISOString().split('T')[0];
    const data = await getDailyStaffAttendanceRoster(tenant.id, targetDate);

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error fetching staff attendance:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, staffId, date, status, clockInTime, clockOutTime, minutesLate = 0, notes } = body;

    if (!slug || !staffId || !date || !status) {
      return NextResponse.json(
        { error: 'slug, staffId, date, and status are required' },
        { status: 400 }
      );
    }

    const validStatuses: StaffAttendanceStatus[] = ['present', 'late', 'absent', 'excused', 'half_day'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.hasFeature('staff_attendance')) return NextResponse.json({ error: 'Staff Attendance is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    // Verify staff belongs to tenant
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, tenantId: tenant.id },
    });
    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found in this school' }, { status: 404 });
    }

    const targetDate = normalizeAttendanceDate(date);
    const parsedClockIn = clockInTime ? new Date(clockInTime) : null;
    const parsedClockOut = clockOutTime ? new Date(clockOutTime) : null;

    const record = await prisma.staffAttendance.upsert({
      where: {
        staffId_date: {
          staffId,
          date: targetDate,
        },
      },
      create: {
        tenantId: tenant.id,
        staffId,
        date: targetDate,
        status,
        clockInTime: parsedClockIn,
        clockOutTime: parsedClockOut,
        minutesLate: Number(minutesLate) || 0,
        method: 'admin_manual',
        markedBy: auth.user.id,
        notes: notes || null,
      },
      update: {
        status,
        clockInTime: parsedClockIn,
        clockOutTime: parsedClockOut,
        minutesLate: Number(minutesLate) || 0,
        markedBy: auth.user.id,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (err: any) {
    console.error('Error saving staff attendance:', err);
    return NextResponse.json({ error: err.message || 'Failed to update attendance' }, { status: 500 });
  }
}
