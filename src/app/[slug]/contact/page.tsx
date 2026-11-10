import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { ContactFormClient } from './contact-form-client';
import { MapPin, Phone, Mail, Clock, MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantContactPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch (err) {
    notFound();
  }

  const { tenant, branding, contact } = siteData;
  const primaryColor = branding.primaryColor || '#1E3A8A';

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-white">
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
            <span className="text-white font-bold">Contact</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            Contact & Campus Location
          </h1>
          <p className="text-base text-slate-200 max-w-xl mx-auto font-light leading-relaxed">
            We are always delighted to connect with parents, prospective families, and alumni. Reach out to us through any of our channels below.
          </p>
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left: Contact Info Cards */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">Campus Physical Address</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{contact.address}</p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">Official Telephone Lines</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">{contact.phone}</p>
                <p className="text-[11px] text-slate-400 mt-1">Available during school working hours</p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">Electronic Mail</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">{contact.email}</p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">Administrative Working Hours</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{contact.officeHours}</p>
              </div>
            </div>

            {/* Right: Message Form */}
            <div className="lg:col-span-7">
              <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-blue-600">
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-xs font-mono uppercase tracking-widest font-bold">Direct Message</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Send Us an Inquiry</h3>
                <p className="text-xs text-slate-500 mb-8 leading-relaxed">
                  Have a question about admissions, student records, or school events? Fill out the form and our administrative staff will respond promptly.
                </p>

                <ContactFormClient
                  tenantSlug={tenant.slug}
                  primaryColor={primaryColor}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
