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

export function HeritageTemplate({ data }: TemplateProps) {
  const { tenant, branding, about, academics, admissions, gallery } = data;
  const { tp } = useLanguage();
  const pathname = usePathname() || '';
  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    return path;
  };

  const primary = branding.primaryColor || '#141414';
  const textOnPrimary = branding.textOnPrimary || '#ffffff';

  const academicLevels =
    academics.levels && academics.levels.length > 0
      ? academics.levels
      : [
          {
            name: 'Early Years & Foundation',
            ages: 'Ages 3–5',
            description: 'Foundational literacy, numeracy, structured play, and curiosity-led discovery.',
          },
          {
            name: 'Primary School',
            ages: 'Ages 6–11',
            description: 'Disciplined reading, mathematics, sciences, arts, and personal character formation.',
          },
          {
            name: 'Secondary College',
            ages: 'Ages 12–17',
            description: 'Rigorous subject specialisation, laboratory practicals, and national examination readiness.',
          },
        ];

  const featuredPhotos = gallery.slice(0, 4);

  return (
    <div className="tenant-editorial text-[#0a0a0a] bg-white">
      {/* Chapter 1: Hero */}
      <SchoolHero data={data} variant="heritage" />

      {/* Optional Chapter: Featured Scholar */}
      <FeaturedStudent data={data} />

      {/* Chapter 2: Principal's Letter (Clean White Field) */}
      <section className="w-full bg-white py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-5">
            <h2 className="tenant-editorial-display text-[38px] sm:text-[52px] leading-[1.02] tracking-[-0.025em] text-[#0a0a0a]">
              {tp('From the Principal’s office')}
            </h2>
            <p className="mt-4 text-[15px] text-[#66645e]">
              {tp(`${tenant.name} Administration`)}
            </p>
          </div>

          <div className="lg:col-span-7 space-y-6 text-[17px] leading-[1.65] text-[#262522]">
            <p>
              {about.principalMessage ||
                'We welcome every family into a school community where disciplined scholarship and daily character formation stand side by side.'}
            </p>

            {about.vision && (
              <blockquote className="py-4 pl-6 border-l-2 border-[#0a0a0a] tenant-editorial-display text-[24px] sm:text-[28px] leading-[1.3] text-[#0a0a0a]">
                “{about.vision}”
              </blockquote>
            )}

            <p className="text-[16px] text-[#57554f] leading-[1.65]">
              {about.text ||
                'Our faculty pairs structured classroom instruction with steady personal mentorship so each student builds lasting confidence.'}
            </p>

            <div className="pt-4">
              <Link
                href={resolveHref('/about')}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-[#0a0a0a] underline underline-offset-4 hover:opacity-70 transition-opacity"
              >
                <span>{tp('Read our school story')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 3: Academic Standard (Archival Stone Field) */}
      <section className="w-full bg-[#ece8df] py-20 sm:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-14 border-b border-[#0a0a0a]/15 items-end">
            <div className="lg:col-span-6">
              <h2 className="tenant-editorial-display text-[38px] sm:text-[54px] leading-[1.0] tracking-[-0.025em] text-[#0a0a0a]">
                {tp('Academic standard & tiers')}
              </h2>
            </div>
            <div className="lg:col-span-6">
              <p className="text-[16px] leading-[1.6] text-[#45433e] max-w-xl">
                {academics.text ||
                  'Every stage of learning follows a structured syllabus with continuous assessment and clear termly reporting.'}
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#0a0a0a]/15">
            {academicLevels.map((level, idx) => (
              <div
                key={idx}
                className="py-8 sm:py-10 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-baseline"
              >
                <div className="md:col-span-4">
                  <h3 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                    {tp(level.name)}
                  </h3>
                </div>
                <div className="md:col-span-2">
                  <span className="text-[14px] text-[#57554f]">{level.ages}</span>
                </div>
                <div className="md:col-span-6">
                  <p className="text-[15px] leading-[1.6] text-[#3a3833]">{level.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8">
            <Link
              href={resolveHref('/academics')}
              className="inline-flex items-center gap-2 text-[14px] font-medium text-[#0a0a0a] underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              <span>{tp('Inspect full curriculum & assessment')}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Chapter 4: Campus Gallery (White Field) */}
      {featuredPhotos.length > 0 && (
        <section className="w-full bg-white py-20 sm:py-28">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-10">
              <h2 className="tenant-editorial-display text-[38px] sm:text-[52px] leading-[1.0] tracking-[-0.025em] text-[#0a0a0a]">
                {tp('Life on campus')}
              </h2>
              <Link
                href={resolveHref('/gallery')}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-[#0a0a0a] underline underline-offset-4 hover:opacity-70"
              >
                <span>{tp('View full gallery')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredPhotos.map((photo) => (
                <figure key={photo.id} className="space-y-2.5">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#f4f3f1]">
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || `${tenant.name} campus`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {photo.caption && (
                    <figcaption className="text-[13px] text-[#57554f]">
                      {photo.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Chapter 5: Admissions & Portal Call to Action (Brand Primary Chapter) */}
      <section
        className="w-full py-20 sm:py-28"
        style={{ backgroundColor: primary, color: textOnPrimary }}
      >
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <h2 className="tenant-editorial-display text-[42px] sm:text-[60px] leading-[0.98] tracking-[-0.025em]">
              {tp('Begin your child’s admission')}
            </h2>
            <p className="text-[17px] leading-[1.6] opacity-85 max-w-xl">
              {admissions.text ||
                `Admissions are open for prospective families. Submit an inquiry online or speak directly with our admissions office at ${tenant.name}.`}
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-wrap lg:justify-end gap-3">
            <Link
              href={resolveHref('/admissions')}
              className="h-12 px-6 bg-white text-[#0a0a0a] hover:bg-[#f4f3f1] text-[14px] font-medium inline-flex items-center gap-2 transition-colors"
            >
              <span>{tp('Apply for admission')}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href={resolveHref('/results/check')}
              className="h-12 px-6 border border-current/40 text-[14px] font-medium inline-flex items-center hover:bg-white/10 transition-colors"
            >
              {tp('Check term result')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
