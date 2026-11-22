import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { GalleryClient } from './gallery-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantGalleryPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  const { tenant, branding, gallery } = siteData;
  const primary = branding.primaryColor || '#141414';
  const textOnPrimary = branding.textOnPrimary || '#ffffff';

  return (
    <div className="min-h-screen flex flex-col tenant-editorial text-[#0a0a0a] bg-[#f4f3f1]">
      <TenantPublicHeader slug={tenant.slug} tenantName={tenant.name} branding={branding} />

      {/* Chapter 1: Flat Brand Header */}
      <section
        className="w-full py-16 sm:py-24"
        style={{ backgroundColor: primary, color: textOnPrimary }}
      >
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 space-y-5">
          <div className="flex items-center gap-2 text-[13px] opacity-75">
            <Link href={`/${tenant.slug}`} className="hover:opacity-100 underline-offset-4 hover:underline">
              Home
            </Link>
            <span>/</span>
            <span>Gallery</span>
          </div>
          <h1 className="tenant-editorial-display text-[44px] sm:text-[64px] leading-[0.98] tracking-[-0.025em]">
            Campus life &amp; events
          </h1>
          <p className="text-[17px] sm:text-[19px] leading-[1.6] opacity-85 max-w-2xl">
            Scenes from classrooms, laboratories, assemblies, and school traditions at {tenant.name}.
          </p>
        </div>
      </section>

      {/* Chapter 2: Gallery Grid */}
      <section className="w-full py-16 sm:py-24">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
          <GalleryClient images={gallery} primaryColor={primary} />
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
