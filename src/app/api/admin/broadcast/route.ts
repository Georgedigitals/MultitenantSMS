import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { createSuperAdminBroadcast } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message, link, targetTenantIds } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message string is required' }, { status: 400 });
    }

    const result = await createSuperAdminBroadcast({
      message,
      link,
      targetTenantIds,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send broadcast notification' },
      { status: 400 }
    );
  }
}
