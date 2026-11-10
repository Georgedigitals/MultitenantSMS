import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { recordAuditLog } from '@/lib/audit';
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_TRAITS,
  isValidTraitRatings,
} from '@/lib/report-card-domains';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { slug, classLevelId, termId, assessments } = body ?? {};
  if (
    typeof slug !== 'string' ||
    typeof classLevelId !== 'string' ||
    typeof termId !== 'string' ||
    !Array.isArray(assessments) ||
    assessments.length === 0 ||
    assessments.length > 500
  ) {
    return NextResponse.json({ error: 'A class, term, and valid student ratings are required' }, { status: 400 });
  }

  const tenant = await getTenantContext({ slug });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['school_admin', 'teacher'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Only school administrators and teachers can enter report card ratings' }, { status: 403 });
  }

  const term = await prisma.term.findFirst({
    where: { id: termId, session: { tenantId: tenant.id } },
    select: { id: true, sessionId: true },
  });
  if (!term) return NextResponse.json({ error: 'Term not found for this school' }, { status: 404 });

  const classLevel = await prisma.classLevel.findUnique({
    where: { id: classLevelId },
    select: { id: true },
  });
  if (!classLevel) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  const formTeacherAssignment = await prisma.formTeacherAssignment.findFirst({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      ...(auth.user.role === 'teacher' ? { staffId: auth.user.staffId || undefined } : {}),
    },
    select: { id: true, staffId: true },
  });
  if (auth.user.role === 'teacher' && (!auth.user.staffId || !formTeacherAssignment)) {
    return NextResponse.json({ error: 'Only the assigned form teacher can enter these ratings' }, { status: 403 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      status: 'active',
      student: { tenantId: tenant.id },
    },
    select: { studentId: true },
  });
  const rosterIds = new Set(enrollments.map((item) => item.studentId));
  const assessmentIds = new Set<string>();
  for (const assessment of assessments) {
    if (
      !assessment ||
      typeof assessment.studentId !== 'string' ||
      !rosterIds.has(assessment.studentId) ||
      assessmentIds.has(assessment.studentId) ||
      !isValidTraitRatings(assessment.affectiveRatings, AFFECTIVE_TRAITS) ||
      !isValidTraitRatings(assessment.psychomotorRatings, PSYCHOMOTOR_TRAITS)
    ) {
      return NextResponse.json({ error: 'Ratings contain an invalid student or score' }, { status: 400 });
    }
    assessmentIds.add(assessment.studentId);
  }

  const formTeacherId = auth.user.staffId || formTeacherAssignment?.staffId || (
    await prisma.staff.findFirst({ where: { tenantId: tenant.id }, select: { id: true } })
  )?.id;
  if (!formTeacherId) return NextResponse.json({ error: 'A staff profile is required to save ratings' }, { status: 400 });

  const saveBlockedReason = await prisma.$transaction(async (tx) => {
    const review = await tx.classResultReview.findFirst({
      where: { classLevelId, termId, term: { session: { tenantId: tenant.id } } },
      select: { submittedToAdminAt: true },
    });
    if (review?.submittedToAdminAt) return 'Ratings are locked after submission to the school administrator';

    const publishedCount = await tx.resultEntry.count({
      where: { termId, studentId: { in: [...rosterIds] }, status: 'published' },
    });
    if (publishedCount > 0) return 'Published report card ratings are locked. An administrator must reopen class results first.';

    for (const assessment of assessments) {
      const affectivePayload = {
        ...assessment.affectiveRatings,
        ...(typeof assessment.remarks === 'string' && assessment.remarks.trim() ? { _remarks: assessment.remarks.trim() } : {}),
      };

      await tx.reportCardAssessment.upsert({
        where: {
          tenantId_studentId_termId: {
            tenantId: tenant.id,
            studentId: assessment.studentId,
            termId,
          },
        },
        update: {
          tenantId: tenant.id,
          classLevelId,
          formTeacherId,
          affectiveRatings: affectivePayload,
          psychomotorRatings: assessment.psychomotorRatings,
        },
        create: {
          tenantId: tenant.id,
          studentId: assessment.studentId,
          classLevelId,
          termId,
          formTeacherId,
          affectiveRatings: affectivePayload,
          psychomotorRatings: assessment.psychomotorRatings,
        },
      });
    }
    return null;
  }, { isolationLevel: 'Serializable' });

  if (saveBlockedReason) return NextResponse.json({ error: saveBlockedReason }, { status: 409 });

  await recordAuditLog({
    tenantId: tenant.id,
    actorId: auth.user.id,
    actorName: auth.user.staffProfile?.name || auth.user.username,
    actorRole: auth.user.role,
    action: 'REPORT_CARD_ASSESSMENTS_SAVED',
    entityType: 'ReportCardAssessment',
    entityId: `${classLevelId}:${termId}`,
    details: { studentCount: assessments.length },
  });

  return NextResponse.json({ success: true, savedCount: assessments.length });
}
