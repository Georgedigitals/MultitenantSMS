import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { recordStaffClockIn, recordStaffClockOut } from '@/lib/staff-attendance';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const {
      slug,
      action = 'clock_in', // 'clock_in' | 'clock_out'
      method = 'kiosk_pin', // 'kiosk_pin' | 'kiosk_qr' | 'mobile_gps'
      pin,
      qrCode,
      staffId: explicitStaffId,
      locationCoords,
      notes,
    } = body;

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.hasFeature('staff_attendance')) return NextResponse.json({ error: 'Staff Attendance is not enabled for this school.' }, { status: 403 });

    const clockRate = await checkRateLimit(`kiosk_clock_${tenant.id}_${clientIp}`, {
      limit: 30,
      windowSeconds: 60,
    });
    if (!clockRate.success) {
      return NextResponse.json(
        { error: `Too many clock requests. Please wait ${clockRate.resetSeconds} seconds.` },
        { status: 429 }
      );
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    const authUser = auth?.user || null;

    // Kiosk terminal requires an authenticated school_admin session; remote mobile self-clocking is disallowed
    if (!authUser || authUser.role !== 'school_admin' || method === 'mobile_gps') {
      return NextResponse.json(
        { error: 'Remote clocking is disabled. Staff attendance must be recorded in person at the school office kiosk.' },
        { status: 403 }
      );
    }

    let targetStaffId: string | null = null;

    // 1. Resolve staff member
    if (explicitStaffId) {
      // Validate staff exists in this tenant
      const s = await prisma.staff.findFirst({
        where: { id: explicitStaffId, tenantId: tenant.id },
      });
      if (s) targetStaffId = s.id;
    } else if (pin) {
      const cleanInput = pin.trim();
      const s = await prisma.staff.findFirst({
        where: {
          tenantId: tenant.id,
          attendancePin: cleanInput,
        },
      });
      if (s) targetStaffId = s.id;
    } else if (qrCode) {
      let qrStaffId = qrCode.trim();
      try {
        const parsed = JSON.parse(qrCode);
        if (parsed.staffId) qrStaffId = parsed.staffId;
        else if (parsed.staffCode) qrStaffId = parsed.staffCode;
      } catch {
        // Raw string
      }

      const s = await prisma.staff.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { id: qrStaffId },
            { staffCode: { equals: qrStaffId, mode: 'insensitive' } },
          ],
        },
      });
      if (s) targetStaffId = s.id;
    } else if (authUser?.staffId) {
      targetStaffId = authUser.staffId;
    }

    if (!targetStaffId) {
      return NextResponse.json(
        { error: 'Staff member not recognized. Please check your PIN, Staff ID, or QR code badge.' },
        { status: 404 }
      );
    }

    // Strictly disallow remote self-clocking from personal dashboards
    if (method === 'mobile_gps') {
      return NextResponse.json(
        { error: 'Remote attendance clock-in is disabled. Teachers must check in at the school attendance terminal using their PIN or ID badge.' },
        { status: 403 }
      );
    }

    if (action === 'clock_out') {
      const res = await recordStaffClockOut({
        tenantId: tenant.id,
        staffId: targetStaffId,
        markedBy: authUser?.id || undefined,
        notes,
      });
      return NextResponse.json(res);
    } else {
      const res = await recordStaffClockIn({
        tenantId: tenant.id,
        staffId: targetStaffId,
        method: method || (authUser ? 'mobile_gps' : 'kiosk_pin'),
        locationCoords,
        markedBy: authUser?.id || undefined,
        notes,
      });
      return NextResponse.json(res);
    }
  } catch (err: any) {
    console.error('Error processing staff clock-in/out:', err);
    return NextResponse.json({ error: err.message || 'Clock-in failed' }, { status: 400 });
  }
}
