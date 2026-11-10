import React from 'react';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { HeritageTemplate } from '@/components/templates/heritage-template';
import { VanguardTemplate } from '@/components/templates/vanguard-template';
import { HorizonTemplate } from '@/components/templates/horizon-template';

export const dynamic = 'force-dynamic';

interface PublicSitePageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicTenantSitePage({ params }: PublicSitePageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch (err: any) {
    if (err?.message === 'Tenant not found') {
      notFound();
    }
    console.error(`[PublicTenantSitePage] Error loading site data for tenant "${slug}":`, err?.message || err);
    throw err;
  }

  const { tenant, branding, templateId } = siteData;

  return (
    <div
      className="min-h-screen flex flex-col font-sans text-slate-900 bg-white"
      style={{
        ['--brand-primary' as any]: branding.primaryColor,
        ['--brand-accent' as any]: branding.accentColor,
      }}
    >
      {/* Top Header Navigation with Multi-Page Links */}
      <TenantPublicHeader
        slug={tenant.slug}
        tenantName={tenant.name}
        branding={branding}
      />

      {/* Main Template Dispatcher */}
      <main className="flex-1">
        {templateId === 'vanguard' ? (
          <VanguardTemplate data={siteData} />
        ) : templateId === 'horizon' ? (
          <HorizonTemplate data={siteData} />
        ) : (
          <HeritageTemplate data={siteData} />
        )}
      </main>

      {/* Global Tenant Footer */}
      <TenantPublicFooter data={siteData} />
    </div>
  );
}
