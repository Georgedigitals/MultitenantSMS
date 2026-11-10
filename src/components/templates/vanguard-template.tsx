'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FeaturedStudent } from './featured-student';
import { SchoolHero } from './school-hero';
import type { PublicSiteData } from '@/lib/site-content';
import {
  Cpu,
  Globe2,
  Atom,
  Rocket,
  ArrowRight,
  Sparkles,
  Camera,
  CheckCircle,
  Binary,
  Layers,
  Zap,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface TemplateProps {
  data: PublicSiteData;
}

export function VanguardTemplate({ data }: TemplateProps) {
  const { tenant, branding, hero, about, academics, admissions, gallery } = data;
  const primaryColor = branding.primaryColor || '#0B132B'; // Deep obsidian navy
  const accentColor = branding.accentColor || '#00F0FF'; // Cyber cyan

  const [activeTab, setActiveTab] = useState<number>(0);

  const heroImage = hero.imageUrl || (gallery[0]?.imageUrl) || null;
  const secondaryImage = gallery[1]?.imageUrl || heroImage;
  const tertiaryImage = gallery[2]?.imageUrl || heroImage;

  // Derive dynamic stage tabs from academics.levels or default STEM stages
  const academicStages = academics.levels && academics.levels.length > 0
    ? academics.levels
    : [
      {
        name: 'Junior STEM College',
        ages: 'Ages 10–13',
        description: 'Foundations of quantitative mathematics, intro robotics, Python coding, and environmental inquiry.',
      },
      {
        name: 'Senior Science & Tech',
        ages: 'Ages 14–17',
        description: 'Advanced physics, computer systems, bio-chemistry, and pre-university project portfolios.',
      },
      {
        name: 'Global Leadership Honors',
        ages: 'All Tiers',
        description: 'Public discourse, model United Nations, computational ethics, and inter-school olympiads.',
      },
    ];

  return (
    <div className="font-sans text-slate-100 bg-[#090D16] selection:text-slate-950" style={{ '--brand-accent': accentColor } as React.CSSProperties}>

      <SchoolHero data={data} variant="vanguard" />

      {/* Featured Student */}
      <FeaturedStudent data={data} />

      {/* ── 2. INTERACTIVE ACADEMIC STAGES TABS ── */}
      <section className="py-20 lg:py-28 bg-[#090D16] border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-2xl mx-auto mb-12">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider border mb-3"
              style={{
                backgroundColor: `${accentColor}18`,
                color: accentColor,
                borderColor: `${accentColor}40`,
              }}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Modular Pathways</span>
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Academic Program Architecture
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Select an educational tier to inspect curricula rigor, STEM competencies, and student progression.
            </p>
          </div>

          {/* Interactive Stage Tab Switcher */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {academicStages.map((stage, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTab(idx)}
                style={
                  activeTab === idx
                    ? {
                      backgroundColor: accentColor,
                      color: '#090D16',
                      boxShadow: `0 10px 25px -5px ${accentColor}40`,
                    }
                    : {}
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === idx
                    ? ''
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
              >
                {stage.name}
              </button>
            ))}
          </div>

          {/* Active Tab Detailed Stage Showcase */}
          {academicStages[activeTab] && (
            <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
              {/* Subtle ambient lighting accent */}
              <div
                className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none opacity-20 blur-3xl"
                style={{ backgroundColor: accentColor }}
              />

              <div className="relative z-10 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span
                    className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-slate-800 border border-slate-700"
                    style={{ color: accentColor }}
                  >
                    {academicStages[activeTab].ages || 'Stage Focus'}
                  </span>
                  <span className="text-xs font-mono text-slate-500">Tier {activeTab + 1} of {academicStages.length}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  {academicStages[activeTab].name}
                </h3>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
                  {academicStages[activeTab].description}
                </p>

                {/* Key Curricular Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800">
                  {academics.highlights.slice(0, 4).map((highlight, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-slate-300">
                      <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <Link
                    href="/academics"
                    style={{ color: accentColor }}
                    className="inline-flex items-center gap-2 text-xs font-bold hover:brightness-125 uppercase tracking-wider"
                  >
                    <span>Full Curriculum Specification</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ── 3. HORIZONTAL CAMPUS REEL & INNOVATION LABS ── */}
      <section className="py-20 bg-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest block mb-2" style={{ color: accentColor }}>
                Campus Infrastructure
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Next-Generation Learning Spaces
              </h2>
            </div>
            <Link
              href="/gallery"
              style={{ color: accentColor }}
              className="mt-4 sm:mt-0 text-xs font-mono uppercase tracking-wider hover:brightness-125 flex items-center gap-1.5"
            >
              <span>Explore Gallery ({gallery.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all group">
              <div
                className="w-12 h-12 rounded-xl border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                style={{
                  backgroundColor: `${accentColor}18`,
                  borderColor: `${accentColor}35`,
                  color: accentColor,
                }}
              >
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Robotics &amp; Computation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dedicated workstations for embedded hardware, IoT prototyping, algorithmic mathematics, and software design.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all group">
              <div
                className="w-12 h-12 rounded-xl border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                style={{
                  backgroundColor: `${accentColor}18`,
                  borderColor: `${accentColor}35`,
                  color: accentColor,
                }}
              >
                <Atom className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Advanced Natural Sciences</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Modern experimental chemistry and wet biology labs certified for senior Cambridge and national exams.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all group">
              <div
                className="w-12 h-12 rounded-xl border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                style={{
                  backgroundColor: `${accentColor}18`,
                  borderColor: `${accentColor}35`,
                  color: accentColor,
                }}
              >
                <Globe2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Global Discourse Studio</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                High-definition multimedia spaces for Model UN conferences, debate championships, and inter-school webinars.
              </p>
            </div>
          </div>

          {/* Photo Gallery Grid */}
          {gallery.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
              {gallery.slice(0, 3).map((img) => (
                <div
                  key={img.id}
                  className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 relative group aspect-16/10"
                >
                  <img
                    src={img.imageUrl}
                    alt={img.caption || 'Campus Life'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {img.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex items-end p-4">
                      <p className="text-xs font-semibold text-white">{img.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* ── 4. DIGITAL CALL TO ACTION ── */}
      <section className="py-20 bg-gradient-to-b from-slate-950 to-slate-900 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: accentColor }}>
            ENROLLMENT PORTAL ACTIVE
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Prepare Your Child For The Future Economy
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            {admissions.text || 'Admissions applications are open. Complete the digital application to schedule an assessment exam.'}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/admissions"
              style={{ backgroundColor: accentColor, color: '#090D16' }}
              className="px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all"
            >
              Start Admission Process
            </Link>
            <Link
              href="/contact"
              className="px-7 py-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all"
            >
              Contact Admissions Counselor
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
