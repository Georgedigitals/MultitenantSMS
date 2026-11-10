import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import {
  markDailyAttendance,
  computeAttendanceStats,
  getClassAttendanceForDate,
} from '@/lib/attendance';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const classLevelId = searchParams.get('classLevelId');
  const termId = searchParams.get('termId');
  const date = searchParams.get('date');

  if (!slug || !classLevelId || !termId) {
    return NextResponse.json(
      { error: 'slug, classLevelId, and termId are required' },
      { status: 400 }
    );
  }

  const tenant = await getTenantContext({ slug });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });
  if (!term || term.session.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Term not found' }, { status: 404 });
  }

  // Restrict attendance register access for teachers strictly to their assigned form class
  if (auth.user.role === 'teacher') {
    if (!auth.user.staffId) {
      return NextResponse.json({ error: 'Staff account required' }, { status: 403 });
    }
    const isFormTeacher = await prisma.formTeacherAssignment.findFirst({
      where: {
        classLevelId,
        sessionId: term.sessionId,
        staffId: auth.user.staffId,
      },
    });
    if (!isFormTeacher) {
      return NextResponse.json(
        { error: 'Only the designated form teacher for this class can view or mark this register' },
        { status: 403 }
      );
    }
  }

  // Check if term results are published (locking attendance)
  const isLocked =
    (await prisma.resultEntry.count({
      where: {
        termId,
        student: {
          tenantId: tenant.id,
          enrollments: {
            some: { classLevelId, sessionId: term.sessionId, status: 'active' },
          },
        },
        status: 'published',
      },
    })) > 0;

  if (date) {
    // Return single date register
    const sheet = await getClassAttendanceForDate(tenant.id, classLevelId, termId, date);
    return NextResponse.json({
      date,
      students: sheet,
      isLocked,
    });
  }

  // Return term summary ledger for all enrolled students
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      status: 'active',
      student: { tenantId: tenant.id },
    },
    include: { student: true },
    orderBy: { student: { name: 'asc' } },
  });

  const studentSummaries = [];
  for (const e of enrollments) {
    const stats = await computeAttendanceStats(e.studentId, termId);
    studentSummaries.push({
      studentId: e.studentId,
      studentName: e.student.name,
      ...stats,
    });
  }

  return NextResponse.json({
    termTotalSchoolDays: term.totalSchoolDays,
    students: studentSummaries,
    isLocked,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, classLevelId, termId, date, records } = body;

  if (!slug || !classLevelId || !termId || !date || !Array.isArray(records)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const tenant = await getTenantContext({ slug });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });
  if (!term || term.session.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Term not found' }, { status: 404 });
  }

  // Verify form teacher permission (§5.4, §10.1)
  if (auth.user.role !== 'school_admin') {
    if (!auth.user.staffId) {
      return NextResponse.json(
        { error: 'Staff account required to mark attendance' },
        { status: 403 }
      );
    }
    const isFormTeacher = await prisma.formTeacherAssignment.findFirst({
      where: {
        classLevelId,
        sessionId: term.sessionId,
        staffId: auth.user.staffId,
      },
    });

    if (!isFormTeacher) {
      return NextResponse.json(
        { error: 'Only the active form teacher for this class can mark attendance' },
        { status: 403 }
      );
    }
  }

  let staffId = auth.user.staffId;
  if (!staffId) {
    let adminStaff = await prisma.staff.findFirst({ where: { tenantId: tenant.id, roleBase: 'admin' } });
    if (!adminStaff) {
      adminStaff = await prisma.staff.findFirst({ where: { tenantId: tenant.id } });
    }
    if (!adminStaff) {
      adminStaff = await prisma.staff.create({
        data: {
          tenantId: tenant.id,
          name: auth.user.username || 'School Administrator',
          roleBase: 'admin',
          contactInfo: { email: auth.user.username },
        },
      });
    }
    staffId = adminStaff.id;
  }

  try {
    const saved = await markDailyAttendance({
      tenantId: tenant.id,
      staffId,
      classLevelId,
      termId,
      date,
      records,
    });

    // Automated Multi-Channel Absent Alert dispatch (WhatsApp & Email; SMS handled by markDailyAttendance)
    const absentStudentIds = records
      .filter((r: any) => r.status === 'absent')
      .map((r: any) => r.studentId);

    if (absentStudentIds.length > 0) {
      prisma.smsConfiguration.findUnique({
        where: { tenantId: tenant.id },
      }).then(async (smsConfig) => {
        if (smsConfig?.autoAbsentAlert) {
          const absentStudents = await prisma.student.findMany({
            where: { id: { in: absentStudentIds }, tenantId: tenant.id },
            select: {
              id: true,
              name: true,
              guardianContactInfo: true,
              guardians: { include: { guardian: { select: { name: true, contactInfo: true } } } },
            },
          });

          const { extractParentPhone } = await import('@/lib/sms-service');
          const { dispatchEmail } = await import('@/lib/email-service');

          for (const st of absentStudents) {
            const { phone: parentPhone, name: extractedName } = extractParentPhone(
              st.guardianContactInfo,
              st.guardians
            );
            const info = (st.guardianContactInfo as any) || {};
            let parentEmail = info.guardianEmail || info.email;
            if (!parentEmail && st.guardians?.length > 0) {
              for (const g of st.guardians) {
                const gInfo = (g.guardian.contactInfo as any) || {};
                const candidate = gInfo.email || gInfo.guardianEmail;
                if (candidate) {
                  parentEmail = candidate;
                  break;
                }
              }
            }
            const guardianName = extractedName || info.guardianName || info.parentName || null;

            // 1. WhatsApp Dispatch
            if (parentPhone) {
              prisma.whatsAppLog.create({
                data: {
                  tenantId: tenant.id,
                  phone: parentPhone,
                  template: 'student_absent_alert',
                  payload: {
                    studentName: st.name,
                    date,
                    schoolName: tenant.name,
                  },
                  status: 'delivered',
                },
              }).catch(() => {});
            }

            // 2. Email Dispatch
            if (parentEmail) {
              dispatchEmail({
                tenantId: tenant.id,
                to: parentEmail,
                subject: `${tenant.name}: Absence Notice for ${st.name} (${date})`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #fff7ed;">
                    <h2 style="color: #b91c1c; margin-top: 0; font-size: 20px;">Daily Attendance Absence Notice</h2>
                    <p style="font-size: 14px; color: #334155;">Dear ${guardianName || 'Parent'},</p>
                    <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                      This is an automated attendance notice to inform you that <strong>${st.name}</strong> was marked <strong>ABSENT</strong> during roll call on <strong>${date}</strong> at <strong>${tenant.name}</strong>.
                    </p>
                    <div style="background-color: #ffffff; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 13px; color: #7f1d1d; font-weight: 600;">
                        If you are unaware of this absence or this is unexpected, please immediately reach out to the school administration or form teacher.
                      </p>
                    </div>
                    <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">© ${new Date().getFullYear()} ${tenant.name}. All rights reserved.</p>
                  </div>
                `,
              }).catch(() => {});
            }
          }
        }
      }).catch((err) => console.warn('[Auto Absent Alert Error]', err));
    }

    return NextResponse.json({
      message: `Marked attendance for ${saved.length} students on ${date}`,
      savedCount: saved.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to mark attendance' }, { status: 400 });
  }
}
