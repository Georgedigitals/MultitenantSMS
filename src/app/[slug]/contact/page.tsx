import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { getTemplateThemeTokens } from '@/lib/template-theme';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { ContactFormClient } from './contact-form-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantContactPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  const { tenant, branding, templateId, contact } = siteData;
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
            <span>Contact</span>
          </div>
          <h1 className={`${theme.headingClass} text-[38px] sm:text-[54px] leading-[1.04] text-white`}>
            Contact &amp; campus office
          </h1>
          <p className="text-[16px] sm:text-[18px] leading-[1.6] text-white/80 max-w-2xl">
            Reach our school office for admissions inquiries, student records, or campus visits.
          </p>
        </div>
      </section>

      {/* Chapter 2: Campus Coordinates & Message Form */}
      <section className="w-full py-16 sm:py-24">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left: Structured Contact Ledger */}
          <div className={`lg:col-span-5 ${theme.cardRadius} bg-white border ${theme.borderClass} p-6 sm:p-8 divide-y ${theme.borderClass}`}>
            <div className="pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.eyebrowColor }}>
                Campus address
              </p>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-[#171614]">{contact.address}</p>
            </div>
            <div className="py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.eyebrowColor }}>
                Telephone
              </p>
              <p className="mt-1.5 text-[15px] text-[#171614] ws-tabular">{contact.phone}</p>
            </div>
            {contact.whatsapp && (
              <div className="py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.eyebrowColor }}>
                  WhatsApp
                </p>
                <p className="mt-1.5 text-[15px] text-[#171614] ws-tabular">{contact.whatsapp}</p>
              </div>
            )}
            <div className="py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.eyebrowColor }}>
                Email
              </p>
              <p className="mt-1.5 text-[15px] text-[#171614]">{contact.email}</p>
            </div>
            <div className="pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.eyebrowColor }}>
                Office hours
              </p>
              <p className="mt-1.5 text-[15px] text-[#171614]">{contact.officeHours}</p>
            </div>
          </div>

          {/* Right: Direct Inquiry Form */}
          <div className={`lg:col-span-7 ${theme.cardRadius} bg-white border ${theme.borderClass} p-6 sm:p-9`}>
            <div className={`pb-5 mb-6 border-b ${theme.borderClass}`}>
              <h2 className={`${theme.headingClass} text-[28px] sm:text-[34px] leading-[1.08] text-[#171614]`}>
                Send an inquiry
              </h2>
              <p className="mt-1.5 text-[14px] text-[#57534a]">
                Our administrative team responds to all parent and prospective family messages promptly.
              </p>
            </div>

            <ContactFormClient tenantSlug={tenant.slug} primaryColor={primary} />
          </div>
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
