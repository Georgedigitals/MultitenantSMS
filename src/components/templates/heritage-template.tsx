'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { FeaturedStudent } from './featured-student';
import type { PublicSiteData } from '@/lib/site-content';
import { useLanguage } from '@/components/language-provider';

interface TemplateProps {
  data: PublicSiteData;
}

export function HeritageTemplate({ data }: TemplateProps) {
  const { tenant, branding, hero, about, stats, academics, admissions, newsEvents, gallery } = data;
  const { tp } = useLanguage();
  const pathname = usePathname() || '';
  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    return path;
  };

  const primary = branding.primaryColor || '#1D3251';
  const accent = branding.accentColor || '#C8A45D';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const textOnAccent = branding.textOnAccent || '#141414';

  const deepBandBg = `color-mix(in srgb, ${primary} 80%, #0d1626)`;
  const accentSoftBg = `color-mix(in srgb, ${accent} 38%, transparent)`;
  const accentTint = `color-mix(in srgb, ${accent} 78%, #6e5a30)`;

  const academicLevels =
    academics.levels && academics.levels.length > 0
      ? academics.levels.slice(0, 4)
      : [
          {
            name: 'Early Years',
            ages: 'Ages 2–5',
            description: 'A gentle start built on language, curiosity, and joyful daily habits.',
          },
          {
            name: 'Primary',
            ages: 'Ages 6–11',
            description: 'Strong foundations in reading, writing, mathematics, and science.',
          },
          {
            name: 'Secondary',
            ages: 'Ages 12–17',
            description: 'Rigorous teaching, subject depth, and preparation for what comes next.',
          },
        ];

  const heroTitleWords = (hero.title || `Welcome to ${tenant.name}`).trim().split(/\s+/);
  const lastWord = heroTitleWords.length > 1 ? heroTitleWords.pop() : '';
  const mainHeading = heroTitleWords.join(' ');

  const featuredNews = newsEvents[0];
  const secondaryNews = newsEvents.slice(1, 4);
  const featuredPhotos = gallery.slice(0, 3);
  const headPortrait = about.headPhotoUrl || about.campusPhotoUrl || gallery[0]?.imageUrl || null;

  return (
    <div className="tenant-editorial bg-[#F8F5EE] text-[#171614]">
      {/* Chapter 1: Editorial Arched Hero */}
      <section className="w-full pt-10 pb-14 sm:pt-14 sm:pb-20">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left: Arched Portrait Frame */}
          <div className="lg:col-span-5 relative mx-auto w-full max-w-[380px] lg:max-w-none">
            <div
              className="relative aspect-[4/4.6] w-full rounded-t-full overflow-hidden bg-[#E6DFD2]"
              style={{ boxShadow: `10px 10px 0 -2px #F8F5EE, 10px 10px 0 0px color-mix(in srgb, ${accent} 55%, #cfc4ad)` }}
            >
              {hero.imageUrl ? (
                <img
                  src={hero.imageUrl}
                  alt={tenant.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full flex flex-col items-center justify-center p-8 text-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${primary} 10%, #E7E0D3)` }}
                >
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={tenant.name} className="h-24 w-24 object-contain opacity-90" />
                  ) : (
                    <span
                      className="tenant-editorial-display text-6xl font-semibold opacity-35"
                      style={{ color: primary }}
                    >
                      {tenant.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#6d685c]">{tenant.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Editorial Copy */}
          <div className="lg:col-span-7 space-y-6">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: accentTint }}
            >
              {hero.motto || 'Early Years · Primary · Secondary'}
            </p>

            <h1 className="tenant-editorial-display text-[40px] sm:text-[54px] leading-[1.06] tracking-[-0.02em] text-[#171614]">
              {mainHeading}{' '}
              {lastWord && (
                <span
                  className="italic px-1"
                  style={{
                    backgroundImage: `linear-gradient(transparent 66%, ${accentSoftBg} 66%)`,
                  }}
                >
                  {lastWord}
                </span>
              )}
            </h1>

            <p className="text-[15px] sm:text-[16px] leading-[1.7] text-[#4f4b43] max-w-[50ch]">
              {hero.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={resolveHref('/admissions')}
                className="h-11 px-6 rounded-[3px] text-[12px] font-semibold uppercase tracking-[0.12em] inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary, color: textOnPrimary }}
              >
                <span>{tp('Apply for admission')}</span>
              </Link>
              <Link
                href={resolveHref('/about')}
                className="h-11 px-6 rounded-[3px] border border-[#171614]/35 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#171614] inline-flex items-center hover:bg-[#171614]/5 transition-colors"
              >
                {tp('Our story')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 2: 3-Column Editorial Stats Strip */}
      <section className="w-full border-y border-[#E5DEC9]">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-3 divide-x divide-[#E5DEC9]">
            <div className="py-7 sm:py-9 text-center px-3">
              <p className="tenant-editorial-display text-[26px] sm:text-[34px] font-medium text-[#171614]">
                {stats.foundedYear}
              </p>
              <p className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-[#787266]">
                {tp('Founded')}
              </p>
            </div>
            <div className="py-7 sm:py-9 text-center px-3">
              <p className="tenant-editorial-display text-[26px] sm:text-[34px] font-medium text-[#171614]">
                {stats.teacherRatio}
              </p>
              <p className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-[#787266]">
                {tp('Pupil–teacher ratio')}
              </p>
            </div>
            <div className="py-7 sm:py-9 text-center px-3">
              <p className="tenant-editorial-display text-[26px] sm:text-[34px] font-medium text-[#171614]">
                {stats.passRate}
              </p>
              <p className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-[#787266]">
                {tp('Academic success')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Optional Chapter: Featured Scholar */}
      <FeaturedStudent data={data} />

      {/* Chapter 3: From the Head */}
      <section className="w-full py-16 sm:py-24">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3"
              style={{ color: accentTint }}
            >
              {tp('From the Head')}
            </p>
            <div className="aspect-[4/3] w-full overflow-hidden rounded-[4px] bg-[#E6DFD2] border border-[#DFD7C4]">
              {headPortrait ? (
                <img
                  src={headPortrait}
                  alt={about.headName || 'Head of School'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full flex items-center justify-center text-center p-6"
                  style={{ backgroundColor: `color-mix(in srgb, ${primary} 8%, #E7E0D3)` }}
                >
                  <div>
                    <p className="tenant-editorial-display text-3xl opacity-45" style={{ color: primary }}>
                      {tenant.name.charAt(0).toUpperCase()}
                    </p>
                    <p className="mt-2 text-xs text-[#6d685c]">{about.headName || 'Head of School'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <blockquote className="tenant-editorial-display italic text-[22px] sm:text-[28px] leading-[1.42] text-[#1D1B17]">
              “{about.principalMessage}”
            </blockquote>

            <p className="text-[13px] font-semibold text-[#171614]">
              {about.headName || `Head of School, ${tenant.name}`}
            </p>

            <div>
              <Link
                href={resolveHref('/about')}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] pb-1 border-b transition-opacity hover:opacity-70"
                style={{ color: primary, borderColor: accent }}
              >
                <span>{tp('Read our story')}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 4: Academics (Crisp White Editorial Ledger) */}
      <section className="w-full bg-white py-16 sm:py-24 border-y border-[#ECE6D8]">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4 pb-8 border-b border-[#ECE6D8]">
            <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.05] text-[#171614]">
              {tp('Academics')}
            </h2>
            <Link
              href={resolveHref('/academics')}
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4f4b43] underline underline-offset-4 hover:text-[#171614]"
            >
              {tp('Full curriculum')}
            </Link>
          </div>

          <div className="divide-y divide-[#ECE6D8]">
            {academicLevels.map((level, idx) => (
              <div
                key={idx}
                className="py-6 sm:py-7 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 items-baseline"
              >
                <div className="md:col-span-1">
                  <span
                    className="tenant-editorial-display text-[22px] font-medium"
                    style={{ color: accentTint }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="md:col-span-3">
                  <h3 className="tenant-editorial-display text-[20px] font-medium text-[#171614]">
                    {tp(level.name)}
                  </h3>
                </div>
                <div className="md:col-span-6">
                  <p className="text-[14px] leading-[1.6] text-[#5c5850]">
                    <span className="font-medium text-[#171614]">({level.ages})</span> {level.description}
                  </p>
                </div>
                <div className="md:col-span-2 md:text-right">
                  <Link
                    href={resolveHref('/academics')}
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] underline underline-offset-4 hover:opacity-70"
                    style={{ color: primary }}
                  >
                    {tp('Explore')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 5: Deep Logo-Tinted Admissions Band */}
      <section className="w-full py-16 sm:py-24 text-white" style={{ backgroundColor: deepBandBg }}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/65">
              {tp('Admissions')}
            </p>
            <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.1] text-white">
              {tp("Begin your child's journey with us")}
            </h2>
            <p className="text-[14px] leading-[1.65] text-white/75">
              {admissions.text}
            </p>
            <div className="pt-2">
              <Link
                href={resolveHref('/admissions')}
                className="h-11 px-6 rounded-[3px] text-[11px] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent, color: textOnAccent }}
              >
                <span>{tp('Start an application')}</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 divide-y divide-white/15 border-t border-white/15">
            {admissions.process.slice(0, 3).map((step) => (
              <div key={step.step} className="py-5 flex items-start gap-6">
                <span
                  className="tenant-editorial-display text-[22px] leading-none pt-0.5 shrink-0"
                  style={{ color: accent }}
                >
                  {step.step}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-white">{tp(step.title)}</h3>
                  <p className="mt-1 text-[13px] leading-[1.55] text-white/70">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 6: News & Events */}
      <section id="news" className="w-full py-16 sm:py-24">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4 pb-8">
            <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.05] text-[#171614]">
              {tp('News & events')}
            </h2>
            <Link
              href={resolveHref('/news')}
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4f4b43] underline underline-offset-4 hover:text-[#171614]"
            >
              {tp('See everything')}
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Featured Item */}
            {featuredNews && (
              <div className="lg:col-span-6 space-y-4">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-[4px] bg-[#E6DFD2]">
                  {featuredNews.imageUrl ? (
                    <img
                      src={featuredNews.imageUrl}
                      alt={featuredNews.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full flex items-center justify-center text-xs uppercase tracking-[0.18em] text-[#787266]"
                      style={{ backgroundColor: `color-mix(in srgb, ${primary} 8%, #E6DFD2)` }}
                    >
                      {featuredNews.title}
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: accentTint }}>
                  {featuredNews.category} · {featuredNews.date}
                </p>
                <h3 className="tenant-editorial-display text-[24px] leading-[1.2] text-[#171614]">
                  {featuredNews.title}
                </h3>
                {featuredNews.summary && (
                  <p className="text-[14px] leading-[1.6] text-[#5c5850]">{featuredNews.summary}</p>
                )}
              </div>
            )}

            {/* Right Stacked List */}
            <div className="lg:col-span-6 divide-y divide-[#E5DEC9] border-t border-[#E5DEC9]">
              {secondaryNews.map((item, idx) => {
                const dateParts = item.date.trim().split(/\s+/);
                const isDayMonth = dateParts.length === 2 && /^\d{1,2}$/.test(dateParts[0]);
                return (
                  <div key={idx} className="py-5 flex items-start gap-6">
                    <div className="w-16 shrink-0">
                      {isDayMonth ? (
                        <div>
                          <p className="tenant-editorial-display text-[24px] leading-none" style={{ color: primary }}>
                            {dateParts[0]}
                          </p>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#787266] mt-1">
                            {dateParts[1]}
                          </p>
                        </div>
                      ) : (
                        <p className="tenant-editorial-display text-[20px] leading-tight" style={{ color: primary }}>
                          {item.date}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: accentTint }}>
                        {item.category}
                      </p>
                      <h3 className="text-[15px] font-semibold text-[#171614]">{item.title}</h3>
                      {item.summary && (
                        <p className="text-[13px] leading-[1.55] text-[#666158]">{item.summary}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 7: Life at School — Blueprint 3 Staggered 5/3/4 Editorial Spread */}
      <section className="w-full pb-20 sm:pb-24">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4 pb-8">
            <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.05] text-[#171614]">
              {tp('Life at school')}
            </h2>
            <Link
              href={resolveHref('/gallery')}
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4f4b43] underline underline-offset-4 hover:text-[#171614]"
            >
              {tp('All albums')}
            </Link>
          </div>

          {(() => {
            const fallbackEditorial = [
              { id: 'he-fb-1', imageUrl: '', caption: 'Album: Graduation' },
              { id: 'he-fb-2', imageUrl: '', caption: 'Album: Science Fair' },
              { id: 'he-fb-3', imageUrl: '', caption: 'Album: Choir & Arts' },
            ];
            const items = [0, 1, 2].map((i) => featuredPhotos[i] || fallbackEditorial[i]);
            const colClasses = ['sm:col-span-5', 'sm:col-span-3', 'sm:col-span-4'];
            const aspectClasses = ['aspect-[4/3.1]', 'aspect-[4/3.0]', 'aspect-[4/3.45]'];

            return (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-end">
                {items.map((photo, idx) => (
                  <Link key={photo.id} href={resolveHref('/gallery')} className={`${colClasses[idx]} block group`}>
                    <figure className="space-y-2">
                      <div className={`${aspectClasses[idx]} w-full overflow-hidden rounded-[3px] bg-[#E6DFD2]`}>
                        {photo.imageUrl ? (
                          <img
                            src={photo.imageUrl}
                            alt={photo.caption || `${tenant.name} campus`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div
                            className="h-full w-full flex items-center justify-center text-xs text-[#6d685c] p-4 text-center"
                            style={{ backgroundColor: `color-mix(in srgb, ${primary} 7%, #E6DFD2)` }}
                          >
                            {photo.caption || 'School Album'}
                          </div>
                        )}
                      </div>
                      {photo.imageUrl && photo.caption && (
                        <figcaption className="text-[12px] text-[#6d685c]">{photo.caption}</figcaption>
                      )}
                    </figure>
                  </Link>
                ))}
              </div>
            );
          })()}
        </div>
      </section>
    </div>
  );
}
