import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { getTenantBackup } from '@/lib/backup/disaster-recovery';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: backupId } = await params;
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const backup = await getTenantBackup(access.tenant.id, backupId);

    const filename = `snapshot-${slug}-${backup.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
    const jsonString = JSON.stringify(backup.snapshotData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to download backup snapshot' },
      { status: 404 }
    );
  }
}
