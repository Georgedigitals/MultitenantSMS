import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/passwords';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit';
import { createSuperAdminSession, SUPER_ADMIN_COOKIE_NAME } from '@/lib/auth/super-admin-auth';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const rateLimitKey = `sa_login_${ip}_${email.toLowerCase()}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${rateLimit.resetSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, superAdmin.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Reset rate limit on success
    resetRateLimit(rateLimitKey);

    const { token, expiresAt } = await createSuperAdminSession(superAdmin.id);

    const res = NextResponse.json({
      success: true,
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
      },
    });

    res.cookies.set(SUPER_ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return res;
  } catch (err: unknown) {
    console.error('Super admin login error:', err);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
}
