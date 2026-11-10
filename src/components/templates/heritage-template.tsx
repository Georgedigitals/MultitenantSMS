'use client';

import React from 'react';
import Link from 'next/link';
import { FeaturedStudent } from './featured-student';
import { SchoolHero } from './school-hero';
import type { PublicSiteData } from '@/lib/site-content';
import {
  Award,
  BookOpen,
  GraduationCap,
  Users,
  Compass,
  ArrowRight,
  Camera,
  CheckCircle2,
  Calendar,
  Scroll,
  FileCheck2,
  ChevronRight,
  Shield,
  Quote,
} from 'lucide-react';

interface TemplateProps {
  data: PublicSiteData;
}

export function HeritageTemplate({ data }: TemplateProps) {
  const { tenant, branding, hero, about, academics, admissions, gallery } = data;
  const primaryColor = branding.primaryColor || '#0F2942'; // Oxford collegiate navy
  const accentColor = branding.accentColor || '#C59B27'; // Traditional antique gold

  const heroImage = hero.imageUrl || (gallery[0]?.imageUrl) || null;
  const secondaryImage = gallery[1]?.imageUrl || heroImage;

  return (
    <div className="font-serif text-slate-800 bg-[#FDFBF7] selection:bg-amber-200 selection:text-slate-900">
      <SchoolHero data={data} variant="heritage" />

      {/* Featured Student Scholar Spotlight */}
      <FeaturedStudent data={data} />

      {/* ── 2. EDITORIAL RECTOR'S ADDRESS (Parchment Paper Letter) ── */}
      <section className="py-20 lg:py-28 bg-[#FAF7F0] border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-8 sm:p-12 lg:p-16 relative">
            {/* Top Formal Letterhead */}
            <div className="text-center pb-8 border-b border-stone-200/90 space-y-2">
              <span className="text-[11px] font-sans font-bold tracking-[0.25em] text-amber-800 uppercase">
                Office of the Principal & Rector
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                A Letter to Parents & Guardians
              </h2>
              <div className="w-16 h-0.5 bg-amber-700/60 mx-auto mt-4" />
            </div>

            {/* Letter Body */}
            <div className="pt-8 space-y-6 text-slate-700 leading-relaxed text-base sm:text-lg">
              <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-slate-900 first-letter:mr-2.5 first-letter:float-left first-letter:font-serif">
                {about.principalMessage ||
                  'We take profound joy in welcoming you to our collegiate community. Here, academic achievement is not viewed as an isolated pursuit, but rather as one pillar of complete personal and moral integrity.'}
              </p>

              <blockquote className="my-8 py-4 px-6 bg-amber-50/50 rounded-r-xl border-l-4 border-amber-700 italic text-slate-800 text-base">
                &ldquo;{about.vision || 'To foster leaders who speak with wisdom, act with integrity, and lead with compassion.'}&rdquo;
              </blockquote>

              <p className="text-sm sm:text-base font-sans text-slate-600 leading-relaxed">
                {about.text ||
                  'Our faculty is deeply committed to preserving rigorous classical pedagogy while incorporating modern analytical competencies. Every learner is guided to discover their highest intellectual and ethical potential.'}
              </p>

              {/* Signature Block */}
              <div className="pt-8 border-t border-stone-100 flex flex-col sm:flex-row sm:items-end justify-between gap-6 font-sans">
                <div>
                  <div className="font-serif italic text-2xl text-slate-900 font-bold mb-1">
                    The Principal
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{tenant.name} Administration</p>
                </div>

                <Link
                  href="/about"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 uppercase tracking-wider"
                >
                  <span>Read Full School History</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. THE ACADEMIC LEDGER (Structured Curriculum Columns) ── */}
      <section className="py-20 lg:py-28 bg-[#FDFBF7] border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-16">
            <span className="text-[11px] font-sans font-bold tracking-[0.25em] text-amber-800 uppercase block mb-2">
              Curricular Disciplines
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              The Academic Standard & Rigor
            </h2>
            <p className="font-sans text-sm text-slate-600 mt-3 leading-relaxed">
              {academics.text || 'Our academic tiers blend foundational classical rigor with comprehensive modern assessment.'}
            </p>
          </div>

          {/* Academic Ledger Rows */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Ledger Item 1: Core Curricula */}
            <div className="bg-white p-8 rounded-xl border border-stone-200 shadow-sm relative group hover:border-amber-700/40 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-[#0F2942] text-amber-300 flex items-center justify-center mb-6 shadow-sm">
                <BookOpen className="w-6 h-6 stroke-1.5" />
              </div>
              <span className="font-sans text-[11px] font-bold text-amber-800 tracking-wider uppercase block mb-1">
                Trivium & Pedagogy
              </span>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Academic Excellence</h3>
              <p className="font-sans text-xs text-slate-600 leading-relaxed mb-6">
                Structured fusion of high analytical reasoning, formal sciences, and comprehensive literature.
              </p>
              <div className="space-y-2.5 pt-4 border-t border-stone-100 font-sans">
                {academics.highlights.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ledger Item 2: Character & Heritage */}
            <div className="bg-white p-8 rounded-xl border border-stone-200 shadow-sm relative group hover:border-amber-700/40 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-[#0F2942] text-amber-300 flex items-center justify-center mb-6 shadow-sm">
                <Compass className="w-6 h-6 stroke-1.5" />
              </div>
              <span className="font-sans text-[11px] font-bold text-amber-800 tracking-wider uppercase block mb-1">
                Moral Discipleship
              </span>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Character Formation</h3>
              <p className="font-sans text-xs text-slate-600 leading-relaxed mb-6">
                Cultivating courage, discipline, and ethical dignity that anchors student achievement through adulthood.
              </p>
              <div className="space-y-2.5 pt-4 border-t border-stone-100 font-sans">
                {about.coreValues.slice(0, 3).map((val, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ledger Item 3: Faculty Fellowship */}
            <div className="bg-white p-8 rounded-xl border border-stone-200 shadow-sm relative group hover:border-amber-700/40 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-[#0F2942] text-amber-300 flex items-center justify-center mb-6 shadow-sm">
                <Users className="w-6 h-6 stroke-1.5" />
              </div>
              <span className="font-sans text-[11px] font-bold text-amber-800 tracking-wider uppercase block mb-1">
                Scholarly Guidance
              </span>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Master Educators</h3>
              <p className="font-sans text-xs text-slate-600 leading-relaxed mb-6">
                Close tutor-to-student mentorship ensuring no learner advances with unaddressed cognitive gaps.
              </p>
              <div className="pt-4 border-t border-stone-100 font-sans">
                <Link
                  href="/academics"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 uppercase tracking-wider"
                >
                  <span>Explore All Program Tiers</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. ARCHIVAL PHOTO GALLERY (Classical Framed Exhibits) ── */}
      <section className="py-20 bg-[#F7F4EC] border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
            <div>
              <span className="text-[11px] font-sans font-bold tracking-[0.25em] text-amber-800 uppercase block mb-2">
                Pictorial Chronicles
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Moments of Campus Distinction
              </h2>
            </div>
            <Link
              href="/gallery"
              className="mt-4 sm:mt-0 font-sans text-xs uppercase tracking-widest font-bold text-amber-900 hover:text-amber-950 flex items-center gap-2"
            >
              <span>View Photographic Archives ({gallery.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {gallery.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-stone-300 font-sans">
              <Camera className="w-10 h-10 text-stone-400 mx-auto mb-2" />
              <p className="text-xs text-stone-500">Official archival imagery will be exhibited here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {gallery.slice(0, 3).map((img) => (
                <div
                  key={img.id}
                  className="bg-white p-3 rounded-lg border border-stone-300 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="overflow-hidden rounded-sm relative aspect-4/3 bg-stone-100">
                    <img
                      src={img.imageUrl}
                      alt={img.caption || 'Campus Archive'}
                      className="w-full h-full object-cover filter contrast-[1.02] hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  {img.caption && (
                    <div className="pt-3 px-1 font-sans">
                      <p className="text-xs font-semibold text-slate-800 font-serif line-clamp-1">{img.caption}</p>
                      {img.album && (
                        <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block mt-0.5">
                          {img.album}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. FORMAL INVITATION TO ENROLL (Brass & Navy Banner) ── */}
      <section
        className="py-16 sm:py-20 text-white relative overflow-hidden"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <span className="text-[11px] font-sans font-bold tracking-[0.3em] text-amber-300 uppercase">
            Admissions for the Academic Session
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Begin the Journey of Distinguished Scholarship
          </h2>
          <p className="font-sans text-sm sm:text-base text-slate-200 max-w-xl mx-auto leading-relaxed">
            {admissions.text || 'Applications are formally received and evaluated by the Admissions Board. Secure your ward’s enrollment for the upcoming academic year.'}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4 font-sans">
            <Link
              href="/admissions"
              className="px-8 py-4 rounded-md font-bold text-xs uppercase tracking-widest bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg transition-all"
            >
              Start Admission Application
            </Link>
            <Link
              href="/contact"
              className="px-7 py-4 rounded-md font-bold text-xs uppercase tracking-widest text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
            >
              Inquire with Admissions Office
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
