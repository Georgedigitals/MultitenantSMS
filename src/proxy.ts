import { NextRequest, NextResponse } from 'next/server';

const RESERVED_SLUGS = [
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'smtp',
  'status',
  'docs',
  'support',
  'staging',
  'cdn',
  'blog',
];

const NON_TENANT_PATHS = [
  ...RESERVED_SLUGS,
  'dashboard',
  'login',
  'forgot-password',
  'reset-password',
  'about',
  'academics',
  'admissions',
  'gallery',
  'contact',
  'pricing',
  'register',
  'checkout',
  'schools',
  'services',
  'results',
  'attendance',
  'staff-attendance',
  'portal',
  'cbt',
  'check',
  'terms',
  'privacy',
  'faq',
  '_next',
  'favicon.ico',
];

const TENANT_PAGE_ROUTES = new Set([
  'about',
  'academics',
  'admissions',
  'attendance',
  'staff-attendance',
  'cbt',
  'contact',
  'dashboard',
  'forgot-password',
  'gallery',
  'login',
  'portal',
  'reset-password',
  'results',
  'check',
]);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

/**
 * Routes within a tenant that require an authenticated session.
 * If the cookie is absent at the edge, redirect immediately to login.
 * Note: /results/check and /cbt/take are public student portals (scratch card PIN / exam entry).
 * Administrative management pages are all hosted under /dashboard (e.g. /dashboard/results).
 */
const TENANT_PROTECTED_PREFIXES = ['/dashboard'];

export default function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || 'localhost:3000';

  // Strip port for domain matching
  const host = hostname.split(':')[0].toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000')
    .split(':')[0]
    .toLowerCase();

  let subdomain: string | null = null;
  let isCustomDomain = false;

  if (host === rootDomain || host === 'localhost' || host === '127.0.0.1') {
    subdomain = null;
  } else if (host.endsWith(`.${rootDomain}`)) {
    subdomain = host.replace(`.${rootDomain}`, '');
  } else if (host.endsWith('.localhost')) {
    subdomain = host.replace('.localhost', '');
  } else {
    // Custom domain scenario (e.g. portal.apexschool.edu)
    isCustomDomain = true;
  }

  const sanitizedHeaders = new Headers(req.headers);
  sanitizedHeaders.delete('x-tenant-slug');
  sanitizedHeaders.delete('x-custom-domain');
  sanitizedHeaders.delete('x-is-super-admin');
  sanitizedHeaders.delete('x-admin-pathname');
  sanitizedHeaders.delete('x-tenant-pathname');

  // ─── 1. Super Admin Subdomain (admin.*) or /admin Path ──────────────────────
  const isAdminPath = url.pathname.startsWith('/admin');
  if (subdomain === 'admin' || isAdminPath) {
    const requestHeaders = new Headers(sanitizedHeaders);
    requestHeaders.set('x-is-super-admin', 'true');
    requestHeaders.set('x-admin-pathname', url.pathname);

    const isPublicAdminPath =
      url.pathname === '/admin/login' ||
      url.pathname === '/login' ||
      url.pathname === '/admin/forgot-password' ||
      url.pathname === '/admin/reset-password' ||
      url.pathname === '/forgot-password' ||
      url.pathname === '/reset-password';
    const sessionCookie = req.cookies.get('bms_sa_session');

    // Guard non-public admin pages if no session cookie present at edge
    if (!isPublicAdminPath && !sessionCookie?.value) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    if (subdomain === 'admin') {
      return NextResponse.rewrite(new URL(`/admin${url.pathname}${url.search}`, req.url), {
        headers: requestHeaders,
      });
    }

    return NextResponse.next({
      headers: requestHeaders,
    });
  }

  // ─── 2. Reserved System Subdomains (e.g. www, cdn, api) ───────────────────
  if (subdomain && RESERVED_SLUGS.includes(subdomain)) {
    if (subdomain === 'www') {
      return NextResponse.redirect(
        new URL(`${url.protocol}//${rootDomain}${url.pathname}${url.search}`)
      );
    }
    return new NextResponse('Not Found', { status: 404 });
  }

  // ─── 3. Custom Domain ──────────────────────────────────────────────────────
  if (isCustomDomain) {
    const requestHeaders = new Headers(sanitizedHeaders);
    requestHeaders.set('x-custom-domain', host);
    requestHeaders.set('x-tenant-pathname', url.pathname);
    if (url.pathname.startsWith('/api')) {
      return NextResponse.next({ headers: requestHeaders });
    }
    // Route the hostname through the existing tenant segment. Server components
    // resolve this value as a verified DomainAlias before loading tenant data.
    // Some existing tenant links include the tenant identifier as the first path
    // segment. Custom domains already identify the tenant, so remove that prefix
    // while preserving paths that are actual application routes.
    const firstSegment = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    const hasTenantPrefix = firstSegment &&
      !NON_TENANT_PATHS.includes(firstSegment) &&
      !TENANT_PAGE_ROUTES.has(firstSegment);
    const tenantPath = hasTenantPrefix
      ? `/${url.pathname.split('/').filter(Boolean).slice(1).join('/')}`
      : url.pathname;
    return NextResponse.rewrite(new URL(`/${host}${tenantPath}${url.search}`, req.url), {
      headers: requestHeaders,
    });
  }

  // ─── 4. Tenant Subdomain (e.g. apex.localhost:3000) ───────────────────────
  if (subdomain) {
    const requestHeaders = new Headers(sanitizedHeaders);
    requestHeaders.set('x-tenant-slug', subdomain);
    requestHeaders.set('x-tenant-pathname', url.pathname);

    // Bypass subdomain rewriting for API routes
    if (url.pathname.startsWith('/api')) {
      return NextResponse.next({
        headers: requestHeaders,
      });
    }

    // If pathname redundantly includes the subdomain (e.g. apex.localhost:3000/apex or /apex/dashboard),
    // redirect 307 to the clean path to keep the browser address bar clean.
    if (url.pathname === `/${subdomain}`) {
      return NextResponse.redirect(new URL(`/${url.search}`, req.url), 307);
    }
    if (url.pathname.startsWith(`/${subdomain}/`)) {
      const cleanPath = url.pathname.slice(subdomain.length + 1) || '/';
      return NextResponse.redirect(new URL(`${cleanPath}${url.search}`, req.url), 307);
    }

    // If pathname starts with another candidate slug (e.g. apex.localhost:3000/beacon/dashboard)
    const firstSegment = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    if (
      firstSegment &&
      firstSegment !== subdomain &&
      !NON_TENANT_PATHS.includes(firstSegment) &&
      !TENANT_PAGE_ROUTES.has(firstSegment)
    ) {
      const restOfPath = url.pathname.split('/').filter(Boolean).slice(1).join('/');
      const targetPath = restOfPath ? `/${restOfPath}` : '/';
      const hostPort = hostname.includes(':') ? `:${hostname.split(':')[1]}` : (url.port ? `:${url.port}` : '');
      const isLocal = host.endsWith('.localhost') || host === 'localhost' || rootDomain === 'localhost';
      const targetDomain = isLocal ? `${firstSegment}.localhost` : `${firstSegment}.${rootDomain}`;
      return NextResponse.redirect(
        new URL(`${url.protocol}//${targetDomain}${hostPort}${targetPath}${url.search}`),
        307
      );
    }

    // Route /pricing on tenant subdomain: to /dashboard/subscription if authenticated or root /pricing if unauthenticated
    if (url.pathname === '/pricing') {
      const sessionCookie = req.cookies.get('bms_tenant_session') || req.cookies.get('bms_sa_session');
      if (sessionCookie?.value) {
        return NextResponse.redirect(new URL('/dashboard/subscription', req.url));
      }
      const hostPort = hostname.includes(':') ? `:${hostname.split(':')[1]}` : '';
      const isLocal = host.endsWith('.localhost') || host === 'localhost' || rootDomain === 'localhost';
      const targetDomain = isLocal ? 'localhost' : rootDomain;
      return NextResponse.redirect(new URL(`${url.protocol}//${targetDomain}${hostPort}/pricing${url.search}`));
    }

    // Route /register on tenant subdomain: redirect to root domain so registration and payment checkout work
    if (url.pathname === '/register' || url.pathname.startsWith('/register/')) {
      const hostPort = hostname.includes(':') ? `:${hostname.split(':')[1]}` : '';
      const isLocal = host.endsWith('.localhost') || host === 'localhost' || rootDomain === 'localhost';
      const targetDomain = isLocal ? 'localhost' : rootDomain;
      return NextResponse.redirect(
        new URL(`${url.protocol}//${targetDomain}${hostPort}${url.pathname}${url.search}`),
        307
      );
    }

    // Route /checkout on tenant subdomain: redirect to root domain so payment checkout works
    if (url.pathname === '/checkout' || url.pathname.startsWith('/checkout/')) {
      const hostPort = hostname.includes(':') ? `:${hostname.split(':')[1]}` : '';
      const isLocal = host.endsWith('.localhost') || host === 'localhost' || rootDomain === 'localhost';
      const targetDomain = isLocal ? 'localhost' : rootDomain;
      return NextResponse.redirect(
        new URL(`${url.protocol}//${targetDomain}${hostPort}${url.pathname}${url.search}`),
        307
      );
    }

    // Edge-level session gate for protected tenant routes.
    const isProtected = TENANT_PROTECTED_PREFIXES.some((prefix) =>
      url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    );
    if (isProtected) {
      const sessionCookie = req.cookies.get('bms_tenant_session');
      const impersonateCookie = req.cookies.get('bms_impersonate_session');

      if (!sessionCookie?.value && !impersonateCookie?.value) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('next', url.pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    const rewritePath = `/${subdomain}${url.pathname === '/' ? '' : url.pathname}`;
    const rewriteUrl = new URL(`${rewritePath}${url.search}`, req.url);
    return NextResponse.rewrite(rewriteUrl, {
      headers: requestHeaders,
    });
  }

  // ─── 5. Root domain tenant path handling -> Redirect to dedicated wildcard subdomain ───
  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0) {
    const candidateSlug = pathSegments[0].toLowerCase();
    if (!NON_TENANT_PATHS.includes(candidateSlug)) {
      const restOfPath = pathSegments.slice(1).join('/');
      const targetPath = restOfPath ? `/${restOfPath}` : '/';
      const hostPort = hostname.includes(':') ? `:${hostname.split(':')[1]}` : (url.port ? `:${url.port}` : '');
      const isLocal = host.endsWith('.localhost') || host === 'localhost' || host === '127.0.0.1' || rootDomain === 'localhost';
      const targetDomain = isLocal ? `${candidateSlug}.localhost` : `${candidateSlug}.${rootDomain}`;
      const redirectUrl = `${url.protocol}//${targetDomain}${hostPort}${targetPath}${url.search}`;
      return NextResponse.redirect(new URL(redirectUrl), 307);
    }
  }

  return NextResponse.next({
    headers: sanitizedHeaders,
  });
}

