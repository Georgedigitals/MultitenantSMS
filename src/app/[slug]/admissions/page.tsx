import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { getTemplateThemeTokens } from '@/lib/template-theme';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { AdmissionFormClient } from './admission-form-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantAdmissionsPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  const { tenant, branding, templateId, admissions, contact } = siteData;
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
            <span>Admissions</span>
          </div>
          <h1 className={`${theme.headingClass} text-[38px] sm:text-[54px] leading-[1.04] text-white`}>
            Admissions &amp; enrollment
          </h1>
          <p className="text-[16px] sm:text-[18px] leading-[1.6] text-white/80 max-w-2xl">
            {admissions.text}
          </p>
        </div>
      </section>

      {/* Chapter 2: Application Roadmap */}
      <section className="w-full py-16 sm:py-20" style={{ backgroundColor: theme.softBandBg }}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <h2 className={`${theme.headingClass} text-[30px] sm:text-[40px] leading-[1.06] text-[#171614] pb-8`}>
            How to apply
          </h2>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {admissions.process.map((p) => (
              <li key={p.step} className={`${theme.cardRadius} bg-white border ${theme.borderClass} p-6 space-y-2.5`}>
                <span className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.eyebrowColor }}>
                  Step {p.step}
                </span>
                <h3 className="text-[18px] font-semibold text-[#171614]">{p.title}</h3>
                <p className="text-[14px] leading-[1.6] text-[#57534a]">{p.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Chapter 3: Requirements & Online Inquiry Form */}
      <section className={`w-full bg-white py-16 sm:py-24 border-t ${theme.borderClass}`}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left: Requirements & Tuition Policy */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <h2 className={`${theme.headingClass} text-[28px] sm:text-[34px] leading-[1.08] text-[#171614]`}>
                Application requirements
              </h2>
              <ul className={`divide-y ${theme.borderClass} border-y ${theme.borderClass}`}>
                {admissions.requirements.map((req, i) => (
                  <li key={i} className="py-3.5 text-[14.5px] leading-[1.55] text-[#2b2924]">
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-[17px] font-semibold text-[#171614]">Tuition &amp; fee policy</h3>
              <p className="text-[14.5px] leading-[1.65] text-[#524f47]">{admissions.feeGuideText}</p>
              <p className="text-[13.5px] text-[#6d685c] pt-1">
                Payments are accepted online through the parent portal or by verified bank transfer.
              </p>
            </div>

            <div className={`${theme.cardRadius} p-6 border ${theme.borderClass} space-y-1.5`} style={{ backgroundColor: theme.softBandBg }}>
              <p className="text-[14.5px] font-semibold text-[#171614]">Direct admissions office</p>
              <p className="text-[13.5px] text-[#4c4a43]">
                Call {contact.phone} or email {contact.email} for assessment dates and campus visits.
              </p>
            </div>
          </div>

          {/* Right: Inquiry Form */}
          <div className={`lg:col-span-7 ${theme.cardRadius} border ${theme.borderClass} p-6 sm:p-9`} style={{ backgroundColor: theme.canvasBg }}>
            <div className={`pb-5 mb-6 border-b ${theme.borderClass}`}>
              <h2 className={`${theme.headingClass} text-[28px] sm:text-[34px] leading-[1.08] text-[#171614]`}>
                Admission inquiry form
              </h2>
              <p className="mt-1.5 text-[14px] text-[#57534a]">
                Submit your child&apos;s details to reserve an entrance assessment seat at {tenant.name}.
              </p>
            </div>

            <AdmissionFormClient
              tenantSlug={tenant.slug}
              schoolName={tenant.name}
              primaryColor={primary}
            />
          </div>
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
