import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { saveSubjectScores } from '@/lib/results';
import { computeTotal, previewGrade } from '@/lib/grading';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const classLevelId = searchParams.get('classLevelId');
  const subjectId = searchParams.get('subjectId');
  const termId = searchParams.get('termId');

  if (!slug || !classLevelId || !subjectId || !termId) {
    return NextResponse.json(
      { error: 'slug, classLevelId, subjectId, and termId are required' },
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

  const targetClass = await prisma.classLevel.findUnique({ where: { id: classLevelId } });
  if (!targetClass) return NextResponse.json({ error: 'Class level not found' }, { status: 404 });

  // Verify granular permission and teaching assignment
  const { hasPermission } = await import('@/lib/auth/permissions');
  const permitted = await hasPermission(auth.user, 'scores:enter', {
    classLevelId,
    subjectId,
    sessionId: term.sessionId,
  });
  if (!permitted) {
    return NextResponse.json(
      { error: 'Forbidden: You are not assigned to teach this subject in this class' },
      { status: 403 }
    );
  }

  // 1. Fetch active components
  let components = await prisma.assessmentComponent.findMany({
    where: { tenantId: tenant.id, termId },
    orderBy: { orderIndex: 'asc' },
  });
  if (components.length === 0) {
    components = await prisma.assessmentComponent.findMany({
      where: { tenantId: tenant.id, termId: null },
      orderBy: { orderIndex: 'asc' },
    });
  }
  if (components.length === 0) {
    const { ensureTenantAcademicDefaults } = await import('@/lib/tenant');
    await ensureTenantAcademicDefaults(tenant.id);
    components = await prisma.assessmentComponent.findMany({
      where: { tenantId: tenant.id, termId: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  // 2. Fetch scales for live preview
  const scales = await prisma.gradingScale.findMany({
    where: { tenantId: tenant.id },
    include: { lowestClassLevel: true, highestClassLevel: true },
    orderBy: { minScore: 'desc' },
  });

  // 3. Fetch active enrollments and filter by curriculum/electives for this subject
  const { getTenantCurriculum, resolveStudentSubjectIds } = await import('@/lib/curriculum');
  const [curriculumConfig, classAssignments, rawEnrollments] = await Promise.all([
    getTenantCurriculum(tenant.id),
    prisma.teachingAssignment.findMany({
      where: { classLevelId, sessionId: term.sessionId },
      select: { subjectId: true },
    }),
    prisma.enrollment.findMany({
      where: {
        classLevelId,
        sessionId: term.sessionId,
        status: 'active',
        student: { tenantId: tenant.id },
      },
      include: { student: true },
      orderBy: { student: { name: 'asc' } },
    }),
  ]);

  const allClassSubjectIds = Array.from(new Set(classAssignments.map((a: any) => a.subjectId)));
  if (!allClassSubjectIds.includes(subjectId)) {
    allClassSubjectIds.push(subjectId);
  }
  const teachingAssignmentsForClass = allClassSubjectIds.map((sid) => ({ subjectId: sid }));

  const enrollments = rawEnrollments.filter((e: any) => {
    const studentSubjectIds = resolveStudentSubjectIds({
      classLevelId,
      classLevel: targetClass,
      curriculum: curriculumConfig,
      studentContactInfo: e.student.guardianContactInfo,
      teachingAssignmentsForClass,
    });
    return studentSubjectIds.includes(subjectId);
  });

  // 4. Fetch existing entries
  const existingEntries = await prisma.resultEntry.findMany({
    where: {
      termId,
      subjectId,
      studentId: { in: enrollments.map((e: any) => e.studentId) },
    },
  });

  const entryMap = new Map(existingEntries.map((e: any) => [e.studentId, e]));

  const studentRows = enrollments.map((e: any) => {
    const entry: any = entryMap.get(e.studentId);
    const scoreData = (entry?.scoreData as Record<string, any>) || {};
    const total = computeTotal(scoreData, components);
    const preview = previewGrade(total, targetClass.orderIndex, scales);

    return {
      studentId: e.studentId,
      studentName: e.student.name,
      entryId: entry?.id || null,
      scores: scoreData,
      total,
      grade: entry?.grade || preview.grade, // Show frozen grade if published, otherwise preview
      status: entry?.status || 'not_started',
      comment: entry?.comment || '',
    };
  });

  const isLocked = existingEntries.some((e: any) =>
    ['form_teacher_reviewed', 'published'].includes(e.status)
  );

  return NextResponse.json({
    components,
    students: studentRows,
    isLocked,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, classLevelId, subjectId, termId, markAsSubmitted, entries } = body;

  if (!slug || !classLevelId || !subjectId || !termId || !Array.isArray(entries)) {
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

  // Verify granular permission and teaching assignment
  const { hasPermission } = await import('@/lib/auth/permissions');
  const permitted = await hasPermission(auth.user, 'scores:enter', {
    classLevelId,
    subjectId,
    sessionId: term.sessionId,
  });
  if (!permitted) {
    return NextResponse.json(
      { error: 'Forbidden: You are not assigned to teach this subject in this class' },
      { status: 403 }
    );
  }

  const teacherStaffId = auth.user.staffId;
  if (!teacherStaffId && auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only staff or admin can enter scores' }, { status: 403 });
  }

  // Use staffId or fallback for admin
  let effectiveTeacherId = teacherStaffId || (await prisma.staff.findFirst({ where: { tenantId: tenant.id } }))?.id;
  if (!effectiveTeacherId) {
    if (auth.user.role === 'school_admin') {
      const adminStaff = await prisma.staff.create({
        data: {
          tenantId: tenant.id,
          name: auth.user.username || 'School Administrator',
          roleBase: 'admin',
          contactInfo: { email: auth.user.username },
        },
      });
      await prisma.tenantUser.update({
        where: { id: auth.user.id },
        data: { staffId: adminStaff.id },
      });
      effectiveTeacherId = adminStaff.id;
    } else {
      return NextResponse.json({ error: 'No staff record associated with this account' }, { status: 400 });
    }
  }

  try {
    const saved = await saveSubjectScores({
      tenantId: tenant.id,
      teacherId: effectiveTeacherId,
      classLevelId,
      subjectId,
      termId,
      markAsSubmitted: Boolean(markAsSubmitted),
      entries,
    });

    return NextResponse.json({
      message: markAsSubmitted ? 'Scores submitted successfully' : 'Scores saved as draft',
      entries: saved,
    });
  } catch (err: any) {
    const isLockedError = err.message?.includes('locked');
    return NextResponse.json(
      { error: err.message || 'Failed to save scores' },
      { status: isLockedError ? 423 : 400 }
    );
  }
}
