import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { BookOpen, GraduationCap, CheckCircle2, Award, Calendar, Laptop, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantAcademicsPage({ params }: PageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch (err) {
    notFound();
  }

  const { tenant, branding, academics } = siteData;
  const primaryColor = branding.primaryColor || '#1E3A8A';
  const accentColor = branding.accentColor || '#2563EB';

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
            <span className="text-white font-bold">Academics</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            Curriculum & Academic Excellence
          </h1>
          <p className="text-base text-slate-200 max-w-2xl font-light leading-relaxed">
            {academics.text}
          </p>
        </div>
      </section>

      {/* Curricula Frameworks */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-blue-600 font-bold block mb-2">
              Integrated Frameworks
            </span>
            <h2 className="text-3xl font-black text-slate-900">
              International & National Curricula
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {academics.curricula.map((curr, idx) => (
              <div key={idx} className="p-8 rounded-3xl bg-white border border-slate-200 shadow-md">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                  style={{ backgroundColor: idx % 2 === 0 ? primaryColor : accentColor }}
                >
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{curr}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Carefully structured to meet competitive global criteria while honoring local cultural and civic requirements.
                </p>
              </div>
            ))}
          </div>

          {/* Academic Levels Breakdown */}
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-md">
            <h3 className="text-2xl font-black text-slate-900 mb-8 text-center">
              Educational Tiers & Programs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {academics.levels.map((lvl, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-base text-slate-900">{lvl.name}</h4>
                      <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-100/60 px-2.5 py-0.5 rounded-full">
                        {lvl.ages}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      {lvl.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Holistic developmental assessment included</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Assessment System & CBT Highlights */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <span className="text-xs font-mono uppercase tracking-widest text-blue-600 font-bold block mb-2">
                Evaluation Standards
              </span>
              <h2 className="text-3xl font-black text-slate-900 mb-6">
                Continuous Assessment & Digital Examinations
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Our academic grading policy uses a rigorous multi-tier evaluation system combining continuous assessments (40%) and termly examinations (60%).
              </p>
              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <Laptop className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Modern CBT Exam Hall</h5>
                    <p className="text-[11px] text-slate-500">Students take periodic digital assessments preparing them early for UTME, SAT, and WAEC CBT.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <Calendar className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Online Result Checking & Scratch Card PINs</h5>
                    <p className="text-[11px] text-slate-500">Instant digital report cards with psychomotor ratings, grade rankings, and teacher remarks.</p>
                  </div>
                </div>
              </div>
              <Link
                href={`/${slug}/results/check`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs text-white shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Check Terminal Results</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="lg:col-span-6 bg-slate-900 text-white p-8 sm:p-10 rounded-3xl">
              <h3 className="text-lg font-bold mb-4">Academic Calendar Framework</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                The school year operates on a 3-term academic calendar structured to optimize student focus and holiday rejuvenation:
              </p>
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">1st Term (Autumn)</span>
                    <span className="text-[10px] text-amber-400 font-mono">September – December</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Orientation, diagnostic tests, mid-term evaluations, and end-of-term examinations.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">2nd Term (Winter/Spring)</span>
                    <span className="text-[10px] text-amber-400 font-mono">January – April</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Inter-house sports athletics, STEM science fairs, and Mock national examinations.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">3rd Term (Summer Promotional)</span>
                    <span className="text-[10px] text-amber-400 font-mono">April – July</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Annual promotional assessments, speech & prize-giving day, and graduation ceremonies.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Admissions CTA */}
      <section className="py-16 bg-slate-50 text-center border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-black text-slate-900 mb-3">
            Ready to Enroll at {tenant.name}?
          </h3>
          <p className="text-xs text-slate-600 mb-6">
            Admissions for the upcoming academic session are currently accepting applications.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/admissions"
              className="px-6 py-3 rounded-xl font-bold text-xs text-white shadow-md hover:opacity-95 transition-all flex items-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <span>View Admission Requirements & Apply</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <TenantPublicFooter data={siteData} />
    </div>
  );
}
