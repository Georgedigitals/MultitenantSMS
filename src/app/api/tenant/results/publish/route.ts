import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { publishClassResults, bulkPublishClassResults } from '@/lib/results';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, classLevelId, classLevelIds, termId, subjectId } = body;

  if (!slug || (!classLevelId && (!Array.isArray(classLevelIds) || classLevelIds.length === 0)) || !termId) {
    return NextResponse.json(
      { error: 'slug, termId, and classLevelId (or classLevelIds array) are required' },
      { status: 400 }
    );
  }

  const tenant = await getTenantContext({ slug });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json(
      { error: 'Only school administrators can publish results' },
      { status: 403 }
    );
  }

  try {
    // 1. Bulk publishing of multiple classes
    if (Array.isArray(classLevelIds) && classLevelIds.length > 0) {
      const bulkRes = await bulkPublishClassResults({
        tenantId: tenant.id,
        classLevelIds,
        termId,
      });

      return NextResponse.json({
        message: `Bulk publish complete: Published ${bulkRes.totalPublished} result entries across ${classLevelIds.length} classes.`,
        publishedCount: bulkRes.totalPublished,
        details: bulkRes.results,
      });
    }

    // 2. Single class (or course-specific) publishing
    const res = await publishClassResults({
      tenantId: tenant.id,
      classLevelId,
      termId,
      subjectId,
    });

    return NextResponse.json({
      message: subjectId
        ? `Successfully published ${res.publishedCount} course scores. Grades are now permanently frozen.`
        : `Successfully published ${res.publishedCount} result entries for this class. Grades have been permanently frozen.`,
      publishedCount: res.publishedCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to publish results' }, { status: 400 });
  }
}
