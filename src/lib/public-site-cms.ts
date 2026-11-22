import prisma from '@/lib/prisma';
import { getPlatformBranding } from '@/lib/platform-settings';
import {
  getDefaultPublicSiteCms,
  type CmsCustomPage,
  type CmsMediaAsset,
  type CmsPageKey,
  type PublicSiteCmsConfig,
} from '@/lib/public-site-cms-schema';

export * from '@/lib/public-site-cms-schema';

export async function getPublicSiteCmsConfig(): Promise<PublicSiteCmsConfig> {
  const branding = await getPlatformBranding();
  const fallback = getDefaultPublicSiteCms(branding.name, branding.tagline);

  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: 'publicSiteCmsJson' },
    });
    if (!setting?.value) {
      return fallback;
    }

    const parsed = JSON.parse(setting.value) as Partial<PublicSiteCmsConfig>;
    const legacyHome = Array.isArray(parsed.blocks) && parsed.blocks.length > 0 ? parsed.blocks : null;
    const savedPages = (parsed.pages || {}) as Partial<Record<CmsPageKey, any[]>>;

    const pages: PublicSiteCmsConfig['pages'] = {
      home:
        Array.isArray(savedPages.home) && savedPages.home.length > 0
          ? savedPages.home
          : legacyHome || fallback.pages.home,
      services:
        Array.isArray(savedPages.services) && savedPages.services.length > 0
          ? savedPages.services
          : fallback.pages.services,
      pricing:
        Array.isArray(savedPages.pricing) && savedPages.pricing.length > 0
          ? savedPages.pricing
          : fallback.pages.pricing,
      about:
        Array.isArray(savedPages.about) && savedPages.about.length > 0
          ? savedPages.about
          : fallback.pages.about,
    };

    const customPages: CmsCustomPage[] = Array.isArray(parsed.customPages)
      ? parsed.customPages.filter((cp) => cp && typeof cp.slug === 'string' && cp.slug.trim())
      : [];

    const mediaLibrary: CmsMediaAsset[] = Array.isArray(parsed.mediaLibrary)
      ? parsed.mediaLibrary.filter((m) => m && typeof m.url === 'string' && m.url.trim())
      : [];

    return {
      brand: {
        ...fallback.brand,
        ...(parsed.brand || {}),
        name: branding.name || parsed.brand?.name || fallback.brand.name,
        tagline: branding.tagline || parsed.brand?.tagline || fallback.brand.tagline,
      },
      pages,
      customPages,
      mediaLibrary,
      pageSeo: parsed.pageSeo && typeof parsed.pageSeo === 'object' ? parsed.pageSeo : {},
      blocks: pages.home,
    };
  } catch {
    return fallback;
  }
}

export function buildCmsPageMetadata(
  cmsConfig: PublicSiteCmsConfig,
  pageKey: string,
  defaultTitle?: string
) {
  const seo = (cmsConfig.pageSeo || {})[pageKey];
  const title =
    seo?.title ||
    (defaultTitle ? `${defaultTitle} — ${cmsConfig.brand.name}` : cmsConfig.brand.name);
  const description = seo?.description || cmsConfig.brand.tagline;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(seo?.ogImage ? { images: [{ url: seo.ogImage }] } : {}),
    },
  };
}
