/**
 * Helper to generate full tenant subdomain URLs.
 * e.g., getTenantUrl('basic-school', '/login') => 'http://basic-school.localhost:3000/login'
 */
export function getTenantUrl(slug: string, path: string = ''): string {
  let cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Defensively strip redundant /${slug} or /${slug}/ from the beginning of path
  if (cleanPath === `/${slug}`) {
    cleanPath = '/';
  } else if (cleanPath.startsWith(`/${slug}/`)) {
    cleanPath = cleanPath.slice(slug.length + 1) || '/';
  }

  const pathSuffix = cleanPath === '/' ? '' : cleanPath;

  if (typeof window !== 'undefined') {
    const host = window.location.host; // e.g. "localhost:3000" or "school.localhost:3000"
    const parts = host.split(':');
    const portStr = parts[1] ? `:${parts[1]}` : '';
    const rawDomain = parts[0].toLowerCase(); // e.g. "localhost" or "apex.localhost" or "mydomain.com"

    let rootHost = 'localhost';
    if (rawDomain.endsWith('.localhost') || rawDomain === 'localhost' || rawDomain === '127.0.0.1') {
      rootHost = 'localhost';
    } else {
      const partsArr = rawDomain.split('.');
      rootHost = partsArr.length > 2 ? partsArr.slice(-2).join('.') : rawDomain;
    }

    const configuredRoot = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || '').split(':')[0].toLowerCase();
    const isPlatformHost = configuredRoot &&
      (rawDomain === configuredRoot || rawDomain.endsWith(`.${configuredRoot}`));
    if (!isPlatformHost && rawDomain !== 'localhost' && rawDomain !== '127.0.0.1' && !rawDomain.endsWith('.localhost')) {
      return `${window.location.origin}${pathSuffix}`;
    }

    return `${window.location.protocol}//${slug}.${rootHost}${portStr}${pathSuffix}`;
  }

  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').toLowerCase();
  const [domainOnly, portOnly] = rootDomain.split(':');
  const portStr = portOnly ? `:${portOnly}` : (domainOnly === 'localhost' || domainOnly === '127.0.0.1' ? ':3000' : '');
  const protocol = process.env.NODE_ENV === 'production' && !domainOnly.includes('localhost') ? 'https' : 'http';

  return `${protocol}://${slug}.${domainOnly}${portStr}${pathSuffix}`;
}

