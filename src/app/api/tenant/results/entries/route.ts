import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { saveSubjectScores } from '@/lib/results';
import { computeTotal, previewGrade } from '@/lib/grading';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';

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

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const termId = searchParams.get('termId');
    const subjectId = searchParams.get('subjectId');
    const studentId = searchParams.get('studentId');
    const classLevelId = searchParams.get('classLevelId');
    const clearAll = searchParams.get('clearAll') === 'true';
    const removeFromClass = searchParams.get('removeFromClass') === 'true';

    if (!slug || !termId || !subjectId) {
      return NextResponse.json(
        { error: 'slug, termId, and subjectId are required' },
        { status: 400 }
      );
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only school administrators can delete result entries' },
        { status: 403 }
      );
    }

    const [term, subject] = await Promise.all([
      prisma.term.findUnique({ where: { id: termId }, include: { session: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: tenant.id } }),
    ]);

    if (!term || term.session.tenantId !== tenant.id || !subject) {
      return NextResponse.json({ error: 'Term or subject not found for this school' }, { status: 404 });
    }

    // Mode 1: Clear all subject scores for a class in this term (and optionally unassign subject from ONLY this class)
    if ((clearAll || removeFromClass) && classLevelId) {
      const targetClass = await prisma.classLevel.findFirst({
        where: { id: classLevelId, OR: [{ tenantId: tenant.id }, { tenantId: null }] },
        select: { id: true, name: true },
      });
      if (!targetClass) {
        return NextResponse.json({ error: 'Class level not found for this school' }, { status: 404 });
      }

      const enrollments = await prisma.enrollment.findMany({
        where: {
          classLevelId,
          sessionId: term.sessionId,
          student: { tenantId: tenant.id },
        },
        select: { studentId: true },
      });
      const classStudentIds = enrollments.map((e) => e.studentId);

      if (classStudentIds.length > 0) {
        const publishedCount = await prisma.resultEntry.count({
          where: {
            termId,
            subjectId,
            studentId: { in: classStudentIds },
            status: 'published',
          },
        });
        if (publishedCount > 0) {
          return NextResponse.json(
            { error: 'Cannot delete or remove published results. Reopen the class results first.' },
            { status: 409 }
          );
        }
      }

      const { getTenantCurriculum } = await import('@/lib/curriculum');
      const currentCurriculum = removeFromClass ? await getTenantCurriculum(tenant.id) : null;

      const { deletedScoresCount, removedAssignmentsCount } = await prisma.$transaction(async (tx) => {
        const deleted =
          classStudentIds.length > 0
            ? await tx.resultEntry.deleteMany({
                where: {
                  termId,
                  subjectId,
                  studentId: { in: classStudentIds },
                },
              })
            : { count: 0 };

        let removedAllocations = 0;
        if (removeFromClass) {
          const delAssign = await tx.teachingAssignment.deleteMany({
            where: {
              classLevelId,
              subjectId,
              sessionId: term.sessionId,
              staff: { tenantId: tenant.id },
            },
          });
          removedAllocations = delAssign.count;

          if (currentCurriculum && Array.isArray(currentCurriculum.classes?.[classLevelId])) {
            const nextOfferings = currentCurriculum.classes[classLevelId].filter(
              (item: any) => item.subjectId !== subjectId
            );
            if (nextOfferings.length !== currentCurriculum.classes[classLevelId].length) {
              const nextConfig = {
                ...currentCurriculum,
                classes: {
                  ...currentCurriculum.classes,
                  [classLevelId]: nextOfferings,
                },
              };
              await tx.siteContent.upsert({
                where: { tenantId_page: { tenantId: tenant.id, page: 'curriculum' } },
                create: { tenantId: tenant.id, page: 'curriculum', content: nextConfig as any },
                update: { content: nextConfig as any },
              });
            }
          }
        }

        return {
          deletedScoresCount: deleted.count,
          removedAssignmentsCount: removedAllocations,
        };
      });

      await recordAuditLog({
        tenantId: tenant.id,
        actorId: auth.user.id,
        actorName: auth.user.staffProfile?.name || auth.user.username,
        actorRole: auth.user.role,
        action: removeFromClass ? 'SUBJECT_REMOVED_FROM_CLASS' : 'SUBJECT_RESULTS_CLEARED',
        entityType: 'ResultEntry',
        entityId: `${classLevelId}:${subjectId}:${termId}`,
        details: {
          className: targetClass.name,
          subjectName: subject.name,
          termName: term.name,
          classLevelId,
          deletedScoresCount,
          removedAssignmentsCount,
          removeFromClass,
        },
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({
        success: true,
        deletedCount: deletedScoresCount,
        removedFromClass: removeFromClass,
        message: removeFromClass
          ? `Removed ${subject.name} from ${targetClass.name} (and cleared ${deletedScoresCount} saved score${deletedScoresCount === 1 ? '' : 's'}). Other classes taking ${subject.name} are unaffected.`
          : `Cleared ${deletedScoresCount} result entr${deletedScoresCount === 1 ? 'y' : 'ies'} for ${subject.name} in ${targetClass.name}.`,
      });
    }

    // Mode 2: Delete a single student's result entry
    if (!studentId) {
      return NextResponse.json(
        { error: 'Provide studentId or clearAll=true with classLevelId' },
        { status: 400 }
      );
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId: tenant.id },
      select: { id: true, name: true },
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found for this school' }, { status: 404 });
    }

    const existingEntry = await prisma.resultEntry.findUnique({
      where: {
        studentId_subjectId_termId: {
          studentId: student.id,
          subjectId,
          termId,
        },
      },
    });
    if (!existingEntry) {
      return NextResponse.json({ error: 'No saved result entry found for this student' }, { status: 404 });
    }
    if (existingEntry.status === 'published') {
      return NextResponse.json(
        { error: 'Cannot delete a published result entry. Reopen the class results first.' },
        { status: 409 }
      );
    }

    await prisma.resultEntry.delete({ where: { id: existingEntry.id } });

    await recordAuditLog({
      tenantId: tenant.id,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'RESULT_ENTRY_DELETED',
      entityType: 'ResultEntry',
      entityId: existingEntry.id,
      details: {
        studentId: student.id,
        studentName: student.name,
        subjectName: subject.name,
        termName: term.name,
        previousScores: existingEntry.scoreData,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${subject.name} result entry for ${student.name}.`,
    });
  } catch (error: any) {
    console.error('[DELETE /api/tenant/results/entries]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete result entry' },
      { status: 500 }
    );
  }
}
