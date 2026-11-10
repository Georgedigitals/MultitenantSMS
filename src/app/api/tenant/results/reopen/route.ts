import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { reopenClassResults } from '@/lib/results';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, classLevelId, termId, reason } = body;

  if (!slug || !classLevelId || !termId || !reason) {
    return NextResponse.json(
      { error: 'slug, classLevelId, termId, and reason are required' },
      { status: 400 }
    );
  }

  const tenant = await getTenantContext({ slug });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth || auth.user.role !== 'school_admin') {
    return NextResponse.json(
      { error: 'Only school administrators can reopen class results' },
      { status: 403 }
    );
  }

  try {
    const res = await reopenClassResults({
      tenantId: tenant.id,
      userId: auth.user.id,
      classLevelId,
      termId,
      reason,
    });

    return NextResponse.json({
      message: `Reopened ${res.reopenedCount} result entries. Audit log recorded.`,
      reopenedCount: res.reopenedCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reopen results' }, { status: 400 });
  }
}
