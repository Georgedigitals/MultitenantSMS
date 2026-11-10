import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { normalizeAttendanceDate } from '@/lib/staff-attendance';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const { slug, pin, qrCode } = body;

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.hasFeature('staff_attendance')) return NextResponse.json({ error: 'Staff Attendance is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Kiosk terminal must be unlocked by a School Administrator.' },
        { status: 401 }
      );
    }

    // Handle protected admin exit from kiosk terminal
    if (body.action === 'verify_admin_exit') {
      const exitRate = await checkRateLimit(`kiosk_admin_exit_${tenant.id}_${clientIp}`, {
        limit: 5,
        windowSeconds: 60,
      });
      if (!exitRate.success) {
        return NextResponse.json(
          { error: `Too many failed attempts. Please wait ${exitRate.resetSeconds} seconds.` },
          { status: 429 }
        );
      }

      const { adminPin } = body;
      if (!adminPin) {
        return NextResponse.json({ error: 'Admin PIN or password is required' }, { status: 400 });
      }

      // 1. Check if adminPin matches an admin staff attendancePin
      const adminStaff = await prisma.staff.findFirst({
        where: {
          tenantId: tenant.id,
          roleBase: 'admin',
          attendancePin: adminPin.trim(),
        },
      });

      if (adminStaff) {
        return NextResponse.json({ success: true, authorized: true });
      }

      // 2. Check tenant users with school_admin role password or pin
      const { verifyPassword } = await import('@/lib/auth/passwords');
      const adminUsers = await prisma.tenantUser.findMany({
        where: {
          tenantId: tenant.id,
          role: 'school_admin',
        },
      });

      for (const u of adminUsers) {
        if (u.passwordHash) {
          const match = await verifyPassword(adminPin.trim(), u.passwordHash);
          if (match) return NextResponse.json({ success: true, authorized: true });
        }
      }

      return NextResponse.json({ error: 'Access Denied: Incorrect Admin PIN or password.' }, { status: 403 });
    }

    const verifyRate = await checkRateLimit(`kiosk_verify_${tenant.id}_${clientIp}`, {
      limit: 25,
      windowSeconds: 60,
    });
    if (!verifyRate.success) {
      return NextResponse.json(
        { error: `Too many PIN attempts. Please wait ${verifyRate.resetSeconds} seconds.` },
        { status: 429 }
      );
    }

    if (!pin && !qrCode) {
      return NextResponse.json({ error: 'Please enter a PIN, Staff ID, or scan a QR code badge.' }, { status: 400 });
    }

    let staff = null;

    if (pin) {
      const cleanInput = pin.trim();
      staff = await prisma.staff.findFirst({
        where: {
          tenantId: tenant.id,
          attendancePin: cleanInput,
        },
        select: { id: true, name: true, roleBase: true, staffCode: true },
      });
    } else if (qrCode) {
      let codeVal = qrCode.trim();
      try {
        const parsed = JSON.parse(qrCode);
        if (parsed.staffId) codeVal = parsed.staffId;
        else if (parsed.staffCode) codeVal = parsed.staffCode;
      } catch {
        // raw code
      }

      staff = await prisma.staff.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { id: codeVal },
            { staffCode: { equals: codeVal, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, roleBase: true, staffCode: true },
      });
    }

    if (!staff) {
      return NextResponse.json({ error: 'Staff member not recognized. Please verify your PIN, Staff ID, or QR badge.' }, { status: 404 });
    }

    // Check today's attendance record
    const today = normalizeAttendanceDate(new Date());
    const attendance = await prisma.staffAttendance.findUnique({
      where: {
        staffId_date: {
          staffId: staff.id,
          date: today,
        },
      },
    });

    return NextResponse.json({
      valid: true,
      staff: {
        id: staff.id,
        name: staff.name,
        roleBase: staff.roleBase,
        staffCode: staff.staffCode || `STF-${staff.id.slice(-4).toUpperCase()}`,
      },
      todayRecord: attendance
        ? {
            clockInTime: attendance.clockInTime?.toISOString() || null,
            clockOutTime: attendance.clockOutTime?.toISOString() || null,
            status: attendance.status,
            minutesLate: attendance.minutesLate,
          }
        : null,
    });
  } catch (err: any) {
    console.error('Error verifying kiosk staff credentials:', err);
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
