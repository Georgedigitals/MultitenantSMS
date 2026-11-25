import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantCurriculum, saveTenantCurriculum, TenantCurriculumConfig } from '@/lib/curriculum';
import { findTenantBySlugOrDomain } from '@/lib/tenant';
import { getTenantClassLevels } from '@/lib/class-levels';

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const tenant = await findTenantBySlugOrDomain(slug, { id: true, name: true, lowestClassLevelId: true, highestClassLevelId: true });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [curriculum, allSubjects, allLevels] = await Promise.all([
      getTenantCurriculum(tenant.id),
      prisma.subject.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: 'asc' },
      }),
      getTenantClassLevels(tenant.id, { filterLegacyByRange: true }),
    ]);

    return NextResponse.json({
      success: true,
      curriculum,
      subjects: allSubjects,
      classLevels: allLevels,
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/curriculum error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch curriculum' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, curriculum } = body as { slug: string; curriculum: TenantCurriculumConfig };

    if (!slug || !curriculum || typeof curriculum !== 'object') {
      return NextResponse.json(
        { error: 'Tenant slug and curriculum configuration are required' },
        { status: 400 }
      );
    }

    const tenant = await findTenantBySlugOrDomain(slug, { id: true });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (auth.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Only school administrators can update class curriculum offerings' },
        { status: 403 }
      );
    }

    await saveTenantCurriculum(tenant.id, curriculum);

    return NextResponse.json({
      success: true,
      message: 'Class curriculum offerings updated successfully',
      curriculum,
    });
  } catch (err: any) {
    console.error('[POST /api/tenant/curriculum error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save curriculum' },
      { status: 500 }
    );
  }
}

