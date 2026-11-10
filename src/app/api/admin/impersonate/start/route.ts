import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { startImpersonation } from '@/lib/super-admin';
import { createTenantSession, TENANT_COOKIE_NAME } from '@/lib/auth/tenant-auth';
import { createSessionHandoffTicket } from '@/lib/auth/session-handoff';
import { getTenantUrl } from '@/lib/tenant-url';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { IMPERSONATE_COOKIE_NAME } from '@/lib/auth/constants';

export async function POST(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tenantId, reason } = body;

    if (!tenantId || !reason) {
      return NextResponse.json(
        { error: 'tenantId and a non-empty reason are required' },
        { status: 400 }
      );
    }

    const result = await startImpersonation({
      superAdminId: auth.superAdmin.id,
      tenantId,
      reason,
    });

    // Find active school_admin (or fallback active user) in target tenant
    let tenantUser = await prisma.tenantUser.findFirst({
      where: { tenantId, isActive: true, role: 'school_admin' },
    });
    if (!tenantUser) {
      tenantUser = await prisma.tenantUser.findFirst({
        where: { tenantId, isActive: true },
      });
    }

    // If no user exists for this tenant at all, create a default school admin user
    if (!tenantUser) {
      const staff = await prisma.staff.create({
        data: {
          tenantId,
          name: `Admin (${result.tenantName})`,
          roleBase: 'admin',
        },
      });
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const defaultPassword = await bcrypt.hash(randomPassword, 10);
      tenantUser = await prisma.tenantUser.create({
        data: {
          tenantId,
          username: `admin@${result.tenantSlug}.internal`,
          passwordHash: defaultPassword,
          role: 'school_admin',
          staffId: staff.id,
          isActive: true,
        },
      });
    }

    const cookieStore = await cookies();

    // Create a real tenant session so all downstream permission gates pass automatically
    const { token } = await createTenantSession(tenantId, tenantUser.id);
    cookieStore.set(TENANT_COOKIE_NAME, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });

    const cookiePayload = JSON.stringify({
      logId: result.logId,
      superAdminId: auth.superAdmin.id,
      superAdminName: auth.superAdmin.name,
      tenantId: result.tenantId,
      tenantName: result.tenantName,
      tenantSlug: result.tenantSlug,
      reason: reason.trim(),
      startedAt: new Date().toISOString(),
    });

    cookieStore.set(IMPERSONATE_COOKIE_NAME, cookiePayload, {
      path: '/',
      httpOnly: false, // Accessible by client layout component for persistent banner
      sameSite: 'lax',
    });

    // Create session handoff ticket to install session cookies directly on target tenant subdomain
    const handoffTicket = createSessionHandoffTicket({
      token,
      tenantSlug: result.tenantSlug,
      impersonatePayload: cookiePayload,
      nextPath: '/dashboard',
    });

    const targetUrl = getTenantUrl(
      result.tenantSlug,
      `/api/tenant/auth/handoff?ticket=${handoffTicket}&next=/dashboard`
    );

    return NextResponse.json({
      success: true,
      logId: result.logId,
      tenantSlug: result.tenantSlug,
      targetUrl,
      redirectUrl: targetUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to start impersonation' },
      { status: 400 }
    );
  }
}
