'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { FeaturedStudent } from './featured-student';
import { SchoolHero } from './school-hero';
import type { PublicSiteData } from '@/lib/site-content';
import { useLanguage } from '@/components/language-provider';

interface TemplateProps {
  data: PublicSiteData;
}

const pillars = [
  {
    title: 'Active discovery',
    body: 'Inquiry-driven lessons that build genuine enthusiasm for reading, mathematics, sciences, and practical problem solving.',
  },
  {
    title: 'Personal pastoral care',
    body: 'Dedicated form teachers who know every learner by name and stay closely connected with their academic and emotional rhythm.',
  },
  {
    title: 'Clear daily routines',
    body: 'Structured school days, attentive supervision, and transparent parent communication from morning assembly to dismissal.',
  },
  {
    title: 'Creative & athletic life',
    body: 'Music, visual arts, clubs, and sports that help students discover their voice and build teamwork beyond the classroom.',
  },
];

export function HorizonTemplate({ data }: TemplateProps) {
  const { tenant, branding, about, academics, admissions, gallery } = data;
  const { tp } = useLanguage();
  const pathname = usePathname() || '';
  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    return path;
  };

  const primary = branding.primaryColor || '#1e4635';
  const textOnPrimary = branding.textOnPrimary || '#ffffff';
  const featuredPhotos = gallery.slice(0, 3);

  return (
    <div className="tenant-editorial text-[#152019] bg-white">
      {/* Chapter 1: Warm Linen Hero */}
      <SchoolHero data={data} variant="horizon" />

      {/* Optional Chapter: Featured Scholar */}
      <FeaturedStudent data={data} />

      {/* Chapter 2: Four Pillars of Care (Clean White Editorial Grid) */}
      <section className="w-full bg-white py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-14 border-b border-[#e4e2dd] items-end">
            <div className="lg:col-span-6">
              <h2 className="tenant-editorial-display text-[38px] sm:text-[54px] leading-[1.0] tracking-[-0.025em] text-[#152019]">
                {tp('Care, discovery & character')}
              </h2>
            </div>
            <div className="lg:col-span-6">
              <p className="text-[16px] leading-[1.6] text-[#4d5950] max-w-xl">
                {about.mission ||
                  'We build emotional resilience, curiosity, and strong academic habits side by side.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 border-b border-[#e4e2dd]">
            {pillars.map((pillar, idx) => (
              <div
                key={pillar.title}
                className={`py-10 ${idx >= 2 ? 'md:border-t md:border-[#e4e2dd]' : ''} ${
                  idx % 2 === 1 ? 'md:pl-12 md:border-l md:border-[#e4e2dd]' : 'md:pr-12'
                }`}
              >
                <h3 className="text-[20px] font-semibold tracking-[-0.015em] text-[#152019]">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-[#4d5950] max-w-[46ch]">
                  {pillar.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 3: Deep Forest Vision & Principal Statement */}
      <section className="w-full bg-[#152019] text-[#f4f3f1] py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="tenant-editorial-display text-[38px] sm:text-[52px] leading-[1.02] text-white">
              {tp('A school built around families')}
            </h2>
            <p className="text-[15px] text-[#aeb8b1]">
              {tenant.name}
            </p>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <blockquote className="tenant-editorial-display text-[26px] sm:text-[34px] leading-[1.25] text-white">
              “{about.principalMessage || about.vision || 'Every child deserves a calm, demanding, and joyful place to learn.'}”
            </blockquote>
            <p className="text-[16px] leading-[1.65] text-[#c5cec7] max-w-2xl">
              {academics.text ||
                'From early years through secondary graduation, parents stay informed on attendance, assessments, and termly progress.'}
            </p>
            <div className="pt-2 flex flex-wrap gap-6">
              <Link
                href={resolveHref('/about')}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-white underline underline-offset-4 hover:opacity-80"
              >
                <span>About {tenant.name}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                href={resolveHref('/academics')}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-[#c5cec7] underline underline-offset-4 hover:text-white"
              >
                <span>{tp('Explore academics')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 4: Campus Scenes (Stone Field) */}
      {featuredPhotos.length > 0 && (
        <section className="w-full bg-[#f4f3f1] py-20 sm:py-28">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-10">
              <h2 className="tenant-editorial-display text-[38px] sm:text-[52px] leading-[1.0] text-[#152019]">
                {tp('Through the school day')}
              </h2>
              <Link
                href={resolveHref('/gallery')}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-[#152019] underline underline-offset-4 hover:opacity-70"
              >
                <span>{tp('See all campus photos')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {featuredPhotos.map((photo) => (
                <figure key={photo.id} className="space-y-3">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#e4e2dd]">
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || `${tenant.name} campus`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {photo.caption && (
                    <figcaption className="text-[14px] text-[#4d5950]">{photo.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Chapter 5: Admissions CTA (Brand Primary Field) */}
      <section
        className="w-full py-20 sm:py-28"
        style={{ backgroundColor: primary, color: textOnPrimary }}
      >
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <h2 className="tenant-editorial-display text-[42px] sm:text-[60px] leading-[0.98] tracking-[-0.025em]">
              Visit our campus or apply online
            </h2>
            <p className="text-[17px] leading-[1.6] opacity-85 max-w-xl">
              {admissions.text ||
                'Meet our teachers, tour the classrooms, and reserve an entrance assessment date for the upcoming term.'}
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-wrap lg:justify-end gap-3">
            <Link
              href={resolveHref('/admissions')}
              className="h-12 px-6 bg-white text-[#152019] hover:bg-[#f4f3f1] text-[14px] font-medium inline-flex items-center gap-2 transition-colors"
            >
              <span>Start admission inquiry</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href={resolveHref('/contact')}
              className="h-12 px-6 border border-current/40 text-[14px] font-medium inline-flex items-center hover:bg-white/10 transition-colors"
            >
              Contact the office
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
