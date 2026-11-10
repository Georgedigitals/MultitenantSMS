import { NextRequest } from 'next/server';

/**
 * Resolves a public-facing absolute URL for browser redirects.
 * In containerized / reverse-proxy environments (e.g. Docker + Caddy),
 * `req.url` points to the internal container socket (e.g. http://0.0.0.0:3000),
 * which would leak internal ports to the browser if used as the redirect base.
 */
export function getPublicUrl(path: string, req: NextRequest): URL {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = req.headers.get('host');
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';

  let host = forwardedHost || hostHeader || rootDomain;

  // Filter out internal Docker/container IPs and service names
  if (
    host.startsWith('0.0.0.0') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('app:') ||
    host === 'app'
  ) {
    host = rootDomain;
  }

  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isLocal = host.includes('localhost') || host.endsWith('.localhost');
  const proto = forwardedProto || (process.env.NODE_ENV === 'production' && !isLocal ? 'https' : 'http');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${proto}://${host}${cleanPath}`);
}
