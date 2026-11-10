import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { findTenantBySlugOrDomain } from '@/lib/tenant';
import { getTenantCurriculum, saveTenantCurriculum } from '@/lib/curriculum';

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const tenant = await findTenantBySlugOrDomain(slug, {
      id: true,
      name: true,
      slug: true,
      lowestClassLevelId: true,
      highestClassLevelId: true,
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['school_admin', 'teacher'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch current academic session
    const currentSession = await prisma.academicSession.findFirst({
      where: { tenantId: tenant.id, isCurrent: true },
      select: { id: true, label: true, isCurrent: true },
    });

    // 2. Fetch tenant enabled class levels
    const [lowest, highest, allClassLevels] = await Promise.all([
      tenant.lowestClassLevelId ? prisma.classLevel.findUnique({ where: { id: tenant.lowestClassLevelId } }) : null,
      tenant.highestClassLevelId ? prisma.classLevel.findUnique({ where: { id: tenant.highestClassLevelId } }) : null,
      prisma.classLevel.findMany({ orderBy: { orderIndex: 'asc' } }),
    ]);

    const activeLevels = allClassLevels.filter((lvl) => {
      if (!lowest || !highest) return true;
      return lvl.orderIndex >= lowest.orderIndex && lvl.orderIndex <= highest.orderIndex;
    });

    // 3. Fetch all staff and subjects
    const [staffList, allSubjects, curriculum] = await Promise.all([
      prisma.staff.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, name: true, roleBase: true, contactInfo: true },
        orderBy: { name: 'asc' },
      }),
      prisma.subject.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      getTenantCurriculum(tenant.id),
    ]);

    const subjectsMap = new Map(allSubjects.map((s) => [s.id, s.name]));
    const staffMap = new Map(staffList.map((st) => [st.id, st]));

    // 4. Fetch assignments and student enrollments for current session
    const sessionId = currentSession?.id || null;

    let formAssignments: any[] = [];
    let teachingAssignments: any[] = [];
    let enrollments: any[] = [];

    if (sessionId) {
      [formAssignments, teachingAssignments, enrollments] = await Promise.all([
        prisma.formTeacherAssignment.findMany({
          where: { sessionId },
          include: { staff: { select: { id: true, name: true } } },
        }),
        prisma.teachingAssignment.findMany({
          where: { sessionId },
          include: { staff: { select: { id: true, name: true } } },
        }),
        prisma.enrollment.findMany({
          where: { sessionId, status: 'active' },
          select: { classLevelId: true, studentId: true },
        }),
      ]);
    }

    const formTeacherMap = new Map(formAssignments.map((fa) => [fa.classLevelId, fa.staff]));
    const teachingMap = new Map<string, { id: string; name: string }>(); // key: `${classLevelId}_${subjectId}`
    for (const ta of teachingAssignments) {
      teachingMap.set(`${ta.classLevelId}_${ta.subjectId}`, ta.staff);
    }

    const enrollmentCounts = new Map<string, number>();
    for (const e of enrollments) {
      enrollmentCounts.set(e.classLevelId, (enrollmentCounts.get(e.classLevelId) || 0) + 1);
    }

    // 5. Structure classes with division and readiness
    const classes = activeLevels.map((lvl) => {
      const isEarlyYears = lvl.orderIndex <= 6 || /nursery|creche|kg|kindergarten|primary\s*[1-3]\b/i.test(lvl.name);
      
      let division: 'early_years' | 'primary' | 'junior_secondary' | 'senior_secondary' = 'primary';
      if (/creche|nursery|kg|kindergarten/i.test(lvl.name) || lvl.orderIndex <= 3) {
        division = 'early_years';
      } else if (/primary/i.test(lvl.name) || (lvl.orderIndex >= 4 && lvl.orderIndex <= 9)) {
        division = 'primary';
      } else if (/jss|junior/i.test(lvl.name) || (lvl.orderIndex >= 10 && lvl.orderIndex <= 12)) {
        division = 'junior_secondary';
      } else {
        division = 'senior_secondary';
      }

      // Offerings from curriculum config
      const rawOfferings = curriculum.classes[lvl.id] || [];
      const classSubjects = rawOfferings
        .map((off) => {
          const subjectName = subjectsMap.get(off.subjectId);
          if (!subjectName) return null;
          const assignedTeacher = teachingMap.get(`${lvl.id}_${off.subjectId}`) || null;
          return {
            id: off.subjectId,
            name: subjectName,
            isElective: Boolean(off.isElective),
            assignedTeacher,
          };
        })
        .filter(Boolean) as Array<{
          id: string;
          name: string;
          isElective: boolean;
          assignedTeacher: { id: string; name: string } | null;
        }>;

      const formTeacher = formTeacherMap.get(lvl.id) || null;
      const studentCount = enrollmentCounts.get(lvl.id) || 0;

      const totalSubjects = classSubjects.length;
      const assignedSubjects = classSubjects.filter((s) => s.assignedTeacher !== null).length;

      const issues: string[] = [];
      if (!formTeacher) {
        issues.push('No Form Teacher assigned');
      }
      if (totalSubjects === 0) {
        issues.push('No subjects added to curriculum');
      } else if (assignedSubjects < totalSubjects) {
        const unassignedCount = totalSubjects - assignedSubjects;
        issues.push(`${unassignedCount} subject${unassignedCount > 1 ? 's' : ''} missing teachers`);
      }
      if (studentCount === 0) {
        issues.push('No students enrolled yet');
      }

      let readiness: 'ready' | 'needs_attention' | 'unconfigured' = 'unconfigured';
      if (formTeacher && totalSubjects > 0 && assignedSubjects === totalSubjects && studentCount > 0) {
        readiness = 'ready';
      } else if (formTeacher || totalSubjects > 0 || studentCount > 0) {
        readiness = 'needs_attention';
      }

      return {
        id: lvl.id,
        name: lvl.name,
        orderIndex: lvl.orderIndex,
        division,
        isEarlyYears,
        formTeacher,
        studentCount,
        subjects: classSubjects,
        totalSubjects,
        assignedSubjects,
        issues,
        readiness,
      };
    });

    return NextResponse.json({
      success: true,
      currentSession,
      classes,
      staffList,
      allSubjects,
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/classes/hub error]', err);
    return NextResponse.json({ error: err?.message || 'Failed to load classroom hub' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, action, classLevelId, sessionId } = body;

    if (!slug || !action || !classLevelId) {
      return NextResponse.json({ error: 'slug, action, and classLevelId are required' }, { status: 400 });
    }

    const tenant = await findTenantBySlugOrDomain(slug, { id: true, name: true, slug: true });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school administrators can modify classroom allocations' }, { status: 403 });
    }

    // Resolve target session
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const current = await prisma.academicSession.findFirst({
        where: { tenantId: tenant.id, isCurrent: true },
        select: { id: true },
      });
      targetSessionId = current?.id;
    }

    if (!targetSessionId) {
      return NextResponse.json({ error: 'An active academic session is required for allocations' }, { status: 400 });
    }

    // ── Action 1: Set Form Teacher ──────────────────────────────────────────
    if (action === 'set_form_teacher') {
      const { staffId } = body;
      if (staffId) {
        await prisma.formTeacherAssignment.upsert({
          where: { classLevelId_sessionId: { classLevelId, sessionId: targetSessionId } },
          update: { staffId },
          create: { staffId, classLevelId, sessionId: targetSessionId },
        });
      } else {
        await prisma.formTeacherAssignment.deleteMany({
          where: { classLevelId, sessionId: targetSessionId },
        });
      }
      return NextResponse.json({ success: true, message: 'Form teacher updated successfully' });
    }

    // ── Action 2: Assign Class Teacher to ALL Subjects (Primary/Nursery Mode) ──
    if (action === 'assign_class_teacher_all') {
      const { staffId } = body;
      if (!staffId) {
        return NextResponse.json({ error: 'Staff member is required' }, { status: 400 });
      }

      // 1. Fetch or initialize subjects for this class (outside transaction)
      let curriculum = await getTenantCurriculum(tenant.id);
      let classOfferings = curriculum.classes[classLevelId] || [];

      // If class has no subjects in curriculum yet, auto-add all tenant subjects to it
      if (classOfferings.length === 0) {
        const tenantSubjects = await prisma.subject.findMany({
          where: { tenantId: tenant.id },
          select: { id: true },
        });
        classOfferings = tenantSubjects.map((s) => ({ subjectId: s.id, isElective: false }));
        curriculum.classes[classLevelId] = classOfferings;
        await saveTenantCurriculum(tenant.id, curriculum);
      }

      // 2. Perform atomic assignment writes
      await prisma.$transaction(
        async (tx) => {
          // Set as Form Teacher
          await tx.formTeacherAssignment.upsert({
            where: { classLevelId_sessionId: { classLevelId, sessionId: targetSessionId } },
            update: { staffId },
            create: { staffId, classLevelId, sessionId: targetSessionId },
          });

          // Clear existing teaching assignments for this class & session
          await tx.teachingAssignment.deleteMany({
            where: { classLevelId, sessionId: targetSessionId },
          });

          // Batch-assign this teacher to all subjects in this class
          if (classOfferings.length > 0) {
            await tx.teachingAssignment.createMany({
              data: classOfferings.map((off) => ({
                staffId,
                classLevelId,
                subjectId: off.subjectId,
                sessionId: targetSessionId,
              })),
            });
          }
        },
        { timeout: 15000 }
      );

      return NextResponse.json({
        success: true,
        message: 'Class teacher assigned to all subjects and designated as Form Teacher successfully',
      });
    }

    // ── Action 3: Assign / Change Single Subject Teacher ────────────────────
    if (action === 'assign_subject_teacher') {
      const { subjectId, staffId } = body;
      if (!subjectId) {
        return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
      }

      // 1. Ensure subject is in curriculum for this class (outside transaction)
      const curriculum = await getTenantCurriculum(tenant.id);
      const offerings = curriculum.classes[classLevelId] || [];
      if (!offerings.some((o) => o.subjectId === subjectId)) {
        curriculum.classes[classLevelId] = [...offerings, { subjectId, isElective: false }];
        await saveTenantCurriculum(tenant.id, curriculum);
      }

      // 2. Atomically update teaching assignment
      await prisma.$transaction(
        async (tx) => {
          await tx.teachingAssignment.deleteMany({
            where: { classLevelId, subjectId, sessionId: targetSessionId },
          });

          if (staffId) {
            await tx.teachingAssignment.create({
              data: { staffId, classLevelId, subjectId, sessionId: targetSessionId },
            });
          }
        },
        { timeout: 15000 }
      );

      return NextResponse.json({ success: true, message: 'Subject teacher updated successfully' });
    }

    // ── Action 4: Toggle Subject in Class Curriculum ─────────────────────────
    if (action === 'toggle_class_subject') {
      const { subjectId, enabled } = body;
      if (!subjectId) {
        return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
      }

      const curriculum = await getTenantCurriculum(tenant.id);
      const offerings = curriculum.classes[classLevelId] || [];

      if (enabled) {
        if (!offerings.some((o) => o.subjectId === subjectId)) {
          curriculum.classes[classLevelId] = [...offerings, { subjectId, isElective: false }];
        }
      } else {
        curriculum.classes[classLevelId] = offerings.filter((o) => o.subjectId !== subjectId);
        // Also remove any existing teaching assignment for that removed subject
        await prisma.teachingAssignment.deleteMany({
          where: { classLevelId, subjectId, sessionId: targetSessionId },
        });
      }

      await saveTenantCurriculum(tenant.id, curriculum);
      return NextResponse.json({ success: true, message: 'Class subject updated successfully' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/tenant/classes/hub error]', err);
    return NextResponse.json({ error: err?.message || 'Operation failed' }, { status: 500 });
  }
}

