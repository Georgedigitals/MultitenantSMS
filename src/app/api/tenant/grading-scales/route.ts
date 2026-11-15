import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantContext, isClassLevelWithinTenantRange } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const classLevelId = searchParams.get('classLevelId');

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

  let scales = await db.gradingScale.findMany({
    include: {
      lowestClassLevel: true,
      highestClassLevel: true,
    },
    orderBy: { minScore: 'desc' },
  });

  const seenScaleKeys = new Set<string>();
  scales = scales.filter((scale: any) => {
    const key = `${scale.lowestClassLevelId}_${scale.highestClassLevelId}_${scale.grade}_${Number(scale.minScore)}_${Number(scale.maxScore)}`;
    if (seenScaleKeys.has(key)) return false;
    seenScaleKeys.add(key);
    return true;
  });

  if (classLevelId) {
    const targetClass = await prisma.classLevel.findUnique({ where: { id: classLevelId } });
    if (targetClass) {
      scales = scales.filter((scale: any) => {
        const minOrder = Math.min(scale.lowestClassLevel.orderIndex, scale.highestClassLevel.orderIndex);
        const maxOrder = Math.max(scale.lowestClassLevel.orderIndex, scale.highestClassLevel.orderIndex);
        return targetClass.orderIndex >= minOrder && targetClass.orderIndex <= maxOrder;
      });
    }
  }

  return NextResponse.json({
    scales,
    canCustomize: true,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, scales } = body;

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const tenantContext = await getTenantContext({ slug });
  if (!tenantContext) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const auth = await getTenantUserFromCookies(tenantContext.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Only school admin can modify grading scales' }, { status: 403 });
  }

  if (!Array.isArray(scales) || scales.length === 0) {
    return NextResponse.json({ error: 'At least one grading scale entry is required' }, { status: 400 });
  }

  // Validate scales
  for (const s of scales) {
    if (!s.grade || typeof s.grade !== 'string') {
      return NextResponse.json({ error: 'Grade letter is required' }, { status: 400 });
    }
    if (!s.lowestClassLevelId || !s.highestClassLevelId) {
      return NextResponse.json({ error: 'Class level band boundaries are required' }, { status: 400 });
    }

    const min = Number(s.minScore);
    const max = Number(s.maxScore);
    if (isNaN(min) || isNaN(max) || min < 0 || max > 100 || min > max) {
      return NextResponse.json({ error: `Invalid score range [${s.minScore}, ${s.maxScore}] for grade ${s.grade}` }, { status: 400 });
    }

    // Verify class levels exist and are within tenant range
    const isLowestValid = await isClassLevelWithinTenantRange(tenantContext.id, s.lowestClassLevelId);
    const isHighestValid = await isClassLevelWithinTenantRange(tenantContext.id, s.highestClassLevelId);
    if (!isLowestValid || !isHighestValid) {
      return NextResponse.json({ error: `Class level range for grade ${s.grade} must be within school's active levels` }, { status: 400 });
    }
  }

  // Replace grading scales in a transaction
  await prisma.$transaction(async (tx: any) => {
    await tx.gradingScale.deleteMany({
      where: { tenantId: tenantContext.id },
    });

    for (const s of scales) {
      await tx.gradingScale.create({
        data: {
          tenantId: tenantContext.id,
          lowestClassLevelId: s.lowestClassLevelId,
          highestClassLevelId: s.highestClassLevelId,
          minScore: Number(s.minScore),
          maxScore: Number(s.maxScore),
          grade: s.grade.trim(),
          remark: (s.remark || '').trim(),
        },
      });
    }
  });

  const updated = await prisma.gradingScale.findMany({
    where: { tenantId: tenantContext.id },
    include: {
      lowestClassLevel: true,
      highestClassLevel: true,
    },
    orderBy: { minScore: 'desc' },
  });

  return NextResponse.json({
    message: 'Grading scales updated successfully',
    scales: updated,
  });
}
