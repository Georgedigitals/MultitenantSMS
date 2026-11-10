import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { submitFormTeacherReview } from '@/lib/results';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, classLevelId, termId, overallRemarks } = body;

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
  if (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden: Staff or Administrator access required' }, { status: 403 });
  }

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });
  if (!term || term.session.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Term not found' }, { status: 404 });
  }

  // §5.2 — School Admin sends review feedback and requests corrections from form teacher
  if (body.action === 'request_corrections') {
    if (auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school administrators can request corrections' }, { status: 403 });
    }
    const { feedbackNotes } = body;
    if (!feedbackNotes || !feedbackNotes.trim()) {
      return NextResponse.json({ error: 'Feedback notes are required for requesting corrections' }, { status: 400 });
    }

    const review = await prisma.classResultReview.findUnique({
      where: { classLevelId_termId: { classLevelId, termId } },
      include: { formTeacher: true, classLevel: true },
    });

    if (!review) {
      return NextResponse.json({ error: 'No broadsheet review submission found for this class' }, { status: 404 });
    }

    // 1. Reset submittedToAdminAt so form teacher can re-edit and re-submit
    const updatedReview = await prisma.classResultReview.update({
      where: { id: review.id },
      data: {
        submittedToAdminAt: null,
        overallRemarks: `Admin Feedback (${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}): ${feedbackNotes.trim()}`,
      },
    });

    // 2. Unlock student entries back to submitted
    const enrollments = await prisma.enrollment.findMany({
      where: { classLevelId, status: 'active', student: { tenantId: tenant.id } },
      select: { studentId: true },
    });
    const sids = enrollments.map((e) => e.studentId);
    await prisma.resultEntry.updateMany({
      where: {
        termId,
        studentId: { in: sids },
        status: 'form_teacher_reviewed',
      },
      data: { status: 'submitted' },
    });

    // 3. Create Notification for form teacher user
    if (review.formTeacherId) {
      const teacherUser = await prisma.tenantUser.findFirst({
        where: { tenantId: tenant.id, staffId: review.formTeacherId },
      });
      if (teacherUser) {
        await prisma.notification.create({
          data: {
            tenantId: tenant.id,
            recipientId: teacherUser.id,
            recipientType: 'staff',
            message: `Admin requested corrections for ${review.classLevel.name} (${term.name}): "${feedbackNotes.trim()}". Please update scores and resubmit.`,
            type: 'result_review',
            link: '/dashboard/results',
          },
        }).catch(() => {});
      }
    }

    // 4. Record audit log entry
    await prisma.resultAuditLog.create({
      data: {
        tenantId: tenant.id,
        userId: auth.user.id,
        action: 'request_corrections',
        targetId: `${classLevelId}:${termId}`,
        reason: feedbackNotes.trim(),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Feedback dispatched to Form Teacher (${review.formTeacher.name}). Broadsheet returned for corrections.`,
      review: updatedReview,
    });
  }

  // Verify form teacher permission (§4.1, §5.2)
  const isFormTeacher = auth.user.staffId
    ? await prisma.formTeacherAssignment.findFirst({
        where: {
          classLevelId,
          sessionId: term.sessionId,
          staffId: auth.user.staffId,
        },
      })
    : null;

  if (!isFormTeacher && auth.user.role !== 'school_admin') {
    return NextResponse.json(
      { error: 'Only the assigned form teacher for this class can submit the broadsheet review' },
      { status: 403 }
    );
  }

  const effectiveStaffId =
    auth.user.staffId ||
    isFormTeacher?.staffId ||
    (
      await prisma.formTeacherAssignment.findFirst({
        where: { classLevelId, sessionId: term.sessionId },
        select: { staffId: true },
      })
    )?.staffId ||
    (await prisma.staff.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }))?.id;
  if (!effectiveStaffId) {
    return NextResponse.json({ error: 'Staff account required' }, { status: 400 });
  }

  try {
    const review = await submitFormTeacherReview({
      tenantId: tenant.id,
      formTeacherId: effectiveStaffId,
      classLevelId,
      termId,
      overallRemarks: overallRemarks || 'Satisfactory academic performance across class.',
    });

    // Notify School Admin that broadsheet results are awaiting admin approval
    const classLevel = await prisma.classLevel.findUnique({
      where: { id: classLevelId },
      select: { name: true },
    });
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        recipientId: 'school_admin_role',
        recipientType: 'school_admin',
        type: 'results_review_submitted',
        message: `Results submitted for ${classLevel?.name || 'Class'} (${term.name}) by Form Teacher. Broadsheet is awaiting admin review & publishing.`,
        link: '/dashboard/results',
      },
    }).catch(() => {});

    return NextResponse.json({
      message: 'Class results reviewed and submitted to school admin',
      review,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit review' }, { status: 400 });
  }
}
