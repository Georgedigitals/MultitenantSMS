import type { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';
import { getPublicSiteCmsConfig } from '@/lib/public-site-cms';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/services`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/schools`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
  ];

  try {
    const [cms, tenants] = await Promise.all([
      getPublicSiteCmsConfig(),
      prisma.tenant.findMany({
        where: { status: { in: ['active', 'trial'] } },
        select: { slug: true, updatedAt: true },
        take: 500,
      }),
    ]);

    for (const cp of cms.customPages || []) {
      if (cp.published && cp.slug) {
        entries.push({
          url: `${baseUrl}/p/${cp.slug}`,
          lastModified: cp.updatedAt ? new Date(cp.updatedAt) : now,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }

    for (const t of tenants) {
      if (t.slug) {
        entries.push({
          url: `${baseUrl}/${t.slug}`,
          lastModified: t.updatedAt || now,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // Return static entries if DB is unavailable during build/crawl
  }

  return entries;
}
