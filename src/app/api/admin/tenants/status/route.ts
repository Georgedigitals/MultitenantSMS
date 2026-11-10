import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { updateTenantStatus } from '@/lib/super-admin';
import { TenantStatus } from '@prisma/client';

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tenantId, status } = body;

    if (!tenantId || !status) {
      return NextResponse.json(
        { error: 'tenantId and status are required' },
        { status: 400 }
      );
    }

    const validStatuses: TenantStatus[] = ['active', 'suspended', 'cancelled', 'trial', 'archived'];
    if (!validStatuses.includes(status as TenantStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await updateTenantStatus(tenantId, status as TenantStatus);

    return NextResponse.json({
      success: true,
      tenant: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update tenant status' },
      { status: 400 }
    );
  }
}
