/**
 * Enrollments API
 * GET   /api/tenant/enrollments?slug=apex&sessionId=...&classLevelId=...
 * POST  /api/tenant/enrollments (school_admin only: enroll student in session)
 * PATCH /api/tenant/enrollments (school_admin only: update status active/repeated/withdrawn)
 *
 * Enforces PRD §2 & §4.1:
 * - Scoped to session; new session = new rows, never mutated across sessions
 * - ClassLevel within tenant's enabled range
 * - @@unique([studentId, sessionId])
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { EnrollmentStatus } from '@prisma/client';
import { findTenantBySlugOrDomain } from '@/lib/tenant';

async function resolveTenant(slug: string | null) {
  if (!slug) return null;
  return findTenantBySlugOrDomain(slug, { id: true, lowestClassLevelId: true, highestClassLevelId: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const sessionId = searchParams.get('sessionId');
  const classLevelId = searchParams.get('classLevelId');
  const studentId = searchParams.get('studentId');

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['school_admin', 'teacher'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);
  const whereClause: any = {};
  if (sessionId) whereClause.sessionId = sessionId;
  if (classLevelId) whereClause.classLevelId = classLevelId;
  if (studentId) whereClause.studentId = studentId;

  const enrollments = await db.enrollment.findMany({
    where: whereClause,
    include: {
      student: true,
      classLevel: true,
      session: true,
    },
    orderBy: [
      { classLevel: { orderIndex: 'asc' } },
      { student: { name: 'asc' } },
    ],
  });

  return NextResponse.json({ enrollments });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, studentId, classLevelId, sessionId, status } = body;

  if (!slug || !studentId || !classLevelId || !sessionId) {
    return NextResponse.json(
      { error: 'slug, studentId, classLevelId, and sessionId are required' },
      { status: 400 }
    );
  }

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can enroll students' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);

  // 1. Verify student belongs to tenant
  const student = await db.student.findFirst({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });

  // 2. Verify session belongs to tenant
  const session = await db.academicSession.findFirst({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: 'Academic session not found in this school' }, { status: 404 });

  // 3. Verify class level is within tenant's enabled range (§4.1)
  const classLevel = await prisma.classLevel.findUnique({ where: { id: classLevelId } });
  if (!classLevel) return NextResponse.json({ error: 'Class level not found' }, { status: 404 });

  const [lowest, highest] = await Promise.all([
    tenant.lowestClassLevelId ? prisma.classLevel.findUnique({ where: { id: tenant.lowestClassLevelId } }) : null,
    tenant.highestClassLevelId ? prisma.classLevel.findUnique({ where: { id: tenant.highestClassLevelId } }) : null,
  ]);

  if (lowest && highest && (classLevel.orderIndex < lowest.orderIndex || classLevel.orderIndex > highest.orderIndex)) {
    return NextResponse.json(
      { error: `Class level "${classLevel.name}" is outside this school's enabled range (${lowest.name} – ${highest.name})` },
      { status: 422 }
    );
  }

  // 4. PRD §2: Scoped to session, one enrollment per student per session
  const existing = await prisma.enrollment.findUnique({
    where: {
      studentId_sessionId: {
        studentId,
        sessionId,
      },
    },
    include: { classLevel: true },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: `Student "${student.name}" is already enrolled in ${existing.classLevel.name} for this session. Enrollments are immutable per session (§2).`,
      },
      { status: 409 }
    );
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      classLevelId,
      sessionId,
      status: (status as EnrollmentStatus) || 'active',
    },
    include: {
      student: true,
      classLevel: true,
      session: true,
    },
  });

  return NextResponse.json({ enrollment }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { slug, id, status } = body;

  if (!slug || !id || !status) {
    return NextResponse.json({ error: 'slug, id, and status are required' }, { status: 400 });
  }

  if (!['active', 'repeated', 'withdrawn'].includes(status)) {
    return NextResponse.json({ error: 'status must be active, repeated, or withdrawn' }, { status: 400 });
  }

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can update enrollment status' }, { status: 403 });
  }

  // Verify enrollment belongs to this tenant
  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: { student: true },
  });

  if (!enrollment || enrollment.student.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Enrollment not found in this school' }, { status: 404 });
  }

  // Note: Student and Session cannot be mutated in-place (§2). Only status can change.
  const updated = await prisma.enrollment.update({
    where: { id },
    data: { status: status as EnrollmentStatus },
    include: {
      student: true,
      classLevel: true,
      session: true,
    },
  });

  return NextResponse.json({ enrollment: updated });
}
