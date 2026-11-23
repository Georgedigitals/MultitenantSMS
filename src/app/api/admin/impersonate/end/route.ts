import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { endImpersonation } from '@/lib/super-admin';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { IMPERSONATE_COOKIE_NAME } from '@/lib/auth/constants';
import { TENANT_COOKIE_NAME, destroyTenantSession } from '@/lib/auth/tenant-auth';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(IMPERSONATE_COOKIE_NAME)?.value;
    const tenantToken = cookieStore.get(TENANT_COOKIE_NAME)?.value;

    let logIdToEnd: string | null = null;

    if (rawCookie) {
      try {
        const decoded = rawCookie.startsWith('%7B') ? decodeURIComponent(rawCookie) : rawCookie;
        const parsed = JSON.parse(decoded);
        if (typeof parsed?.logId === 'string' && parsed.logId.trim()) {
          logIdToEnd = parsed.logId.trim();
        }
      } catch (err) {
        console.error('Error parsing impersonation cookie', err);
      }
    }

    // Fallback: accept logId from request body if verified by either the cookie or an active Super Admin session
    if (!logIdToEnd) {
      try {
        const body = await req.json().catch(() => null);
        if (body && typeof body.logId === 'string' && body.logId.trim()) {
          const auth = await getSuperAdminFromCookies();
          if (auth) {
            logIdToEnd = body.logId.trim();
          }
        }
      } catch {
        // Empty or non-JSON body is fine
      }
    }

    if (logIdToEnd) {
      await endImpersonation(logIdToEnd);
    }

    // Revoke the impersonated tenant session server-side so the token cannot be reused
    if (tenantToken && rawCookie) {
      try {
        await destroyTenantSession(tenantToken);
      } catch {
        // Non-fatal if session already expired
      }
    }

    // Build the absolute root domain URL so the browser jumps off the tenant subdomain
    const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').toLowerCase();
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const isLocal = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');
    const protocol = forwardedProto || (process.env.NODE_ENV === 'production' && !isLocal ? 'https' : 'http');
    const rootAdminUrl = `${protocol}://${rootDomain}/admin/tenants`;

    const res = NextResponse.json({
      success: true,
      endedLogId: logIdToEnd,
      redirectUrl: rootAdminUrl,
    });

    res.cookies.delete(IMPERSONATE_COOKIE_NAME);
    if (rawCookie) {
      res.cookies.delete(TENANT_COOKIE_NAME);
    }

    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to end impersonation' },
      { status: 400 }
    );
  }
}
