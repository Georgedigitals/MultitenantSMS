import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { AdmissionFormClient } from './admission-form-client';
import { FileCheck, ClipboardList, HelpCircle, CheckCircle2, Phone, Mail } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantAdmissionsPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch (err) {
    notFound();
  }

  const { tenant, branding, admissions, contact } = siteData;
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-300 mb-3">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span className="text-white font-bold">Admissions</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            Admissions & Enrollment
          </h1>
          <p className="text-base text-slate-200 max-w-2xl font-light leading-relaxed">
            {admissions.text}
          </p>
        </div>
      </section>

      {/* Step-by-Step Admission Process */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-blue-600 font-bold block mb-2">
              How To Join
            </span>
            <h2 className="text-3xl font-black text-slate-900">
              The 4-Step Application Roadmap
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {admissions.process.map((p) => (
              <div key={p.step} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md flex flex-col justify-between">
                <div>
                  <div
                    className="w-10 h-10 rounded-xl text-white font-bold flex items-center justify-center text-sm mb-4 shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    0{p.step}
                  </div>
                  <h3 className="font-bold text-base text-slate-900 mb-2">{p.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Form & Requirements Two-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left: Requirements & Tuition */}
            <div className="lg:col-span-6 space-y-8">
              <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-lg text-slate-900">Application Requirements</h3>
                </div>
                <ul className="space-y-3 text-xs text-slate-700">
                  {admissions.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <FileCheck className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-lg text-slate-900">Tuition & Fee Policy</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {admissions.feeGuideText}
                </p>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800">Fee Payment Methods Accepted:</p>
                  <p>• Online automated payment through parent portal (Paystack)</p>
                  <p>• Verified Direct Bank Deposit / Transfer with automated receipt clearance</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-4">
                <HelpCircle className="w-6 h-6 text-blue-600 shrink-0" />
                <div className="text-xs text-blue-900 leading-relaxed">
                  <span className="font-bold block mb-1">Need Direct Admissions Assistance?</span>
                  <span>Contact our admissions counsellors at <strong>{contact.phone}</strong> or email <strong>{contact.email}</strong>.</span>
                </div>
              </div>
            </div>

            {/* Right: Online Application Form */}
            <div className="lg:col-span-6">
              <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
                <div className="mb-6">
                  <span className="text-xs font-mono uppercase tracking-widest text-blue-600 font-bold block mb-1">
                    Instant Online Application
                  </span>
                  <h3 className="text-2xl font-black text-slate-900">
                    Admission Inquiry Form
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Submit your child&apos;s details to reserve an entrance assessment seat.
                  </p>
                </div>

                <AdmissionFormClient
                  tenantSlug={tenant.slug}
                  schoolName={tenant.name}
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
