/**
 * Form Teacher Assignments API
 * GET    /api/tenant/form-teachers?slug=apex&sessionId=...
 * POST   /api/tenant/form-teachers (school_admin only)
 * DELETE /api/tenant/form-teachers?slug=apex&id=... (school_admin only)
 *
 * Enforces PRD §4.1:
 * - One active form teacher per class per session (@@unique([classLevelId, sessionId]))
 * - At most one active FormTeacherAssignment per staff member per session
 * - Resolved against current session only — never a static flag on Staff
 * - Rows are immutable once created; new session produces new rows
 * - ClassLevel within tenant's enabled range
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { findTenantBySlugOrDomain } from '@/lib/tenant';

async function resolveTenant(slug: string | null) {
  if (!slug) return null;
  return findTenantBySlugOrDomain(slug, { id: true, lowestClassLevelId: true, highestClassLevelId: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const sessionId = searchParams.get('sessionId');

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['school_admin', 'teacher'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);

  // If no sessionId given, find current session for this tenant
  let targetSessionId: string | null = sessionId;
  if (!targetSessionId) {
    const currentSession = await db.academicSession.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });
    targetSessionId = currentSession ? currentSession.id : null;
  }

  if (!targetSessionId) {
    return NextResponse.json({ assignments: [] });
  }

  const assignments = await db.formTeacherAssignment.findMany({
    where: { sessionId: targetSessionId },
    include: {
      staff: true,
      classLevel: true,
      session: true,
    },
    orderBy: { classLevel: { orderIndex: 'asc' } },
  });

  return NextResponse.json({ assignments });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, staffId, classLevelId, sessionId } = body;

  if (!slug || !staffId || !classLevelId || !sessionId) {
    return NextResponse.json(
      { error: 'slug, staffId, classLevelId, and sessionId are required' },
      { status: 400 }
    );
  }

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can assign form teachers' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);

  // 1. Verify staff belongs to tenant
  const staff = await db.staff.findFirst({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: 'Staff member not found in this school' }, { status: 404 });

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

  // 4. §4.1: "at most one active FormTeacherAssignment per session" for a staff member
  const existingStaffAssignment = await prisma.formTeacherAssignment.findFirst({
    where: {
      staffId,
      sessionId,
      classLevelId: { not: classLevelId },
    },
    include: { classLevel: true },
  });

  if (existingStaffAssignment) {
    return NextResponse.json(
      {
        error: `${staff.name} is already assigned as form teacher for ${existingStaffAssignment.classLevel.name} in this session. A staff member can hold at most one form teacher assignment per session (§4.1).`,
      },
      { status: 422 }
    );
  }

  // 5. §4.1: "one active per class per session"
  // Upsert or create: if class already has a form teacher in this session, replace it atomically
  const assignment = await prisma.formTeacherAssignment.upsert({
    where: {
      classLevelId_sessionId: {
        classLevelId,
        sessionId,
      },
    },
    update: {
      staffId,
    },
    create: {
      staffId,
      classLevelId,
      sessionId,
    },
    include: {
      staff: true,
      classLevel: true,
      session: true,
    },
  });

  return NextResponse.json({ assignment }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const id = searchParams.get('id');

  if (!slug || !id) {
    return NextResponse.json({ error: 'slug and id are required' }, { status: 400 });
  }

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can unassign form teachers' }, { status: 403 });
  }

  // Verify assignment belongs to this tenant
  const assignment = await prisma.formTeacherAssignment.findUnique({
    where: { id },
    include: { staff: true },
  });

  if (!assignment || assignment.staff.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const db = getTenantDb(tenant.id);
  await db.formTeacherAssignment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
