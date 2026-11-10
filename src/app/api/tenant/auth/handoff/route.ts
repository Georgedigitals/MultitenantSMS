import { NextRequest, NextResponse } from 'next/server';
import { redeemSessionHandoffTicket } from '@/lib/auth/session-handoff';
import { TENANT_COOKIE_NAME } from '@/lib/auth/tenant-auth';
import { getTenantUrl } from '@/lib/tenant-url';
import { IMPERSONATE_COOKIE_NAME } from '@/lib/auth/constants';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const ticket = url.searchParams.get('ticket');

  if (!ticket) {
    return NextResponse.redirect(new URL('/login?error=missing_ticket', req.url));
  }

  const handoff = redeemSessionHandoffTicket(ticket);
  if (!handoff) {
    return NextResponse.redirect(new URL('/login?error=invalid_ticket', req.url));
  }

  // Enforce database-backed single-use redemption across server instances
  const singleUse = await checkRateLimit(`handoff_ticket_${ticket.slice(-32)}`, {
    limit: 1,
    windowSeconds: 120,
  });
  if (!singleUse.success) {
    return NextResponse.redirect(new URL('/login?error=invalid_ticket', req.url));
  }

  // Get current subdomain from host or x-tenant-slug header
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000')
    .split(':')[0]
    .toLowerCase();

  let currentSubdomain: string | null = null;
  if (host.endsWith(`.${rootDomain}`)) {
    currentSubdomain = host.replace(`.${rootDomain}`, '');
  } else if (host.endsWith('.localhost')) {
    currentSubdomain = host.replace('.localhost', '');
  }

  // Verify handoff target slug matches current subdomain (preventing cross-tenant ticket stealing)
  if (currentSubdomain && currentSubdomain !== handoff.tenantSlug.toLowerCase()) {
    return NextResponse.redirect(new URL('/login?error=tenant_mismatch', req.url));
  }

  const targetPath = handoff.nextPath?.startsWith('/') ? handoff.nextPath : '/dashboard';
  const fullRedirectUrl = getTenantUrl(handoff.tenantSlug, targetPath);
  const res = NextResponse.redirect(new URL(fullRedirectUrl), 307);

  // Set real tenant session directly on this tenant subdomain origin
  res.cookies.set(TENANT_COOKIE_NAME, handoff.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // If this handoff is from an impersonation flow, set impersonate session cookie
  if (handoff.impersonatePayload) {
    res.cookies.set(
      IMPERSONATE_COOKIE_NAME,
      typeof handoff.impersonatePayload === 'string'
        ? handoff.impersonatePayload
        : JSON.stringify(handoff.impersonatePayload),
      {
        httpOnly: false, // Accessible by client layout component for persistent banner
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      }
    );
  }

  return res;
}
