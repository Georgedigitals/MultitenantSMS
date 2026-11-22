import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getPublicSiteContent } from '@/lib/site-content';
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

  const { tenant, branding, academics } = siteData;
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
            <span>Academics</span>
          </div>
          <h1 className="tenant-editorial-display text-[44px] sm:text-[64px] leading-[0.98] tracking-[-0.025em]">
            Curriculum &amp; academics
          </h1>
          <p className="text-[17px] sm:text-[19px] leading-[1.6] opacity-85 max-w-2xl">
            {academics.text}
          </p>
        </div>
      </section>

      {/* Chapter 2: Curricula Frameworks (Stone Field) */}
      <section className="w-full bg-[#f4f3f1] py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
          <div className="pb-10 border-b border-[#d8d5ce]">
            <h2 className="tenant-editorial-display text-[36px] sm:text-[50px] leading-[1.02] text-[#0a0a0a]">
              Curricula frameworks
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#d8d5ce] border-b border-[#d8d5ce]">
            {academics.curricula.map((curr, idx) => (
              <div key={idx} className="py-8 md:px-8 first:md:pl-0 last:md:pr-0 space-y-3">
                <h3 className="text-[20px] font-semibold text-[#0a0a0a]">{curr}</h3>
                <p className="text-[15px] leading-[1.65] text-[#4f4d48]">
                  Structured to meet international academic benchmarks alongside national examination standards.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 3: Educational Tiers (White Field) */}
      <section className="w-full bg-white py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
          <div className="pb-12 border-b border-[#e4e2dd]">
            <h2 className="tenant-editorial-display text-[36px] sm:text-[50px] leading-[1.02] text-[#0a0a0a]">
              Educational tiers &amp; programs
            </h2>
          </div>

          <div className="divide-y divide-[#e4e2dd]">
            {academics.levels.map((lvl, idx) => (
              <div
                key={idx}
                className="py-8 sm:py-10 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-baseline"
              >
                <div className="md:col-span-4">
                  <h3 className="text-[20px] font-semibold text-[#0a0a0a]">{lvl.name}</h3>
                </div>
                <div className="md:col-span-2">
                  <span className="text-[14px] text-[#66645e]">{lvl.ages}</span>
                </div>
                <div className="md:col-span-6">
                  <p className="text-[15px] leading-[1.65] text-[#3a3833]">{lvl.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 4: Continuous Assessment & CBT (Warm Stone Field) */}
      <section className="w-full bg-[#ece8df] py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="tenant-editorial-display text-[36px] sm:text-[50px] leading-[1.02] text-[#0a0a0a]">
              Assessment &amp; digital exams
            </h2>
            <p className="text-[15px] leading-[1.65] text-[#45433e]">
              Academic grading combines continuous assessments (40%) and termly examinations (60%), published directly to parents and students.
            </p>
          </div>
          <div className="lg:col-span-7 divide-y divide-[#0a0a0a]/15 border-t border-b border-[#0a0a0a]/15">
            <div className="py-6">
              <h3 className="text-[18px] font-semibold text-[#0a0a0a]">Computer-based testing (CBT)</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-[#3a3833]">
                Students complete timed digital tests that build familiarity with UTME, WAEC, and international CBT formats.
              </p>
            </div>
            <div className="py-6">
              <h3 className="text-[18px] font-semibold text-[#0a0a0a]">Online report cards &amp; result PINs</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-[#3a3833]">
                Verified termly report cards include subject scores, psychomotor ratings, attendance summaries, and teacher remarks.
              </p>
            </div>
            <div className="py-6 flex flex-wrap gap-4">
              <Link
                href={`/${slug}/results/check`}
                className="h-11 px-6 text-[14px] font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary, color: textOnPrimary }}
              >
                <span>Check terminal results</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                href={`/${slug}/admissions`}
                className="h-11 px-6 border border-[#0a0a0a]/25 text-[14px] font-medium text-[#0a0a0a] inline-flex items-center hover:bg-white/50 transition-colors"
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
