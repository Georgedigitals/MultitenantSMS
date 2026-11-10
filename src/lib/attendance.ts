import prisma from './prisma';
import { AttendanceStatus } from '@prisma/client';

export interface StudentAttendanceStat {
  studentId: string;
  studentName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalSchoolDays: number | null;
  percentage: number | null;
}

/**
 * Normalizes a date to midnight UTC for consistent single-day database indexing.
 */
export function normalizeAttendanceDate(input: Date | string): Date {
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Marks daily attendance for a class register (§5.3A).
 * Permitted only if the term results are not yet published.
 */
export async function markDailyAttendance(options: {
  tenantId: string;
  staffId: string;
  classLevelId: string;
  termId: string;
  date: Date | string;
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
  }>;
}) {
  const { tenantId, staffId, classLevelId, termId, date, records } = options;

  const normalizedDate = normalizeAttendanceDate(date);

  // 1. Check term and session
  const term = await prisma.term.findUnique({
    where: { id: termId },
  });
  if (!term) {
    throw new Error('Term not found or unauthorized');
  }
  const session = await prisma.academicSession.findUnique({
    where: { id: term.sessionId },
  });
  if (!session || session.tenantId !== tenantId) {
    throw new Error('Term not found or unauthorized');
  }

  // 2. Lock check: verify class results for this term are not published (§5.3A)
  const publishedCount = await prisma.resultEntry.count({
    where: {
      termId,
      status: 'published',
    },
  });

  if (publishedCount > 0) {
    throw new Error(
      'Attendance for this term is locked because results have already been published. A school admin must reopen the term to adjust attendance records.'
    );
  }

  // 3. Check existing records for this date so we only send absence SMS for newly marked absences
  const requestedStudentIds = records.map((r) => r.studentId);
  const existingForDate = requestedStudentIds.length > 0
    ? await prisma.attendanceRecord.findMany({
        where: {
          studentId: { in: requestedStudentIds },
          date: normalizedDate,
        },
        select: { studentId: true, status: true },
      })
    : [];
  const previouslyAbsentSet = new Set(
    existingForDate.filter((r) => r.status === 'absent').map((r) => r.studentId)
  );

  // 4. Upsert attendance records for each student
  const saved = [];
  const newlyAbsentStudentIds: string[] = [];
  for (const r of records) {
    const rec = await prisma.attendanceRecord.upsert({
      where: {
        studentId_date: {
          studentId: r.studentId,
          date: normalizedDate,
        },
      },
      update: {
        status: r.status,
        markedBy: staffId,
        termId,
      },
      create: {
        studentId: r.studentId,
        termId,
        date: normalizedDate,
        status: r.status,
        markedBy: staffId,
      },
    });
    saved.push(rec);
    if (r.status === 'absent' && !previouslyAbsentSet.has(r.studentId)) {
      newlyAbsentStudentIds.push(r.studentId);
    }
  }

  if (newlyAbsentStudentIds.length > 0) {
    const { dispatchAutoAbsentAlerts } = await import('./sms-service');
    void dispatchAutoAbsentAlerts({
      tenantId,
      date: normalizedDate,
      absentStudentIds: newlyAbsentStudentIds,
    });
  }

  return saved;
}

/**
 * Computes attendance percentage at read time (§5.3A).
 * Follows the ledger-not-cache principle: percentage is always calculated as
 * (days marked present) ÷ Term.totalSchoolDays. Never stored as a mutable running cache.
 */
export async function computeAttendanceStats(
  studentId: string,
  termId: string
): Promise<{
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalSchoolDays: number | null;
  percentage: number | null;
}> {
  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: { totalSchoolDays: true },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId, termId },
    select: { status: true },
  });

  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;

  for (const r of records) {
    if (r.status === 'present') presentDays++;
    else if (r.status === 'absent') absentDays++;
    else if (r.status === 'late') {
      lateDays++;
      // In standard Nigerian schools, late is considered present for total attendance
      presentDays++;
    }
  }

  const totalSchoolDays = term?.totalSchoolDays || null;
  let percentage: number | null = null;

  if (totalSchoolDays && totalSchoolDays > 0) {
    percentage = Math.round((presentDays / totalSchoolDays) * 1000) / 10;
  }

  return {
    presentDays,
    absentDays,
    lateDays,
    totalSchoolDays,
    percentage,
  };
}

/**
 * Fetches attendance register for a class on a specific date,
 * combining active enrolled students with any existing records.
 */
export async function getClassAttendanceForDate(
  tenantId: string,
  classLevelId: string,
  termId: string,
  date: Date | string
) {
  const normalizedDate = normalizeAttendanceDate(date);

  const term = await prisma.term.findUnique({
    where: { id: termId },
  });
  if (!term) throw new Error('Term not found');

  const session = await prisma.academicSession.findUnique({
    where: { id: term.sessionId },
  });
  if (!session || session.tenantId !== tenantId) {
    throw new Error('Term not found');
  }

  // 1. Get enrolled students
  const rawEnrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      status: 'active',
    },
  });

  const studentIds = rawEnrollments.map((e: any) => e.studentId);
  const students = studentIds.length > 0
    ? await prisma.student.findMany({
        where: { id: { in: studentIds }, tenantId },
      })
    : [];

  const studentMap = new Map(students.map((s: any) => [s.id, s]));
  const enrollments = rawEnrollments
    .filter((e: any) => studentMap.has(e.studentId))
    .map((e: any) => ({
      ...e,
      student: studentMap.get(e.studentId)!,
    }))
    .sort((a: any, b: any) => (a.student.name || '').localeCompare(b.student.name || ''));

  // 2. Get existing records for this date
  const records = await prisma.attendanceRecord.findMany({
    where: {
      termId,
      date: normalizedDate,
      studentId: { in: enrollments.map((e: any) => e.studentId) },
    },
  });

  const recordMap = new Map(records.map((r: any) => [r.studentId, r]));

  return enrollments.map((e: any) => {
    const existing: any = recordMap.get(e.studentId);
    return {
      studentId: e.studentId,
      studentName: e.student.name,
      status: existing ? existing.status : ('present' as AttendanceStatus),
      isMarked: existing !== undefined,
    };
  });
}
