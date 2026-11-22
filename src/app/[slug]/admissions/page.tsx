import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
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

  const { tenant, branding, admissions, contact } = siteData;
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
            <span>Admissions</span>
          </div>
          <h1 className="tenant-editorial-display text-[44px] sm:text-[64px] leading-[0.98] tracking-[-0.025em]">
            Admissions &amp; enrollment
          </h1>
          <p className="text-[17px] sm:text-[19px] leading-[1.6] opacity-85 max-w-2xl">
            {admissions.text}
          </p>
        </div>
      </section>

      {/* Chapter 2: Application Roadmap (Stone Field) */}
      <section className="w-full bg-[#f4f3f1] py-20 sm:py-24">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
          <div className="pb-10 border-b border-[#d8d5ce]">
            <h2 className="tenant-editorial-display text-[36px] sm:text-[48px] leading-[1.02] text-[#0a0a0a]">
              How to apply
            </h2>
          </div>

          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#d8d5ce] border-b border-[#d8d5ce]">
            {admissions.process.map((p) => (
              <li key={p.step} className="py-8 sm:px-6 first:sm:pl-0 last:sm:pr-0 space-y-2.5">
                <h3 className="text-[18px] font-semibold text-[#0a0a0a]">{p.title}</h3>
                <p className="text-[14px] leading-[1.65] text-[#4f4d48]">{p.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Chapter 3: Requirements & Online Application Form (White Field) */}
      <section className="w-full bg-white py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left: Requirements & Tuition Policy */}
          <div className="lg:col-span-5 space-y-10">
            <div className="space-y-4">
              <h2 className="tenant-editorial-display text-[34px] leading-[1.05] text-[#0a0a0a]">
                Application requirements
              </h2>
              <ul className="divide-y divide-[#efede9] border-t border-b border-[#efede9]">
                {admissions.requirements.map((req, i) => (
                  <li key={i} className="py-3.5 text-[15px] leading-[1.55] text-[#262522]">
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-[18px] font-semibold text-[#0a0a0a]">Tuition &amp; fee policy</h3>
              <p className="text-[15px] leading-[1.65] text-[#4f4d48]">
                {admissions.feeGuideText}
              </p>
              <p className="text-[14px] text-[#66645e] pt-1">
                Payments are accepted online through the parent portal or by verified bank transfer.
              </p>
            </div>

            <div className="p-6 bg-[#f4f3f1] border border-[#e4e2dd] space-y-1.5">
              <p className="text-[15px] font-semibold text-[#0a0a0a]">Direct admissions office</p>
              <p className="text-[14px] text-[#4f4d48]">
                Call {contact.phone} or email {contact.email} for assessment dates and campus visits.
              </p>
            </div>
          </div>

          {/* Right: Inquiry Form */}
          <div className="lg:col-span-7 bg-[#f4f3f1] border border-[#e4e2dd] p-7 sm:p-10">
            <div className="pb-6 mb-6 border-b border-[#d8d5ce]">
              <h2 className="tenant-editorial-display text-[34px] leading-[1.05] text-[#0a0a0a]">
                Admission inquiry form
              </h2>
              <p className="mt-2 text-[14px] text-[#57554f]">
                Submit your child’s details to reserve an entrance assessment seat at {tenant.name}.
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
