import { NextRequest, NextResponse } from 'next/server';
import {
  destroySuperAdminSession,
  getSuperAdminFromCookies,
  SUPER_ADMIN_COOKIE_NAME,
} from '@/lib/auth/super-admin-auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SUPER_ADMIN_COOKIE_NAME)?.value;
  if (token) {
    await destroySuperAdminSession(token);
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SUPER_ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  return res;
}

export async function GET() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: auth.superAdmin,
  });
}
