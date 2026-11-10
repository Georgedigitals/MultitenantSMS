/**
 * Teaching Assignments API
 * GET    /api/tenant/assignments?slug=apex&sessionId=...
 * POST   /api/tenant/assignments (school_admin only)
 * DELETE /api/tenant/assignments?slug=apex&id=... (school_admin only)
 *
 * Enforces PRD §4.1:
 * - ClassLevel must be within tenant's enabled range
 * - Staff belongs to tenant
 * - Subject belongs to tenant
 * - Session belongs to tenant
 * - Structural tenant isolation via getTenantDb
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
  const staffId = searchParams.get('staffId');
  const classLevelId = searchParams.get('classLevelId');

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
  if (staffId) whereClause.staffId = staffId;
  if (classLevelId) whereClause.classLevelId = classLevelId;

  const assignments = await db.teachingAssignment.findMany({
    where: whereClause,
    include: {
      staff: true,
      classLevel: true,
      subject: true,
      session: true,
    },
    orderBy: [
      { classLevel: { orderIndex: 'asc' } },
      { subject: { name: 'asc' } },
    ],
  });

  return NextResponse.json({ assignments });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, staffId, classLevelId, subjectId, sessionId } = body;

  if (!slug || !staffId || !classLevelId || !subjectId || !sessionId) {
    return NextResponse.json(
      { error: 'slug, staffId, classLevelId, subjectId, and sessionId are required' },
      { status: 400 }
    );
  }

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can create teaching assignments' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);

  // 1. Verify staff belongs to tenant
  const staff = await db.staff.findFirst({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: 'Staff member not found in this school' }, { status: 404 });

  // 2. Verify subject belongs to tenant
  const subject = await db.subject.findFirst({ where: { id: subjectId } });
  if (!subject) return NextResponse.json({ error: 'Subject not found in this school' }, { status: 404 });

  // 3. Verify session belongs to tenant
  const session = await db.academicSession.findFirst({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: 'Academic session not found in this school' }, { status: 404 });

  // 4. Verify class level is within tenant's enabled range (§4.1)
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

  // Create teaching assignment
  const assignment = await prisma.teachingAssignment.create({
    data: {
      staffId,
      classLevelId,
      subjectId,
      sessionId,
    },
    include: {
      staff: true,
      classLevel: true,
      subject: true,
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
    return NextResponse.json({ error: 'Only school admin can delete assignments' }, { status: 403 });
  }

  // Verify assignment belongs to this tenant
  const assignment = await prisma.teachingAssignment.findUnique({
    where: { id },
    include: { staff: true },
  });

  if (!assignment || assignment.staff.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const db = getTenantDb(tenant.id);
  await db.teachingAssignment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
