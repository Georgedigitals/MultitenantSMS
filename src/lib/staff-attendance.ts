import prisma from './prisma';
import { StaffAttendanceStatus, LeaveRequestStatus } from '@prisma/client';

export interface ClockInResult {
  success: boolean;
  action: 'clock_in' | 'clock_out' | 'already_clocked';
  status?: StaffAttendanceStatus;
  clockInTime?: string;
  clockOutTime?: string;
  minutesLate?: number;
  staffName?: string;
  staffRole?: string;
  message: string;
}

/**
 * Normalizes a date to midnight UTC for consistent single-day database indexing.
 */
export function normalizeAttendanceDate(input: Date | string): Date {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Calculates distance in meters between two GPS coordinates using the Haversine formula.
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Compares clock-in time against the tenant's late cutoff threshold (e.g., '07:45').
 */
export function evaluatePunctuality(
  clockInDate: Date,
  lateThresholdStr: string = '07:45'
): { isLate: boolean; minutesLate: number } {
  const [targetH, targetM] = lateThresholdStr.split(':').map(Number);
  const clockH = clockInDate.getHours();
  const clockM = clockInDate.getMinutes();

  const clockMinutes = clockH * 60 + clockM;
  const thresholdMinutes = (targetH || 7) * 60 + (targetM || 45);

  if (clockMinutes > thresholdMinutes) {
    return {
      isLate: true,
      minutesLate: clockMinutes - thresholdMinutes,
    };
  }

  return {
    isLate: false,
    minutesLate: 0,
  };
}

/**
 * Executes a clock-in for a staff member.
 */
export async function recordStaffClockIn(options: {
  tenantId: string;
  staffId: string;
  method?: string; // 'kiosk_qr' | 'kiosk_pin' | 'mobile_gps' | 'admin_manual'
  locationCoords?: { latitude: number; longitude: number };
  customTime?: Date;
  markedBy?: string;
  notes?: string;
}): Promise<ClockInResult> {
  const { tenantId, staffId, method = 'kiosk_pin', locationCoords, customTime, markedBy, notes } = options;

  // 1. Fetch tenant and staff
  const [tenant, staff] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        workStartTime: true,
        lateThresholdTime: true,
        campusLatitude: true,
        campusLongitude: true,
        campusRadiusMeters: true,
        enableGeofenceAttendance: true,
      },
    }),
    prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      select: { id: true, name: true, roleBase: true },
    }),
  ]);

  if (!tenant) throw new Error('Tenant school not found');
  if (!staff) throw new Error('Staff member not found in this school');

  // 2. Geofence verification for mobile clock-in
  if (method === 'mobile_gps' && tenant.enableGeofenceAttendance) {
    if (tenant.campusLatitude !== null && tenant.campusLongitude !== null) {
      if (!locationCoords || locationCoords.latitude === undefined || locationCoords.longitude === undefined) {
        throw new Error('Location permission is required to clock in on campus.');
      }
      const dist = calculateDistanceMeters(
        locationCoords.latitude,
        locationCoords.longitude,
        tenant.campusLatitude,
        tenant.campusLongitude
      );
      const maxRadius = tenant.campusRadiusMeters || 200;
      if (dist > maxRadius) {
        throw new Error(`You are ${dist}m away from the campus perimeter. Clock-in requires being within ${maxRadius}m.`);
      }
    }
  }

  const now = customTime || new Date();
  const todayDate = normalizeAttendanceDate(now);

  // 3. Check existing record
  const existing = await prisma.staffAttendance.findUnique({
    where: {
      staffId_date: {
        staffId,
        date: todayDate,
      },
    },
  });

  if (existing?.clockInTime) {
    return {
      success: true,
      action: 'already_clocked',
      status: existing.status,
      clockInTime: existing.clockInTime.toISOString(),
      clockOutTime: existing.clockOutTime?.toISOString(),
      minutesLate: existing.minutesLate,
      staffName: staff.name,
      staffRole: staff.roleBase,
      message: `${staff.name} is already clocked in today at ${new Date(existing.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    };
  }

  // 4. Calculate punctuality
  const { isLate, minutesLate } = evaluatePunctuality(now, tenant.lateThresholdTime || '07:45');
  const status: StaffAttendanceStatus = isLate ? 'late' : 'present';

  const record = await prisma.staffAttendance.upsert({
    where: {
      staffId_date: {
        staffId,
        date: todayDate,
      },
    },
    create: {
      tenantId,
      staffId,
      date: todayDate,
      clockInTime: now,
      status,
      minutesLate,
      method,
      markedBy,
      notes,
    },
    update: {
      clockInTime: now,
      status,
      minutesLate,
      method,
      markedBy: markedBy || undefined,
      notes: notes || undefined,
    },
  });

  const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const message = isLate
    ? `Clock-in recorded at ${formattedTime}. Marked Late (+${minutesLate} mins).`
    : `Good morning, ${staff.name}! Clocked in on time at ${formattedTime}.`;

  return {
    success: true,
    action: 'clock_in',
    status: record.status,
    clockInTime: record.clockInTime?.toISOString(),
    minutesLate: record.minutesLate,
    staffName: staff.name,
    staffRole: staff.roleBase,
    message,
  };
}

/**
 * Executes a clock-out for a staff member.
 */
export async function recordStaffClockOut(options: {
  tenantId: string;
  staffId: string;
  customTime?: Date;
  markedBy?: string;
  notes?: string;
}): Promise<ClockInResult> {
  const { tenantId, staffId, customTime, markedBy, notes } = options;

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, tenantId },
    select: { id: true, name: true, roleBase: true },
  });
  if (!staff) throw new Error('Staff member not found');

  const now = customTime || new Date();
  const todayDate = normalizeAttendanceDate(now);

  const existing = await prisma.staffAttendance.findUnique({
    where: {
      staffId_date: {
        staffId,
        date: todayDate,
      },
    },
  });

  const record = await prisma.staffAttendance.upsert({
    where: {
      staffId_date: {
        staffId,
        date: todayDate,
      },
    },
    create: {
      tenantId,
      staffId,
      date: todayDate,
      clockOutTime: now,
      status: 'present',
      method: 'kiosk_pin',
      markedBy,
      notes,
    },
    update: {
      clockOutTime: now,
      markedBy: markedBy || undefined,
      notes: notes ? `${existing?.notes ? existing.notes + ' | ' : ''}${notes}` : undefined,
    },
  });

  const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    success: true,
    action: 'clock_out',
    status: record.status,
    clockInTime: record.clockInTime?.toISOString(),
    clockOutTime: record.clockOutTime?.toISOString(),
    minutesLate: record.minutesLate,
    staffName: staff.name,
    staffRole: staff.roleBase,
    message: `Goodbye, ${staff.name}! Clocked out at ${formattedTime}. Have a great evening!`,
  };
}

/**
 * Fetches the daily attendance roster for all staff in a school on a specified date.
 */
export async function getDailyStaffAttendanceRoster(tenantId: string, date: Date | string) {
  const targetDate = normalizeAttendanceDate(date);

  const [staffList, records, approvedLeaves] = await Promise.all([
    prisma.staff.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        roleBase: true,
        staffCode: true,
        attendancePin: true,
        contactInfo: true,
        userAccount: {
          select: { username: true, isActive: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.staffAttendance.findMany({
      where: {
        tenantId,
        date: targetDate,
      },
    }),
    prisma.staffLeaveRequest.findMany({
      where: {
        tenantId,
        status: 'approved',
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
      select: {
        staffId: true,
        leaveType: true,
        reason: true,
      },
    }),
  ]);

  const recordMap = new Map<string, typeof records[0]>();
  for (const r of records) {
    recordMap.set(r.staffId, r);
  }

  const leaveMap = new Map<string, typeof approvedLeaves[0]>();
  for (const l of approvedLeaves) {
    leaveMap.set(l.staffId, l);
  }

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;

  const roster = staffList.map((st) => {
    const existingRecord = recordMap.get(st.id);
    const leave = leaveMap.get(st.id);

    let status: StaffAttendanceStatus = 'absent';
    let clockInTime: string | null = null;
    let clockOutTime: string | null = null;
    let minutesLate = 0;
    let method = 'none';
    let notes: string | null = null;
    let recordId: string | null = null;

    if (existingRecord) {
      recordId = existingRecord.id;
      status = existingRecord.status;
      clockInTime = existingRecord.clockInTime?.toISOString() || null;
      clockOutTime = existingRecord.clockOutTime?.toISOString() || null;
      minutesLate = existingRecord.minutesLate;
      method = existingRecord.method;
      notes = existingRecord.notes;
    } else if (leave) {
      status = 'excused';
      notes = `Approved Leave: ${leave.leaveType.toUpperCase()} (${leave.reason})`;
    }

    if (status === 'present') presentCount++;
    else if (status === 'late') lateCount++;
    else if (status === 'excused') excusedCount++;
    else absentCount++;

    return {
      staffId: st.id,
      staffName: st.name,
      roleBase: st.roleBase,
      staffCode: st.staffCode || `STF-${st.id.slice(-4).toUpperCase()}`,
      attendancePin: st.attendancePin || '1234',
      userEmail: (st.contactInfo as any)?.email || st.userAccount?.username || null,
      phone: (st.contactInfo as any)?.phone || null,
      recordId,
      status,
      clockInTime,
      clockOutTime,
      minutesLate,
      method,
      notes,
    };
  });

  return {
    date: targetDate.toISOString().split('T')[0],
    totalStaff: staffList.length,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    roster,
  };
}

/**
 * Aggregates monthly/termly timesheet metrics per staff member.
 */
export async function getStaffTimesheetMetrics(
  tenantId: string,
  startDate: Date | string,
  endDate: Date | string
) {
  const start = normalizeAttendanceDate(startDate);
  const end = normalizeAttendanceDate(endDate);

  const [staffList, records, approvedLeaves] = await Promise.all([
    prisma.staff.findMany({
      where: { tenantId },
      select: { id: true, name: true, roleBase: true, staffCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.staffAttendance.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
      },
    }),
    prisma.staffLeaveRequest.findMany({
      where: {
        tenantId,
        status: 'approved',
        OR: [
          { startDate: { gte: start, lte: end } },
          { endDate: { gte: start, lte: end } },
          { startDate: { lte: start }, endDate: { gte: end } },
        ],
      },
    }),
  ]);

  // Group records by staffId
  const staffRecords = new Map<string, typeof records>();
  for (const r of records) {
    if (!staffRecords.has(r.staffId)) staffRecords.set(r.staffId, []);
    staffRecords.get(r.staffId)!.push(r);
  }

  // Calculate day difference (excluding weekends)
  let expectedWorkingDays = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      expectedWorkingDays++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const timesheet = staffList.map((st) => {
    const list = staffRecords.get(st.id) || [];
    let presentDays = 0;
    let lateDays = 0;
    let excusedDays = 0;
    let totalLateMinutes = 0;

    for (const r of list) {
      if (r.status === 'present') presentDays++;
      else if (r.status === 'late') {
        lateDays++;
        totalLateMinutes += r.minutesLate;
      } else if (r.status === 'excused') excusedDays++;
    }

    const attendedDays = presentDays + lateDays;
    const absentDays = Math.max(0, expectedWorkingDays - attendedDays - excusedDays);
    const attendancePercentage = expectedWorkingDays > 0 ? Math.round((attendedDays / expectedWorkingDays) * 100) : 100;

    return {
      staffId: st.id,
      staffName: st.name,
      roleBase: st.roleBase,
      staffCode: st.staffCode || `STF-${st.id.slice(-4).toUpperCase()}`,
      expectedWorkingDays,
      presentDays,
      lateDays,
      absentDays,
      excusedDays,
      totalLateMinutes,
      attendancePercentage,
    };
  });

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    expectedWorkingDays,
    timesheet,
  };
}
