import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { normalizeAttendanceDate } from '@/lib/staff-attendance';
import { LeaveRequestStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('staff_attendance')) return NextResponse.json({ error: 'Staff Attendance is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = auth.user.role === 'school_admin';
    const isTeacher = auth.user.role === 'teacher';

    if (!isAdmin && !isTeacher) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const whereClause: any = { tenantId: tenant.id };
    if (!isAdmin && isTeacher) {
      if (!auth.user.staffId) {
        return NextResponse.json({ error: 'Staff account required' }, { status: 403 });
      }
      whereClause.staffId = auth.user.staffId;
    }

    const requests = await prisma.staffLeaveRequest.findMany({
      where: whereClause,
      include: {
        staff: {
          select: { id: true, name: true, roleBase: true, staffCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (err: any) {
    console.error('Error fetching leave requests:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch leave requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, staffId: paramStaffId, leaveType, startDate, endDate, reason } = body;

    if (!slug || !leaveType || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: 'slug, leaveType, startDate, endDate, and reason are required' },
        { status: 400 }
      );
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('staff_attendance')) return NextResponse.json({ error: 'Staff Attendance is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = auth.user.role === 'school_admin';
    let targetStaffId = auth.user.staffId;

    if (isAdmin && paramStaffId) {
      targetStaffId = paramStaffId;
    }

    if (!targetStaffId) {
      return NextResponse.json({ error: 'Staff profile not associated with this account' }, { status: 400 });
    }

    const start = normalizeAttendanceDate(startDate);
    const end = normalizeAttendanceDate(endDate);

    if (start > end) {
      return NextResponse.json({ error: 'Start date cannot be after end date' }, { status: 400 });
    }

    const request = await prisma.staffLeaveRequest.create({
      data: {
        tenantId: tenant.id,
        staffId: targetStaffId,
        leaveType,
        startDate: start,
        endDate: end,
        reason: reason.trim(),
        status: isAdmin ? 'approved' : 'pending',
        reviewedBy: isAdmin ? auth.user.id : null,
        reviewedAt: isAdmin ? new Date() : null,
      },
    });

    // If auto-approved by admin, create excused attendance records for any dates within range
    if (isAdmin) {
      const cur = new Date(start);
      while (cur <= end) {
        if (cur.getUTCDay() !== 0 && cur.getUTCDay() !== 6) {
          const recDate = new Date(cur);
          await prisma.staffAttendance.upsert({
            where: {
              staffId_date: {
                staffId: targetStaffId,
                date: recDate,
              },
            },
            create: {
              tenantId: tenant.id,
              staffId: targetStaffId,
              date: recDate,
              status: 'excused',
              method: 'admin_manual',
              markedBy: auth.user.id,
              notes: `Approved Leave: ${leaveType} (${reason})`,
            },
            update: {
              status: 'excused',
              notes: `Approved Leave: ${leaveType} (${reason})`,
            },
          });
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    return NextResponse.json({ success: true, request });
  } catch (err: any) {
    console.error('Error submitting leave request:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit leave request' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, requestId, status, adminNotes } = body;

    if (!slug || !requestId || !status) {
      return NextResponse.json({ error: 'slug, requestId, and status are required' }, { status: 400 });
    }

    const validStatuses: LeaveRequestStatus[] = ['approved', 'rejected', 'pending'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('staff_attendance')) return NextResponse.json({ error: 'Staff Attendance is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const leaveReq = await prisma.staffLeaveRequest.findFirst({
      where: { id: requestId, tenantId: tenant.id },
    });
    if (!leaveReq) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    const updated = await prisma.staffLeaveRequest.update({
      where: { id: requestId },
      data: {
        status,
        adminNotes: adminNotes || null,
        reviewedBy: auth.user.id,
        reviewedAt: new Date(),
      },
    });

    // If approved, upsert excused attendance records
    if (status === 'approved') {
      const cur = new Date(leaveReq.startDate);
      const end = new Date(leaveReq.endDate);
      while (cur <= end) {
        if (cur.getUTCDay() !== 0 && cur.getUTCDay() !== 6) {
          const recDate = new Date(cur);
          await prisma.staffAttendance.upsert({
            where: {
              staffId_date: {
                staffId: leaveReq.staffId,
                date: recDate,
              },
            },
            create: {
              tenantId: tenant.id,
              staffId: leaveReq.staffId,
              date: recDate,
              status: 'excused',
              method: 'admin_manual',
              markedBy: auth.user.id,
              notes: `Approved Leave: ${leaveReq.leaveType} (${leaveReq.reason})`,
            },
            update: {
              status: 'excused',
              notes: `Approved Leave: ${leaveReq.leaveType} (${leaveReq.reason})`,
            },
          });
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: any) {
    console.error('Error reviewing leave request:', err);
    return NextResponse.json({ error: err.message || 'Failed to update leave request' }, { status: 500 });
  }
}
