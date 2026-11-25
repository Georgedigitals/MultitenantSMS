import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { getTemplateThemeTokens } from '@/lib/template-theme';
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

  const { tenant, branding, templateId, about, hero, contact, stats } = siteData;
  const primary = branding.primaryColor || '#1D3251';
  const accent = branding.accentColor || '#C8A45D';
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
            <span>About</span>
          </div>
          <h1 className={`${theme.headingClass} text-[38px] sm:text-[54px] leading-[1.04] text-white`}>
            About {tenant.name}
          </h1>
          <p className="text-[16px] sm:text-[18px] leading-[1.6] text-white/80 max-w-2xl">
            {hero.motto || 'Cultivating academic discipline, integrity, and lifelong curiosity.'}
          </p>
        </div>
      </section>

      {/* Chapter 2: Mission & Vision */}
      <section className="w-full py-16 sm:py-22">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`${theme.cardRadius} bg-white border ${theme.borderClass} p-7 sm:p-9 space-y-3`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.eyebrowColor }}>
              Purpose
            </p>
            <h2 className={`${theme.headingClass} text-[28px] sm:text-[34px] leading-[1.08] text-[#171614]`}>
              Our mission
            </h2>
            <p className="text-[15px] leading-[1.7] text-[#4c4a43]">{about.mission}</p>
          </div>
          <div className={`${theme.cardRadius} bg-white border ${theme.borderClass} p-7 sm:p-9 space-y-3`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.eyebrowColor }}>
              Direction
            </p>
            <h2 className={`${theme.headingClass} text-[28px] sm:text-[34px] leading-[1.08] text-[#171614]`}>
              Our vision
            </h2>
            <p className="text-[15px] leading-[1.7] text-[#4c4a43]">{about.vision}</p>
          </div>
        </div>
      </section>

      {/* Chapter 3: Core Values */}
      <section className={`w-full bg-white py-16 sm:py-22 border-y ${theme.borderClass}`}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className={`pb-8 border-b ${theme.borderClass} flex flex-wrap items-end justify-between gap-4`}>
            <h2 className={`${theme.headingClass} text-[30px] sm:text-[40px] leading-[1.05] text-[#171614]`}>
              Core values
            </h2>
            <span className="text-[12px] font-medium text-[#6d685c]">Founded {stats.foundedYear}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-8">
            {about.coreValues.map((val, idx) => (
              <div
                key={idx}
                className={`${theme.cardRadius} p-5 border ${theme.borderClass}`}
                style={{ backgroundColor: theme.softBandBg }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.eyebrowColor }}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-[17px] font-semibold text-[#171614]">{val}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 4: Head of School Statement (Organic Blob Portrait on Vanguard, Editorial Frame on Heritage/Horizon) */}
      <section className="w-full py-16 sm:py-24" style={{ backgroundColor: theme.softBandBg }}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5 flex justify-center">
            <div
              className={`w-full max-w-[340px] aspect-square overflow-hidden border ${theme.borderClass} bg-white shadow-xs`}
              style={
                templateId === 'vanguard'
                  ? {
                      borderRadius: '44% 56% 52% 48% / 48% 42% 58% 52%',
                      backgroundColor: `color-mix(in srgb, ${primary} 12%, #FFFFFF)`,
                    }
                  : {
                      borderRadius: templateId === 'horizon' ? '24px' : '4px',
                      backgroundColor: `color-mix(in srgb, ${primary} 10%, #FFFFFF)`,
                    }
              }
            >
              {about.headPhotoUrl ? (
                <img
                  src={about.headPhotoUrl}
                  alt={about.headName || 'Head of School'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={tenant.name} className="h-20 w-20 object-contain opacity-90" />
                  ) : (
                    <span className="tenant-editorial-display text-6xl opacity-35" style={{ color: primary }}>
                      {tenant.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: primary }}>
                    {about.headName || 'Head of School'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.eyebrowColor }}>
              From the Head
            </p>
            <h2 className={`${theme.headingClass} text-[30px] sm:text-[40px] leading-[1.08] text-[#171614]`}>
              Welcome from the Principal
            </h2>
            <blockquote className="tenant-editorial-display italic text-[22px] sm:text-[27px] leading-[1.42] text-[#171614]">
              “{about.principalMessage}”
            </blockquote>
            <p className="text-[13px] font-semibold text-[#171614]">
              {about.headName || `Head of School, ${tenant.name}`}
            </p>
            {about.text && <p className="text-[15px] leading-[1.75] text-[#45423b]">{about.text}</p>}
          </div>
        </div>
      </section>

      {/* Optional Chapter 5: School Anthem */}
      {about.anthem && (
        <section className={`w-full bg-white py-16 sm:py-22 border-t ${theme.borderClass}`}>
          <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5">
              <h2 className={`${theme.headingClass} text-[30px] sm:text-[38px] leading-[1.06] text-[#171614]`}>
                School anthem
              </h2>
            </div>
            <div className="lg:col-span-7">
              <p className="whitespace-pre-line text-[15.5px] leading-[1.85] text-[#3a3833]">{about.anthem}</p>
            </div>
          </div>
        </section>
      )}

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
