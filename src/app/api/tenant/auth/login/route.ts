import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { verifyPassword } from '@/lib/auth/passwords';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit';
import { createTenantSession, TENANT_COOKIE_NAME } from '@/lib/auth/tenant-auth';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await req.json();
    const slug = (body.slug || '').trim().toLowerCase();
    const username = (body.username || '').trim().toLowerCase();
    const password = body.password || '';

    if (!slug || !username || !password) {
      return NextResponse.json(
        { error: 'School slug, username, and password are required' },
        { status: 400 }
      );
    }

    // 1. Resolve tenant context
    const tenant = await getTenantContext({ slug });

    if (!tenant) {
      return NextResponse.json(
        { error: 'School tenant not found' },
        { status: 404 }
      );
    }

    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      return NextResponse.json(
        { error: 'This school account is currently inactive. Contact school administration.' },
        { status: 403 }
      );
    }

    // 2. Rate limiting (§11.2)
    const rateLimitKey = `tenant_login_${ip}_${tenant.id}_${username}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${rateLimit.resetSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    // 3. Authenticate against tenantUser within this tenant
    const cleanUsername = username.toLowerCase();
    let user = await prisma.tenantUser.findUnique({
      where: { tenantId_username: { tenantId: tenant.id, username: cleanUsername } },
      include: {
        staff: true,
        student: true,
        guardian: true,
      },
    });

    // Fallback: If user entered a phone number with different formatting (e.g. 080 vs +23480 vs 23480)
    if (!user) {
      const digitsOnly = cleanUsername.replace(/\D/g, '');
      if (digitsOnly.length >= 10) {
        const last10 = digitsOnly.slice(-10);
        const phoneVariants = [
          digitsOnly,
          `0${last10}`,
          `234${last10}`,
          `+234${last10}`,
        ];
        user = await prisma.tenantUser.findFirst({
          where: {
            tenantId: tenant.id,
            username: { in: phoneVariants },
          },
          include: {
            staff: true,
            student: true,
            guardian: true,
          },
        });
      }
    }

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid credentials or inactive account' },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);

    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    resetRateLimit(rateLimitKey);

    // 4. Create Tenant Session
    const { token, expiresAt } = await createTenantSession(tenant.id, user.id);

    // Record immutable audit event
    const actorName = user.staff?.name || user.student?.name || user.username;
    await recordAuditLog({
      tenantId: tenant.id,
      actorId: user.id,
      actorName,
      actorRole: user.role,
      action: 'AUTH_LOGIN',
      entityType: 'auth',
      entityId: user.id,
      details: { username: user.username, role: user.role },
      ipAddress: ip,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        tenantId: tenant.id,
        schoolName: tenant.name,
        username: user.username,
        role: user.role,
        staffProfile: user.staff,
        studentProfile: user.student,
      },
    });

    res.cookies.set(TENANT_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    // Clear any leftover impersonation cookie on direct login
    res.cookies.set('bms_impersonate_session', '', {
      httpOnly: false,
      expires: new Date(0),
      path: '/',
    });

    return res;
  } catch (err: any) {
    console.error('Tenant login error:', err);
    return NextResponse.json(
      { error: err?.message || 'An internal server error occurred' },
      { status: 500 }
    );
  }
}
