import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/services', '/pricing', '/about', '/schools', '/p/'],
        disallow: ['/admin/', '/api/', '/_next/', '/*/dashboard/', '/*/portal/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
