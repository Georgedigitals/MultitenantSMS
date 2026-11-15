import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const termId = searchParams.get('termId');

  if (!slug) {
    return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
  }

  const tenantContext = await getTenantContext({ slug });
  if (!tenantContext) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const auth = await getTenantUserFromCookies(tenantContext.id);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getTenantDb(tenantContext.id);

  let components: any[] = [];
  let isLocked = false;

  if (termId) {
    // Check if results exist for this term in status >= submitted (§5A.7)
    const existingSubmission = await prisma.resultEntry.findFirst({
      where: {
        termId,
        student: { tenantId: tenantContext.id },
        status: { in: ['submitted', 'form_teacher_reviewed', 'published'] },
      },
    });
    isLocked = existingSubmission !== null;

    // 1. Try term-specific components
    components = await db.assessmentComponent.findMany({
      where: { termId },
      orderBy: { orderIndex: 'asc' },
    });

    // 2. Fall back to tenant-level defaults (termId: null)
    if (components.length === 0) {
      components = await db.assessmentComponent.findMany({
        where: { termId: null },
        orderBy: { orderIndex: 'asc' },
      });
    }
  } else {
    // Return all components
    components = await db.assessmentComponent.findMany({
      orderBy: [{ termId: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  const canCustomize = true;

  return NextResponse.json({
    components,
    isLocked,
    canCustomize,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, termId, components } = body;

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const tenantContext = await getTenantContext({ slug });
  if (!tenantContext) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const auth = await getTenantUserFromCookies(tenantContext.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can modify assessment components' }, { status: 403 });
  }

  if (!Array.isArray(components) || components.length === 0) {
    return NextResponse.json({ error: 'At least one assessment component is required' }, { status: 400 });
  }

  if (components.length < 1 || components.length > 6) {
    return NextResponse.json({ error: 'You can configure between 1 and 6 assessment components.' }, { status: 400 });
  }

  const orderedComponents = [...components].sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));

  // Validate weights sum to 100%
  let totalWeight = 0;
  for (let index = 0; index < orderedComponents.length; index++) {
    const c = orderedComponents[index];
    if (!c.name || typeof c.name !== 'string') {
      return NextResponse.json({ error: 'Component name is required' }, { status: 400 });
    }
    const max = Number(c.maxScore);
    const weight = Number(c.weightPercent);
    if (!Number.isInteger(max) || max <= 0 || max > 100) {
      return NextResponse.json({ error: `Invalid maxScore for component "${c.name}". Must be between 1 and 100.` }, { status: 400 });
    }
    if (isNaN(weight) || weight <= 0) {
      return NextResponse.json({ error: `Invalid weightPercent for component "${c.name}"` }, { status: 400 });
    }
    totalWeight += weight;
  }

  if (Math.abs(totalWeight - 100) > 0.01) {
    return NextResponse.json(
      { error: `Component weights must sum to 100% (currently ${totalWeight}%)` },
      { status: 400 }
    );
  }

  // §5A.7 — Server-side lock check: cannot modify structure once scores have been submitted
  if (termId) {
    const existingSubmission = await prisma.resultEntry.findFirst({
      where: {
        termId,
        student: { tenantId: tenantContext.id },
        status: { in: ['submitted', 'form_teacher_reviewed', 'published'] },
      },
    });

    if (existingSubmission) {
      return NextResponse.json(
        { error: 'Assessment structure is locked because results have already been submitted or published for this term' },
        { status: 400 }
      );
    }
  }

  // Replace components for this target (termId or default)
  const targetTermId = termId || null;

  await prisma.$transaction(async (tx: any) => {
    // Delete existing components for this scope
    await tx.assessmentComponent.deleteMany({
      where: {
        tenantId: tenantContext.id,
        termId: targetTermId,
      },
    });

    // Create new ones
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      await tx.assessmentComponent.create({
        data: {
          tenantId: tenantContext.id,
          termId: targetTermId,
          name: c.name.trim(),
          maxScore: Number(c.maxScore),
          weightPercent: Number(c.weightPercent),
          orderIndex: c.orderIndex !== undefined ? Number(c.orderIndex) : i + 1,
        },
      });
    }
  });

  const updated = await prisma.assessmentComponent.findMany({
    where: {
      tenantId: tenantContext.id,
      termId: targetTermId,
    },
    orderBy: { orderIndex: 'asc' },
  });

  return NextResponse.json({
    message: 'Assessment components updated successfully',
    components: updated,
  });
}
