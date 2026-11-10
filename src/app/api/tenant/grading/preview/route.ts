import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { computeTotal, previewGrade } from '@/lib/grading';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, scoreData, classLevelId, termId } = body;

  if (!slug || !scoreData || !classLevelId) {
    return NextResponse.json(
      { error: 'slug, scoreData, and classLevelId are required' },
      { status: 400 }
    );
  }

  const tenantContext = await getTenantContext({ slug });
  if (!tenantContext) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const auth = await getTenantUserFromCookies(tenantContext.id);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetClass = await prisma.classLevel.findUnique({
    where: { id: classLevelId },
  });
  if (!targetClass) {
    return NextResponse.json({ error: 'Class level not found' }, { status: 404 });
  }

  const db = getTenantDb(tenantContext.id);

  // 1. Fetch components
  let components: any[] = [];
  if (termId) {
    components = await db.assessmentComponent.findMany({
      where: { termId },
      orderBy: { orderIndex: 'asc' },
    });
  }
  if (components.length === 0) {
    components = await db.assessmentComponent.findMany({
      where: { termId: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  // 2. Fetch scales
  const scales = await db.gradingScale.findMany({
    include: {
      lowestClassLevel: true,
      highestClassLevel: true,
    },
    orderBy: { minScore: 'desc' },
  });

  // 3. Compute total and resolve preview grade
  const total = computeTotal(scoreData, components);
  const preview = previewGrade(total, targetClass.orderIndex, scales);

  return NextResponse.json(preview);
}
