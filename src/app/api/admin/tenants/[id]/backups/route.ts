import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { createTenantSnapshot, listTenantBackups } from '@/lib/backup/disaster-recovery';
import { BackupTrigger } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const auth = await getSuperAdminFromCookies();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
    }

    const backups = await listTenantBackups(tenantId);
    return NextResponse.json({ backups });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to list tenant backups' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const auth = await getSuperAdminFromCookies();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, trigger = 'manual' } = body;

    const snapshot = await createTenantSnapshot({
      tenantId,
      name: name?.trim() || `Super Admin Snapshot ${new Date().toLocaleDateString()}`,
      trigger: trigger as BackupTrigger,
      createdById: auth.superAdmin.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Super Admin point-in-time snapshot created successfully',
      backup: snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}
