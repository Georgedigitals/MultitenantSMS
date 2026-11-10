import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import prisma from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const { blockPromotionOnFeeBalance } = body;

    if (typeof blockPromotionOnFeeBalance !== 'boolean') {
      return NextResponse.json({ error: 'blockPromotionOnFeeBalance boolean is required' }, { status: 400 });
    }

    const tenant = await prisma.tenant.update({
      where: { id: auth.tenant.id },
      data: { blockPromotionOnFeeBalance },
    });

    return NextResponse.json({ blockPromotionOnFeeBalance: tenant.blockPromotionOnFeeBalance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
