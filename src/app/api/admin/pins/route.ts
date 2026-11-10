import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';

/** Stock must only be created after a school's verified PIN batch payment. */
export async function POST(_req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    error: 'Manual PIN generation is disabled. The school must order and pay for PIN stock from its own Result PIN dashboard.',
  }, { status: 409 });
}
