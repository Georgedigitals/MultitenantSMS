import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';

export async function GET(req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get('batchId');

  if (!batchId) {
    return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
  }

  try {
    const pins = await prisma.generatedPin.findMany({
      where: { batchId },
      select: {
        id: true,
        serialNumber: true,
        pinCode: true,
        pricePaid: true,
        isUsed: true,
        createdAt: true,
      },
      orderBy: { serialNumber: 'asc' },
    });

    return NextResponse.json({ success: true, pins });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to export batch pins' }, { status: 500 });
  }
}
