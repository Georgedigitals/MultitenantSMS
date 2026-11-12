import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { endImpersonation } from '@/lib/super-admin';
import { IMPERSONATE_COOKIE_NAME } from '@/lib/auth/constants';
import { TENANT_COOKIE_NAME } from '@/lib/auth/tenant-auth';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(IMPERSONATE_COOKIE_NAME)?.value;

    if (cookie) {
      try {
        const parsed = JSON.parse(cookie);
        if (parsed?.logId) {
          await endImpersonation(parsed.logId);
        }
      } catch (err) {
        console.error('Error parsing impersonation cookie', err);
      }
    }

    cookieStore.delete(IMPERSONATE_COOKIE_NAME);
    cookieStore.delete(TENANT_COOKIE_NAME);

    // Build the absolute root domain URL so the browser jumps off the tenant subdomain
    const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').toLowerCase();
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const isLocal = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');
    const protocol = forwardedProto || (process.env.NODE_ENV === 'production' && !isLocal ? 'https' : 'http');
    const rootAdminUrl = `${protocol}://${rootDomain}/admin/tenants`;

    return NextResponse.json({
      success: true,
      redirectUrl: rootAdminUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to end impersonation' },
      { status: 400 }
    );
  }
}
