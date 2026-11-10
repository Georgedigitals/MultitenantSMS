import { NextRequest, NextResponse } from 'next/server';
import {
  destroySuperAdminSession,
  SUPER_ADMIN_COOKIE_NAME,
} from '@/lib/auth/super-admin-auth';
import { getPublicUrl } from '@/lib/public-url';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SUPER_ADMIN_COOKIE_NAME)?.value;
  if (token) {
    await destroySuperAdminSession(token);
  }

  // Redirect to admin login page after sign-out (303 so browser converts POST→GET)
  const res = NextResponse.redirect(getPublicUrl('/admin/login', req), { status: 303 });
  res.cookies.set(SUPER_ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  return res;
}
