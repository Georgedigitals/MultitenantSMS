import { NextRequest, NextResponse } from 'next/server';
import { destroyTenantSession, TENANT_COOKIE_NAME } from '@/lib/auth/tenant-auth';
import { getPublicUrl } from '@/lib/public-url';

export async function POST(req: NextRequest) {
  let redirectTo = '/login';

  try {
    // Primary: read the explicit `slug` hidden field sent from the logout form.
    // This avoids all Referer-header guessing, which was the root cause of /portal/login.
    const contentType = req.headers.get('content-type') || '';
    let slug: string | null = null;

    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await req.formData();
      slug = formData.get('slug') as string | null;
    } else if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      slug = body?.slug ?? null;
    }

    if (slug && slug.trim()) {
      // Reliable: go straight to the tenant login page.
      redirectTo = `/${slug.trim()}/login`;
    } else {
      // Fallback: derive from Referer (kept for API clients that don't pass slug).
      const referer = req.headers.get('referer') || '';
      if (referer) {
        const url = new URL(referer);
        const segments = url.pathname.split('/').filter(Boolean);

        // These top-level paths are never tenant slugs.
        const RESERVED = [
          'admin', 'api', 'register', 'pricing', 'about', 'services',
          'schools', 'cbt', 'results', 'login', 'portal', 'dashboard',
        ];

        if (segments.length > 0 && !RESERVED.includes(segments[0])) {
          // Path-based routing: segments[0] is the tenant slug.
          redirectTo = `/${segments[0]}/login`;
        } else if (segments.length > 1 && !RESERVED.includes(segments[1])) {
          redirectTo = `/${segments[1]}/login`;
        }
        // else: unknown path – fall back to root /login
      }
    }
  } catch {
    redirectTo = '/login';
  }

  // Destroy session in DB
  const token = req.cookies.get(TENANT_COOKIE_NAME)?.value;
  if (token) {
    await destroyTenantSession(token);
  }

  // Redirect and clear cookie
  const res = NextResponse.redirect(getPublicUrl(redirectTo, req), { status: 303 });
  res.cookies.set(TENANT_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  return res;
}
