import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getPublicSiteContent } from '@/lib/site-content';
import { getTemplateThemeTokens } from '@/lib/template-theme';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantAcademicsPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  const { tenant, branding, templateId, academics, contact } = siteData;
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
            <span>Academics</span>
          </div>
          <h1 className={`${theme.headingClass} text-[38px] sm:text-[54px] leading-[1.04] text-white`}>
            Curriculum &amp; academics
          </h1>
          <p className="text-[16px] sm:text-[18px] leading-[1.6] text-white/80 max-w-2xl">
            {academics.text}
          </p>
        </div>
      </section>

      {/* Chapter 2: Curricula Frameworks */}
      <section className="w-full py-16 sm:py-22">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <h2 className={`${theme.headingClass} text-[30px] sm:text-[40px] leading-[1.06] text-[#171614] pb-8`}>
            Curricula frameworks
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {academics.curricula.map((curr, idx) => (
              <div key={idx} className={`${theme.cardRadius} bg-white border ${theme.borderClass} p-7 space-y-3`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.eyebrowColor }}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3 className="text-[18px] font-semibold text-[#171614]">{curr}</h3>
                <p className="text-[14px] leading-[1.65] text-[#57534a]">
                  Structured to meet international academic benchmarks alongside national examination standards.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 3: Educational Tiers */}
      <section className={`w-full bg-white py-16 sm:py-22 border-y ${theme.borderClass}`}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className={`pb-8 border-b ${theme.borderClass}`}>
            <h2 className={`${theme.headingClass} text-[30px] sm:text-[40px] leading-[1.06] text-[#171614]`}>
              Educational tiers &amp; programs
            </h2>
          </div>

          <div className={`divide-y ${theme.borderClass}`}>
            {academics.levels.map((lvl, idx) => (
              <div key={idx} className="py-7 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 items-baseline">
                <div className="md:col-span-1">
                  <span className="tenant-editorial-display text-[20px] font-medium" style={{ color: theme.eyebrowColor }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="md:col-span-3">
                  <h3 className="text-[19px] font-semibold text-[#171614]">{lvl.name}</h3>
                </div>
                <div className="md:col-span-2">
                  <span className="text-[13px] font-medium text-[#6d685c]">{lvl.ages}</span>
                </div>
                <div className="md:col-span-6">
                  <p className="text-[14.5px] leading-[1.65] text-[#45423b]">{lvl.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 4: Continuous Assessment & Digital Exams */}
      <section className="w-full py-16 sm:py-24" style={{ backgroundColor: theme.softBandBg }}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-4">
            <h2 className={`${theme.headingClass} text-[30px] sm:text-[40px] leading-[1.06] text-[#171614]`}>
              Assessment &amp; digital exams
            </h2>
            <p className="text-[14.5px] leading-[1.65] text-[#4c4a43]">
              Academic grading combines continuous assessments (40%) and termly examinations (60%), published directly to parents and students.
            </p>
          </div>
          <div className={`lg:col-span-7 divide-y ${theme.borderClass} border-y ${theme.borderClass}`}>
            <div className="py-6">
              <h3 className="text-[17px] font-semibold text-[#171614]">Computer-based testing (CBT)</h3>
              <p className="mt-1.5 text-[14.5px] leading-[1.6] text-[#4c4a43]">
                Students complete timed digital tests that build confidence with modern national and international CBT examination formats.
              </p>
            </div>
            <div className="py-6">
              <h3 className="text-[17px] font-semibold text-[#171614]">Online report cards &amp; result verification</h3>
              <p className="mt-1.5 text-[14.5px] leading-[1.6] text-[#4c4a43]">
                Verified termly report cards include subject scores, behavioural ratings, attendance summaries, and teacher remarks.
              </p>
            </div>
            <div className="py-6 flex flex-wrap gap-3">
              <Link
                href={`/${slug}/results/check`}
                className={`h-11 px-6 ${theme.buttonRadius} text-[13px] font-semibold inline-flex items-center gap-2 transition-opacity hover:opacity-90`}
                style={{ backgroundColor: primary, color: textOnPrimary }}
              >
                <span>Check terminal results</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                href={`/${slug}/admissions`}
                className={`h-11 px-6 ${theme.buttonRadius} border border-[#171614]/25 text-[13px] font-semibold text-[#171614] inline-flex items-center hover:bg-white/60 transition-colors`}
              >
                Apply for admission
              </Link>
            </div>
          </div>
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
