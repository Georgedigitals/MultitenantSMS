import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { getTemplateThemeTokens } from '@/lib/template-theme';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { NewsClient } from './news-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantNewsPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  const { tenant, branding, templateId, newsEvents, contact } = siteData;
  const primary = branding.primaryColor || '#1D3251';
  const accent = branding.accentColor || '#C8A45D';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const theme = getTemplateThemeTokens(templateId, primary, accent);

  return (
    <div
      className="min-h-screen flex flex-col text-[#171614]"
      style={{ backgroundColor: theme.canvasBg }}
    >
      <TenantPublicHeader
        slug={tenant.slug}
        tenantName={tenant.name}
        branding={branding}
        templateId={templateId}
        contact={contact}
      />

      {/* Chapter 1: Template-Cohesive Header */}
      <section className="w-full py-14 sm:py-20 text-white" style={{ backgroundColor: theme.deepBandBg }}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 space-y-4">
          <div className="flex items-center gap-2 text-[12px] text-white/70">
            <Link href={`/${tenant.slug}`} className="hover:text-white underline-offset-4 hover:underline">
              Home
            </Link>
            <span>/</span>
            <span>News &amp; Events</span>
          </div>
          <h1 className={`${theme.headingClass} text-[38px] sm:text-[54px] leading-[1.04] text-white`}>
            News &amp; upcoming events
          </h1>
          <p className="text-[16px] sm:text-[18px] leading-[1.6] text-white/80 max-w-2xl">
            Key dates, open days, school announcements, and community highlights at {tenant.name}.
          </p>
        </div>
      </section>

      {/* Chapter 2: Filterable News & Events Grid */}
      <section className="w-full py-14 sm:py-20">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <NewsClient
            items={newsEvents}
            primaryColor={primary}
            accentColor={accent}
            textOnPrimary={textOnPrimary}
            cardRadius={theme.cardRadius}
            borderClass={theme.borderClass}
            softBandBg={theme.softBandBg}
            headingClass={theme.headingClass}
          />
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
