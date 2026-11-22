import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
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

  const { tenant, branding, contact } = siteData;
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
            <span>Contact</span>
          </div>
          <h1 className="tenant-editorial-display text-[44px] sm:text-[64px] leading-[0.98] tracking-[-0.025em]">
            Contact &amp; campus office
          </h1>
          <p className="text-[17px] sm:text-[19px] leading-[1.6] opacity-85 max-w-2xl">
            Reach our school office for admissions inquiries, student records, or campus visits.
          </p>
        </div>
      </section>

      {/* Chapter 2: Campus Coordinates & Message Form */}
      <section className="w-full bg-white py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left: Structured Contact Ledger */}
          <div className="lg:col-span-5 divide-y divide-[#e4e2dd] border-t border-b border-[#e4e2dd]">
            <div className="py-6">
              <p className="text-[13px] text-[#66645e]">Campus address</p>
              <p className="mt-1.5 text-[16px] leading-[1.6] text-[#0a0a0a]">{contact.address}</p>
            </div>
            <div className="py-6">
              <p className="text-[13px] text-[#66645e]">Telephone</p>
              <p className="mt-1.5 text-[16px] text-[#0a0a0a] ws-tabular">{contact.phone}</p>
            </div>
            <div className="py-6">
              <p className="text-[13px] text-[#66645e]">Email</p>
              <p className="mt-1.5 text-[16px] text-[#0a0a0a]">{contact.email}</p>
            </div>
            <div className="py-6">
              <p className="text-[13px] text-[#66645e]">Office hours</p>
              <p className="mt-1.5 text-[16px] text-[#0a0a0a]">{contact.officeHours}</p>
            </div>
          </div>

          {/* Right: Direct Inquiry Form */}
          <div className="lg:col-span-7 bg-[#f4f3f1] border border-[#e4e2dd] p-7 sm:p-10">
            <div className="pb-6 mb-6 border-b border-[#d8d5ce]">
              <h2 className="tenant-editorial-display text-[34px] leading-[1.05] text-[#0a0a0a]">
                Send an inquiry
              </h2>
              <p className="mt-2 text-[14px] text-[#57554f]">
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
