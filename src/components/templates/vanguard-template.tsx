'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { FeaturedStudent } from './featured-student';
import { SchoolHero } from './school-hero';
import type { PublicSiteData } from '@/lib/site-content';

interface TemplateProps {
  data: PublicSiteData;
}

export function VanguardTemplate({ data }: TemplateProps) {
  const { tenant, branding, about, academics, admissions, gallery } = data;
  const pathname = usePathname() || '';
  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    return path;
  };

  const primary = branding.primaryColor || '#111315';
  const accent = branding.accentColor || '#1d5fbf';
  const textOnPrimary = branding.textOnPrimary || '#ffffff';

  const [activeTab, setActiveTab] = useState<number>(0);

  const academicStages =
    academics.levels && academics.levels.length > 0
      ? academics.levels
      : [
          {
            name: 'Junior STEM College',
            ages: 'Ages 10–13',
            description:
              'Foundations of quantitative mathematics, structured computing, laboratory science, and analytical writing.',
          },
          {
            name: 'Senior Science & Tech',
            ages: 'Ages 14–17',
            description:
              'Advanced physics, computer systems, chemistry, and university entrance examination preparation.',
          },
          {
            name: 'Leadership & Honors',
            ages: 'All tiers',
            description:
              'Public discourse, inter-school academic competitions, debate, and independent capstone research.',
          },
        ];

  const featuredPhotos = gallery.slice(0, 4);
  const currentStage = academicStages[activeTab] || academicStages[0];

  return (
    <div className="tenant-editorial text-[#0a0a0a] bg-white">
      {/* Chapter 1: Obsidian Editorial Hero */}
      <SchoolHero data={data} variant="vanguard" />

      {/* Optional Chapter: Featured Scholar */}
      <FeaturedStudent data={data} />

      {/* Chapter 2: Interactive Academic Pathways (Crisp White Field) */}
      <section className="w-full bg-white py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 border-b border-[#e4e2dd] items-end">
            <div className="lg:col-span-6">
              <h2 className="tenant-editorial-display text-[38px] sm:text-[54px] leading-[1.0] tracking-[-0.025em] text-[#0a0a0a]">
                Academic program architecture
              </h2>
            </div>
            <div className="lg:col-span-6">
              <p className="text-[16px] leading-[1.6] text-[#57554f] max-w-xl">
                {academics.text ||
                  'Select an academic tier to inspect curriculum depth, laboratory work, and assessment benchmarks.'}
              </p>
            </div>
          </div>

          {/* Clean Tab Switcher */}
          <div className="flex flex-wrap gap-2 pt-8 pb-8 border-b border-[#efede9]" role="tablist">
            {academicStages.map((stage, idx) => {
              const selected = activeTab === idx;
              return (
                <button
                  key={stage.name}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(idx)}
                  className={`h-10 px-5 text-[14px] font-medium transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#111315] text-white'
                      : 'bg-[#f4f3f1] text-[#4f4d48] hover:bg-[#e7e5e0] hover:text-[#0a0a0a]'
                  }`}
                >
                  {stage.name}
                </button>
              );
            })}
          </div>

          {/* Active Stage Details */}
          {currentStage && (
            <div className="py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5 space-y-2">
                <p className="text-[14px] font-medium text-[#66645e]">{currentStage.ages}</p>
                <h3 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                  {currentStage.name}
                </h3>
              </div>
              <div className="lg:col-span-7 space-y-6">
                <p className="text-[17px] leading-[1.65] text-[#262522] max-w-2xl">
                  {currentStage.description}
                </p>
                <div className="flex flex-wrap gap-6 pt-2">
                  <Link
                    href={resolveHref('/academics')}
                    className="inline-flex items-center gap-2 text-[14px] font-medium text-[#0a0a0a] underline underline-offset-4 hover:opacity-70"
                  >
                    <span>Explore full curriculum</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href={resolveHref('/results/check')}
                    className="inline-flex items-center gap-2 text-[14px] font-medium text-[#57554f] underline underline-offset-4 hover:text-[#0a0a0a]"
                  >
                    <span>Term result checker</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Chapter 3: Leadership & Vision (Deep Charcoal Field) */}
      <section className="w-full bg-[#191d24] text-white py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-3">
            <h2 className="tenant-editorial-display text-[38px] sm:text-[52px] leading-[1.02]">
              Prepared for what comes next
            </h2>
            <p className="text-[15px] text-[#a5a9b1]">{tenant.name}</p>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <blockquote className="tenant-editorial-display text-[26px] sm:text-[34px] leading-[1.25] text-white">
              “{about.vision || about.principalMessage || 'Rigorous thinking, measurable standards, and modern digital assessment.'}”
            </blockquote>
            <p className="text-[16px] leading-[1.65] text-[#c5c8ce] max-w-2xl">
              {about.mission ||
                about.text ||
                'Students work with modern CBT exam tools, structured continuous assessment, and attentive faculty mentorship.'}
            </p>
            <div className="pt-2">
              <Link
                href={resolveHref('/about')}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-white underline underline-offset-4 hover:opacity-80"
              >
                <span>Read about our leadership</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 4: Campus Gallery (Stone Field) */}
      {featuredPhotos.length > 0 && (
        <section className="w-full bg-[#f4f3f1] py-20 sm:py-28">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-10">
              <h2 className="tenant-editorial-display text-[38px] sm:text-[52px] leading-[1.0] text-[#0a0a0a]">
                Inside the campus
              </h2>
              <Link
                href={resolveHref('/gallery')}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-[#0a0a0a] underline underline-offset-4 hover:opacity-70"
              >
                <span>Open campus gallery</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredPhotos.map((photo) => (
                <figure key={photo.id} className="space-y-2.5">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#e4e2dd]">
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || `${tenant.name} campus`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {photo.caption && (
                    <figcaption className="text-[13px] text-[#57554f]">{photo.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Chapter 5: Admissions CTA (Brand Field) */}
      <section
        className="w-full py-20 sm:py-28"
        style={{ backgroundColor: primary, color: textOnPrimary }}
      >
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <h2 className="tenant-editorial-display text-[42px] sm:text-[60px] leading-[0.98] tracking-[-0.025em]">
              Admissions for the next session
            </h2>
            <p className="text-[17px] leading-[1.6] opacity-85 max-w-xl">
              {admissions.text ||
                `Submit an online admission inquiry and schedule an entrance assessment at ${tenant.name}.`}
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-wrap lg:justify-end gap-3">
            <Link
              href={resolveHref('/admissions')}
              className="h-12 px-6 text-[14px] font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent, color: '#111315' }}
            >
              <span>Apply now</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href={resolveHref('/login')}
              className="h-12 px-6 border border-current/40 text-[14px] font-medium inline-flex items-center hover:bg-white/10 transition-colors"
            >
              Portal sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
