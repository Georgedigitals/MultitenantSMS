/**
 * GET  /api/tenant/subjects?slug=apex
 *   → list all subjects for the tenant
 * POST /api/tenant/subjects
 *   → create a new subject (school_admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findTenantBySlugOrDomain } from '@/lib/tenant';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

async function resolveTenant(slug: string | null) {
  if (!slug) return null;
  return findTenantBySlugOrDomain(slug, { id: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['school_admin', 'teacher'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);
  const subjects = await db.subject.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({ subjects });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, name } = body;

  if (!slug || !name?.trim()) {
    return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
  }

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can create subjects' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);

  // Check for duplicate within this tenant (PRD §4 — tenantId + name unique)
  const existing = await db.subject.findFirst({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: `Subject "${name}" already exists` }, { status: 409 });
  }

  const subject = await db.subject.create({ data: { name: name.trim() } as any });
  return NextResponse.json({ subject }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

    if (!slug || !id) {
      return NextResponse.json({ error: 'slug and id parameters are required' }, { status: 400 });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school admin can delete subjects' }, { status: 403 });
    }

    const db = getTenantDb(tenant.id);

    const existing = await db.subject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Subject record not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete CBT attempts & questions for exams on this subject
      const exams = await tx.cbtExam.findMany({ where: { subjectId: id }, select: { id: true } });
      const examIds = exams.map((e: any) => e.id);
      if (examIds.length > 0) {
        await tx.cbtStudentAttempt.deleteMany({ where: { examId: { in: examIds } } });
        await tx.cbtQuestion.deleteMany({ where: { examId: { in: examIds } } });
        await tx.cbtExam.deleteMany({ where: { id: { in: examIds } } });
      }

      // 2. Delete result entries
      await tx.resultEntry.deleteMany({ where: { subjectId: id } });

      // 3. Delete teaching assignments
      await tx.teachingAssignment.deleteMany({ where: { subjectId: id } });

      // 4. Delete subject
      await tx.subject.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: `Subject "${existing.name}" permanently deleted.` });
  } catch (err: any) {
    console.error('Delete subject error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete subject' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, slug, name } = body;

    if (!id || !slug || !name?.trim()) {
      return NextResponse.json({ error: 'id, slug, and name are required' }, { status: 400 });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school admin can update subjects' }, { status: 403 });
    }

    const db = getTenantDb(tenant.id);
    const existing = await db.subject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Check for duplicate subject name
    const duplicate = await db.subject.findFirst({
      where: { name: name.trim(), id: { not: id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: `A subject named "${name.trim()}" already exists` }, { status: 409 });
    }

    const updatedSubject = await db.subject.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true, subject: updatedSubject });
  } catch (err: any) {
    console.error('Update subject error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update subject' }, { status: 500 });
  }
}

