import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';
import { findTenantBySlugOrDomain, isReservedSlug, isValidSlugFormat } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOST_LABEL = /^(?=.{1,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function isValidHostname(host: string) {
  if (!host || host.length > 253 || isIP(host) !== 0 || !/^[a-z0-9.-]+$/.test(host)) return false;
  return host.split('.').every((label) => HOST_LABEL.test(label));
}

function allowed() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function denied() {
  return new NextResponse(null, {
    status: 403,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Caddy calls this over the private Docker network before issuing an on-demand
 * certificate. Requests to this path through Caddy are blocked in Caddyfile.
 */
export async function GET(request: NextRequest) {
  const domain = (request.nextUrl.searchParams.get('domain') || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || '')
    .split(':')[0]
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');

  if (!isValidHostname(domain) || !isValidHostname(rootDomain)) return denied();

  if (domain === rootDomain || domain === `www.${rootDomain}` || domain === `admin.${rootDomain}`) {
    return allowed();
  }

  const rootSuffix = `.${rootDomain}`;
  if (domain.endsWith(rootSuffix)) {
    const slug = domain.slice(0, -rootSuffix.length);
    if (slug.includes('.') || !isValidSlugFormat(slug) || isReservedSlug(slug)) return denied();

    try {
      const tenant = await findTenantBySlugOrDomain(slug, { id: true });
      return tenant ? allowed() : denied();
    } catch {
      return new NextResponse(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // Custom domains are eligible only when the existing resolver confirms a
  // DNS-verified alias and the tenant currently has the custom_domain plan feature.
  try {
    const tenant = await findTenantBySlugOrDomain(domain, { id: true });
    return tenant ? allowed() : denied();
  } catch {
    return new NextResponse(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
