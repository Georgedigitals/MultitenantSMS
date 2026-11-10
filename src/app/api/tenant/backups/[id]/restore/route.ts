import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { restoreTenantFromSnapshot } from '@/lib/backup/disaster-recovery';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: backupId } = await params;
    const body = await req.json();
    const { slug, confirmSlug, autoSafetyBackup = true } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    if (confirmSlug?.trim() !== slug) {
      return NextResponse.json(
        { error: `Confirmation mismatch: You must enter the exact school slug "${slug}" to authorize state rollback.` },
        { status: 400 }
      );
    }

    const access = await requireTenantAccess(slug, ['school_admin']);
    if (!access.authorized || !access.tenant || !access.user) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const result = await restoreTenantFromSnapshot({
      tenantId: access.tenant.id,
      backupId,
      restoredById: access.user.id,
      autoSafetyBackup,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to execute point-in-time restoration' },
      { status: 500 }
    );
  }
}
