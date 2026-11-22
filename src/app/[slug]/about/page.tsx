import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantAboutPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  const { tenant, branding, about, hero } = siteData;
  const primary = branding.primaryColor || '#141414';
  const textOnPrimary = branding.textOnPrimary || '#ffffff';

  return (
    <div className="min-h-screen flex flex-col tenant-editorial text-[#0a0a0a] bg-white">
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
            <span>About</span>
          </div>
          <h1 className="tenant-editorial-display text-[44px] sm:text-[64px] leading-[0.98] tracking-[-0.025em]">
            About {tenant.name}
          </h1>
          <p className="text-[17px] sm:text-[19px] leading-[1.6] opacity-85 max-w-2xl">
            {hero.motto || 'Cultivating academic discipline, integrity, and lifelong curiosity.'}
          </p>
        </div>
      </section>

      {/* Chapter 2: Mission & Vision (Stone Field) */}
      <section className="w-full bg-[#f4f3f1] py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#d8d5ce]">
          <div className="pb-10 md:pb-0 md:pr-12 space-y-4">
            <h2 className="tenant-editorial-display text-[34px] sm:text-[42px] leading-[1.05] text-[#0a0a0a]">
              Our mission
            </h2>
            <p className="text-[16px] leading-[1.7] text-[#3a3833]">
              {about.mission}
            </p>
          </div>
          <div className="pt-10 md:pt-0 md:pl-12 space-y-4">
            <h2 className="tenant-editorial-display text-[34px] sm:text-[42px] leading-[1.05] text-[#0a0a0a]">
              Our vision
            </h2>
            <p className="text-[16px] leading-[1.7] text-[#3a3833]">
              {about.vision}
            </p>
          </div>
        </div>
      </section>

      {/* Chapter 3: Core Values (White Field) */}
      <section className="w-full bg-white py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
          <div className="pb-10 border-b border-[#e4e2dd]">
            <h2 className="tenant-editorial-display text-[36px] sm:text-[48px] leading-[1.02] text-[#0a0a0a]">
              Core values
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#e4e2dd] border-b border-[#e4e2dd]">
            {about.coreValues.map((val, idx) => (
              <div key={idx} className="py-7 sm:px-6 first:sm:pl-0 last:sm:pr-0">
                <h3 className="text-[18px] font-semibold text-[#0a0a0a]">{val}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 4: Principal's Statement (Warm Stone Field) */}
      <section className="w-full bg-[#ece8df] py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-3">
            <h2 className="tenant-editorial-display text-[38px] sm:text-[50px] leading-[1.02] text-[#0a0a0a]">
              Welcome from the Principal
            </h2>
            <p className="text-[14px] text-[#57554f]">
              Office of the Head of School · {tenant.name}
            </p>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <blockquote className="tenant-editorial-display text-[24px] sm:text-[32px] leading-[1.3] text-[#0a0a0a]">
              “{about.principalMessage}”
            </blockquote>
            {about.text && (
              <p className="text-[16px] leading-[1.7] text-[#3a3833]">
                {about.text}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Optional Chapter 5: School Anthem */}
      {about.anthem && (
        <section className="w-full bg-white py-20 sm:py-24">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <h2 className="tenant-editorial-display text-[36px] sm:text-[46px] leading-[1.02] text-[#0a0a0a]">
                School anthem
              </h2>
            </div>
            <div className="lg:col-span-7">
              <p className="whitespace-pre-line text-[16px] leading-[1.85] text-[#262522]">
                {about.anthem}
              </p>
            </div>
          </div>
        </section>
      )}

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
