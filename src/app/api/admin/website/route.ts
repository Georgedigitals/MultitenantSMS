import { NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';
import {
  getDefaultPageBlocks,
  getDefaultPublicSiteCms,
  getPublicSiteCmsConfig,
  isValidCmsPageKey,
  sanitizePageSlug,
  type CmsBlock,
  type CmsCustomPage,
  type CmsMediaAsset,
  type CmsPageKey,
  type PublicSiteCmsConfig,
} from '@/lib/public-site-cms';
import { getPlatformBranding } from '@/lib/platform-settings';

function sanitizeBlocks(raw: unknown): CmsBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((b: any, idx: number) => ({
    id: String(b?.id || `block-${idx}`),
    type: b?.type || 'custom_text',
    visible: Boolean(b?.visible),
    data: b?.data && typeof b.data === 'object' ? b.data : {},
    style: b?.style && typeof b.style === 'object' ? b.style : undefined,
    advanced: b?.advanced && typeof b.advanced === 'object' ? b.advanced : undefined,
  }));
}

export async function GET() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }

  const [config, plans] = await Promise.all([
    getPublicSiteCmsConfig(),
    prisma.plan
      .findMany({
        include: { features: { include: { feature: true } } },
        orderBy: { price: 'asc' },
      })
      .catch(() => []),
  ]);

  const formattedPlans = plans.map((plan: any) => ({
    id: plan.id,
    name: plan.name,
    studentCeiling: plan.studentCeiling,
    price: Number(plan.price),
    pinRequired: plan.pinRequired,
    platformFeePercent: Number(plan.platformFeePercent),
    features: (plan.features || []).map((feature: any) => ({
      featureKey: feature.featureKey,
      enabledByDefault: feature.enabledByDefault,
      feature: feature.feature || {
        name: feature.featureKey.replace(/_/g, ' '),
        description: null,
      },
    })),
  }));

  return NextResponse.json({
    success: true,
    config,
    plans: formattedPlans,
  });
}

const REVISIONS_KEY = 'publicSiteCmsRevisionsJson';

interface CmsRevisionEntry {
  id: string;
  createdAt: string;
  author: string;
  summary: string;
  config: PublicSiteCmsConfig;
}

async function readRevisions(): Promise<CmsRevisionEntry[]> {
  const row = await prisma.platformSetting.findUnique({ where: { key: REVISIONS_KEY } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (body?.action === 'list_revisions') {
      const revisions = await readRevisions();
      return NextResponse.json({
        success: true,
        revisions: revisions.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          author: r.author,
          summary: r.summary,
        })),
      });
    }

    if (body?.action === 'restore_revision') {
      const revisionId = String(body?.revisionId || '');
      const revisions = await readRevisions();
      const target = revisions.find((r) => r.id === revisionId);
      if (!target) {
        return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
      }
      await prisma.platformSetting.upsert({
        where: { key: 'publicSiteCmsJson' },
        create: { key: 'publicSiteCmsJson', value: JSON.stringify(target.config) },
        update: { value: JSON.stringify(target.config) },
      });
      return NextResponse.json({
        success: true,
        config: target.config,
        message: 'Restored website from saved revision.',
      });
    }

    if (body?.action === 'reset') {
      const branding = await getPlatformBranding();
      const current = await getPublicSiteCmsConfig();
      const pageKey = typeof body.pageKey === 'string' && isValidCmsPageKey(body.pageKey) ? body.pageKey : null;

      const resetConfig: PublicSiteCmsConfig = pageKey
        ? {
            ...current,
            pages: {
              ...current.pages,
              [pageKey]: getDefaultPageBlocks(pageKey, branding.name),
            },
          }
        : getDefaultPublicSiteCms(branding.name, branding.tagline);

      resetConfig.blocks = resetConfig.pages.home;

      await prisma.platformSetting.upsert({
        where: { key: 'publicSiteCmsJson' },
        create: { key: 'publicSiteCmsJson', value: JSON.stringify(resetConfig) },
        update: { value: JSON.stringify(resetConfig) },
      });

      return NextResponse.json({
        success: true,
        config: resetConfig,
        message: pageKey
          ? `Reset ${pageKey} page to default layout.`
          : 'Public website CMS reset to default layout.',
      });
    }

    const incoming = body?.config as PublicSiteCmsConfig | undefined;
    if (!incoming || !incoming.brand) {
      return NextResponse.json({ error: 'Invalid CMS configuration payload' }, { status: 400 });
    }

    const cleanName = String(incoming.brand.name || '').trim();
    if (!cleanName || cleanName.length > 80) {
      return NextResponse.json(
        { error: 'Platform name must be between 1 and 80 characters' },
        { status: 400 }
      );
    }

    const cleanTagline = String(incoming.brand.tagline || '').trim().slice(0, 160);
    const current = await getPublicSiteCmsConfig();
    const incomingPages = incoming.pages || ({} as Partial<Record<CmsPageKey, CmsBlock[]>>);

    const pages: PublicSiteCmsConfig['pages'] = {
      home: incomingPages.home ? sanitizeBlocks(incomingPages.home) : current.pages.home,
      services: incomingPages.services ? sanitizeBlocks(incomingPages.services) : current.pages.services,
      pricing: incomingPages.pricing ? sanitizeBlocks(incomingPages.pricing) : current.pages.pricing,
      about: incomingPages.about ? sanitizeBlocks(incomingPages.about) : current.pages.about,
    };

    const cleanNavLinks = Array.isArray(incoming.brand.navLinks)
      ? incoming.brand.navLinks
          .slice(0, 12)
          .map((l: any) => ({
            label: String(l?.label || '').trim().slice(0, 40),
            href: String(l?.href || '/').trim().slice(0, 200) || '/',
          }))
          .filter((l) => l.label)
      : undefined;

    const cleanFooterColumns = Array.isArray(incoming.brand.footerColumns)
      ? incoming.brand.footerColumns.slice(0, 4).map((col: any) => ({
          heading: String(col?.heading || 'Links').trim().slice(0, 40),
          links: Array.isArray(col?.links)
            ? col.links
                .slice(0, 10)
                .map((l: any) => ({
                  label: String(l?.label || '').trim().slice(0, 50),
                  href: String(l?.href || '/').trim().slice(0, 200) || '/',
                }))
                .filter((l: any) => l.label)
            : [],
        }))
      : undefined;

    const cleanCustomPages: CmsCustomPage[] = Array.isArray(incoming.customPages)
      ? incoming.customPages
          .slice(0, 30)
          .map((cp: any) => {
            const slug = sanitizePageSlug(String(cp?.slug || cp?.title || ''));
            return {
              slug,
              title: String(cp?.title || slug || 'Untitled Page').trim().slice(0, 80),
              description: String(cp?.description || '').trim().slice(0, 200),
              published: Boolean(cp?.published),
              blocks: sanitizeBlocks(cp?.blocks),
              updatedAt: new Date().toISOString(),
            };
          })
          .filter((cp) => cp.slug && !isValidCmsPageKey(cp.slug))
      : current.customPages || [];

    const cleanMediaLibrary: CmsMediaAsset[] = Array.isArray(incoming.mediaLibrary)
      ? incoming.mediaLibrary
          .slice(0, 100)
          .map((m: any, idx: number) => ({
            id: String(m?.id || `media-${idx}`),
            url: String(m?.url || '').trim().slice(0, 500),
            name: String(m?.name || 'Uploaded image').trim().slice(0, 100),
            createdAt: String(m?.createdAt || new Date().toISOString()),
          }))
          .filter((m) => m.url)
      : current.mediaLibrary || [];

    const cleanPageSeo: Record<string, { title?: string; description?: string; ogImage?: string }> = {};
    if (incoming.pageSeo && typeof incoming.pageSeo === 'object') {
      for (const [k, v] of Object.entries(incoming.pageSeo).slice(0, 40)) {
        if (v && typeof v === 'object') {
          cleanPageSeo[k] = {
            title: String((v as any).title || '').trim().slice(0, 120) || undefined,
            description: String((v as any).description || '').trim().slice(0, 260) || undefined,
            ogImage: String((v as any).ogImage || '').trim().slice(0, 500) || undefined,
          };
        }
      }
    }

    const allowedAdminPresets = new Set(['ledger', 'brand', 'emerald', 'custom']);
    const allowedFontPresets = new Set(['editorial', 'modern', 'classic']);
    const allowedButtonRadii = new Set(['sharp', 'soft', 'pill']);

    const sanitizedConfig: PublicSiteCmsConfig = {
      brand: {
        name: cleanName,
        tagline: cleanTagline,
        logoUrl: String(incoming.brand.logoUrl || '').trim().slice(0, 500),
        faviconUrl: String(incoming.brand.faviconUrl || '').trim().slice(0, 500),
        primaryColor: /^#[0-9a-fA-F]{6}$/.test(String(incoming.brand.primaryColor || ''))
          ? incoming.brand.primaryColor
          : '#111315',
        accentColor: /^#[0-9a-fA-F]{6}$/.test(String(incoming.brand.accentColor || ''))
          ? incoming.brand.accentColor
          : '#17834b',
        adminThemePreset: allowedAdminPresets.has(String(incoming.brand.adminThemePreset || ''))
          ? (incoming.brand.adminThemePreset as any)
          : current.brand.adminThemePreset || 'ledger',
        adminAccentColor: /^#[0-9a-fA-F]{6}$/.test(String(incoming.brand.adminAccentColor || ''))
          ? incoming.brand.adminAccentColor
          : current.brand.adminAccentColor || '#2563eb',
        fontPreset: allowedFontPresets.has(String(incoming.brand.fontPreset || ''))
          ? (incoming.brand.fontPreset as any)
          : current.brand.fontPreset || 'editorial',
        buttonRadius: allowedButtonRadii.has(String(incoming.brand.buttonRadius || ''))
          ? (incoming.brand.buttonRadius as any)
          : current.brand.buttonRadius || 'sharp',
        footerNote: String(incoming.brand.footerNote || '').trim().slice(0, 240),
        headerCtaLabel: String(incoming.brand.headerCtaLabel ?? 'Set up your school').trim().slice(0, 40),
        headerCtaHref: String(incoming.brand.headerCtaHref || '/register').trim().slice(0, 200),
        showSignInLink: incoming.brand.showSignInLink !== false,
        navLinks: cleanNavLinks,
        footerColumns: cleanFooterColumns,
        footerCopyright: String(incoming.brand.footerCopyright || '').trim().slice(0, 160),
      },
      pages,
      customPages: cleanCustomPages,
      mediaLibrary: cleanMediaLibrary,
      pageSeo: Object.keys(cleanPageSeo).length > 0 ? cleanPageSeo : current.pageSeo || {},
      blocks: pages.home,
    };

    const existingRevisions = await readRevisions();
    const newRevision: CmsRevisionEntry = {
      id: `rev-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      author: auth.superAdmin.name || 'Super Admin',
      summary: String(body?.revisionSummary || 'Published website update').slice(0, 100),
      config: current,
    };
    const nextRevisions = [newRevision, ...existingRevisions].slice(0, 10);

    await prisma.$transaction(async (tx) => {
      await tx.platformSetting.upsert({
        where: { key: 'platformName' },
        create: { key: 'platformName', value: cleanName },
        update: { value: cleanName },
      });
      await tx.platformSetting.upsert({
        where: { key: 'platformTagline' },
        create: { key: 'platformTagline', value: cleanTagline },
        update: { value: cleanTagline },
      });
      await tx.platformSetting.upsert({
        where: { key: 'publicSiteCmsJson' },
        create: { key: 'publicSiteCmsJson', value: JSON.stringify(sanitizedConfig) },
        update: { value: JSON.stringify(sanitizedConfig) },
      });
      await tx.platformSetting.upsert({
        where: { key: REVISIONS_KEY },
        create: { key: REVISIONS_KEY, value: JSON.stringify(nextRevisions) },
        update: { value: JSON.stringify(nextRevisions) },
      });
    });

    return NextResponse.json({
      success: true,
      config: sanitizedConfig,
      message: 'Public website published successfully.',
    });
  } catch (err: any) {
    console.error('Error saving public website CMS:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to publish website changes' },
      { status: 500 }
    );
  }
}
