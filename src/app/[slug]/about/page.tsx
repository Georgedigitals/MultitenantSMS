import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { Target, Compass, Award, Heart, CheckCircle2, ArrowRight, Music, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantAboutPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch (err) {
    notFound();
  }

  const { tenant, branding, about, hero } = siteData;
  const primaryColor = branding.primaryColor || '#1E3A8A';
  const accentColor = branding.accentColor || '#2563EB';

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-white">
      <TenantPublicHeader slug={tenant.slug} tenantName={tenant.name} branding={branding} />

      {/* Page Header Banner */}
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
            <span className="text-white font-bold">About Our Institution</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            About {tenant.name}
          </h1>
          <p className="text-base text-slate-200 max-w-2xl font-light leading-relaxed">
            {hero.motto || 'Cultivating intellectual brilliance, moral virtue, and visionary leadership.'}
          </p>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* Mission Card */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-md flex flex-col justify-between">
              <div>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Target className="w-7 h-7" />
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-blue-600 font-bold block mb-2">
                  Our Purpose
                </span>
                <h2 className="text-2xl font-black text-slate-900 mb-4">Our Mission</h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {about.mission}
                </p>
              </div>
            </div>

            {/* Vision Card */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-md flex flex-col justify-between">
              <div>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                  style={{ backgroundColor: accentColor }}
                >
                  <Compass className="w-7 h-7" />
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-amber-600 font-bold block mb-2">
                  The Destination
                </span>
                <h2 className="text-2xl font-black text-slate-900 mb-4">Our Vision</h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {about.vision}
                </p>
              </div>
            </div>
          </div>

          {/* Core Values */}
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-md">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold block mb-2">
                Guiding Principles
              </span>
              <h3 className="text-2xl font-black text-slate-900">Our Core Values</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 text-center">
              {about.coreValues.map((val, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 mx-auto flex items-center justify-center font-bold text-xs mb-3">
                    {idx + 1}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{val}</h4>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Head of School / Principal's Message */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <span className="text-xs font-mono uppercase tracking-widest text-blue-600 font-bold block mb-2 text-center">
              Executive Leadership
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-8 text-center">
              Welcome from the Principal
            </h2>

            <div className="bg-slate-50 p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-inner">
              <blockquote className="text-base sm:text-lg text-slate-700 italic leading-relaxed mb-6 font-serif">
                &ldquo;{about.principalMessage}&rdquo;
              </blockquote>
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900">Office of the Head of School</div>
                  <div className="text-xs text-slate-500">{tenant.name} Administration</div>
                </div>
                <div className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Official Statement
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* School Anthem & Pledge */}
      {about.anthem && (
        <section className="py-20 bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <Music className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-6">School Anthem & Pledge</h2>
            <div className="p-8 rounded-3xl bg-slate-800/60 border border-slate-700 backdrop-blur-md">
              <p className="font-serif italic text-base sm:text-lg text-slate-200 leading-relaxed whitespace-pre-line">
                {about.anthem}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Admissions CTA */}
      <section className="py-16 bg-slate-100 text-center border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-black text-slate-900 mb-3">
            Experience Life at {tenant.name}
          </h3>
          <p className="text-xs text-slate-600 mb-6">
            We invite prospective parents and pupils to visit our campus and learn more about our community.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/admissions"
              className="px-6 py-3 rounded-xl font-bold text-xs text-white shadow-md hover:opacity-95 transition-all flex items-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Explore Admissions Process</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
