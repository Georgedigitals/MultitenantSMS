import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { createTenantSnapshot, listTenantBackups } from '@/lib/backup/disaster-recovery';
import { BackupTrigger } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const backups = await listTenantBackups(access.tenant.id);
    return NextResponse.json({ backups });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to list tenant backups' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, name, trigger = 'manual' } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin']);
    if (!access.authorized || !access.tenant || !access.user) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const snapshot = await createTenantSnapshot({
      tenantId: access.tenant.id,
      name: name?.trim() || `Manual Snapshot ${new Date().toLocaleDateString()}`,
      trigger: trigger as BackupTrigger,
      createdById: access.user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Point-in-time backup snapshot created successfully',
      backup: snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create backup snapshot' },
      { status: 500 }
    );
  }
}
