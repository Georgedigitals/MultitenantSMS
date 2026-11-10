import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { tenantHasFeature } from '@/lib/features';
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
  } catch (err) {
    notFound();
  }

  const { tenant, branding, gallery } = siteData;
  if (!(await tenantHasFeature(tenant.id, 'gallery'))) notFound();
  const primaryColor = branding.primaryColor || '#1E3A8A';

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-slate-50">
      <TenantPublicHeader slug={tenant.slug} tenantName={tenant.name} branding={branding} />

      {/* Header Banner */}
      <section
        className="py-16 lg:py-20 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, #0F172A 100%)`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-300 mb-3">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span className="text-white font-bold">Campus Gallery</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            Campus Life & Events Gallery
          </h1>
          <p className="text-base text-slate-200 max-w-xl mx-auto font-light leading-relaxed">
            A window into the vibrant day-to-day experience of students, faculty, and campus traditions at {tenant.name}.
          </p>
        </div>
      </section>

      {/* Main Gallery Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <GalleryClient images={gallery} primaryColor={primaryColor} />
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
