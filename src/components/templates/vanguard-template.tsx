'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, BookOpen, Compass, GraduationCap, Sparkles } from 'lucide-react';
import { FeaturedStudent } from './featured-student';
import type { PublicSiteData } from '@/lib/site-content';
import { useLanguage } from '@/components/language-provider';

interface TemplateProps {
  data: PublicSiteData;
}

export function VanguardTemplate({ data }: TemplateProps) {
  const { tenant, branding, hero, about, highlights, academics, admissions, newsEvents, gallery } = data;
  const { tp } = useLanguage();
  const pathname = usePathname() || '';
  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    return path;
  };

  const primary = branding.primaryColor || '#B83A28';
  const accent = branding.accentColor || '#F4C95D';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const textOnAccent = branding.textOnAccent || '#171614';

  const waveBg = `color-mix(in srgb, ${primary} 9%, #FBF8F1)`;
  const deepBandBg = `color-mix(in srgb, ${primary} 78%, #1e120d)`;

  // 4 distinct harmonious tints so cards never blend into one flat shade
  const cardTints = [
    `color-mix(in srgb, ${accent} 24%, #FFFDF8)`,
    `color-mix(in srgb, ${primary} 12%, #FFFDF8)`,
    '#FFFFFF',
    '#F3EDE0',
  ];

  const academicLevels =
    academics.levels && academics.levels.length > 0
      ? academics.levels.slice(0, 3)
      : [
          { name: 'Early Years & Nursery', ages: 'Ages 2–5', description: 'Play-led days that build confidence, language, and friendship.', imageUrl: null },
          { name: 'Primary School', ages: 'Ages 6–11', description: 'Strong foundations in reading, numbers, science, and joyful curiosity.', imageUrl: null },
          { name: 'Secondary School', ages: 'Ages 11–17', description: 'Subject depth, mentorship, and preparation for what comes next.', imageUrl: null },
        ];

  const stageIcons = [Sparkles, BookOpen, GraduationCap, Compass];

  const pillars =
    highlights?.items && highlights.items.length > 0
      ? highlights.items.slice(0, 4)
      : [
          {
            title: 'Small classes',
            body: 'Teachers who notice the quiet child as much as the loud one.',
          },
          {
            title: 'Outdoors daily',
            body: 'Movement, play, and open sky are part of the timetable, not a treat.',
          },
          {
            title: 'Stories first',
            body: 'Language, curiosity, and structured reading built every single day.',
          },
          {
            title: 'An open door',
            body: 'Parents are welcome to talk to us at drop-off or anytime they need.',
          },
        ];

  const titleWords = (hero.title || `Welcome to ${tenant.name}`).trim().split(/\s+/);
  const lastWord = titleWords.length > 1 ? titleWords.pop() : '';
  const leadHeading = titleWords.join(' ');

  // Homepage About section uses general campus/school photo (Principal portrait lives on /[slug]/about)
  const campusStoryPhoto = about.campusPhotoUrl || gallery[0]?.imageUrl || hero.imageUrl || null;
  const featuredPhotos = gallery.slice(0, 4);

  return (
    <div className="tenant-editorial bg-[#FBF8F1] text-[#1D1B17]">
      {/* Chapter 1: Warm Boutique Hero with Clean Circular Photo Mask */}
      <section className="w-full pt-8 pb-12 sm:pt-12 sm:pb-16">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Copy */}
          <div className="lg:col-span-6 space-y-5">
            <span
              className="inline-flex items-center rounded-full px-3.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
              style={{
                backgroundColor: `color-mix(in srgb, ${primary} 12%, #FFFFFF)`,
                color: primary,
              }}
            >
              {hero.motto || 'Welcoming Every Learner'}
            </span>

            <h1 className="tenant-editorial-display text-[40px] sm:text-[54px] leading-[1.08] tracking-[-0.02em] text-[#1D1B17]">
              {leadHeading}{' '}
              {lastWord && (
                <span className="relative inline-block pb-1">
                  <span>{lastWord}</span>
                  <svg
                    viewBox="0 0 120 12"
                    className="w-full h-2.5 absolute left-0 -bottom-0.5 block"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 8 Q 30 2, 60 7 T 118 6"
                      fill="none"
                      stroke={primary}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              )}
            </h1>

            <p className="text-[16px] leading-[1.7] text-[#3f3c36] max-w-[48ch]">
              {hero.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={resolveHref('/admissions')}
                className="h-11 px-6 rounded-full text-[13px] font-semibold inline-flex items-center transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary, color: textOnPrimary }}
              >
                {tp('Book a visit')}
              </Link>
              <Link
                href={resolveHref('/admissions')}
                className="h-11 px-6 rounded-full border border-[#1D1B17]/30 text-[13px] font-semibold text-[#1D1B17] inline-flex items-center hover:bg-black/5 transition-colors"
              >
                {tp('Admissions info')}
              </Link>
            </div>
          </div>

          {/* Right: Clean Full-Circle Photo Inside Offset Soft Halo (No Rectangle Overflow) */}
          <div className="lg:col-span-6 relative flex justify-center">
            <div className="relative w-full max-w-[360px] aspect-square flex items-center justify-center">
              {/* Blueprint 4-Point Star Accent */}
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 absolute -top-2 right-4 pointer-events-none"
                style={{ fill: primary }}
                aria-hidden="true"
              >
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
              </svg>
              {/* Small Plus Accent */}
              <span
                className="absolute top-12 -left-2 text-lg font-bold leading-none select-none pointer-events-none opacity-65"
                style={{ color: primary }}
                aria-hidden="true"
              >
                +
              </span>
              {/* Soft Decorative Offset Blob Halo */}
              <div
                className="absolute inset-0 translate-x-3 -translate-y-2"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 34%, #FBF8F1)`,
                  borderRadius: '54% 46% 48% 52% / 44% 55% 45% 56%',
                }}
                aria-hidden="true"
              />
              {/* Subtle Secondary Offset Ring */}
              <div
                className="absolute inset-3 -translate-x-2 translate-y-2 rounded-full border border-dashed pointer-events-none"
                style={{ borderColor: `color-mix(in srgb, ${primary} 30%, transparent)` }}
                aria-hidden="true"
              />
              {/* True Circular Photo Mask — completely hides rectangular image edges */}
              <div
                className="relative z-10 w-[86%] h-[86%] rounded-full overflow-hidden shadow-md ring-4 ring-[#FBF8F1]"
                style={{ backgroundColor: `color-mix(in srgb, ${primary} 12%, #FFFFFF)` }}
              >
                {hero.imageUrl ? (
                  <img
                    src={hero.imageUrl}
                    alt={tenant.name}
                    className="h-full w-full object-cover object-center"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
                    {branding.logoUrl ? (
                      <img src={branding.logoUrl} alt={tenant.name} className="h-24 w-24 object-contain" />
                    ) : (
                      <span className="tenant-editorial-display text-6xl" style={{ color: primary }}>
                        {tenant.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <p className="mt-3 text-xs font-medium text-[#5e5a50]">{tenant.name}</p>
                  </div>
                )}
              </div>
              {/* Floating Circle Badge with Cream Ring */}
              <div
                className="absolute bottom-3 left-3 sm:left-5 z-20 h-20 w-20 rounded-full flex flex-col items-center justify-center text-center shadow-md -rotate-6 ring-4 ring-[#FBF8F1]"
                style={{ backgroundColor: primary, color: textOnPrimary }}
              >
                <span className="text-[11px] font-bold leading-tight px-2">{tp('Now enrolling')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 2: Wavy Soft-Tinted Value Strip */}
      <section className="w-full relative">
        {/* Top Organic Wave */}
        <svg viewBox="0 0 1440 44" className="w-full h-7 sm:h-11 block" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,26 C320,52 680,0 1080,24 C1260,34 1360,30 1440,22 L1440,44 L0,44 Z" style={{ fill: waveBg }} />
        </svg>

        <div className="w-full py-10 sm:py-14" style={{ backgroundColor: waveBg }}>
          <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pillars.map((pillar, idx) => (
              <div
                key={pillar.title}
                className={`rounded-[24px] rounded-tl-[8px] p-6 space-y-2 border border-black/[0.04] shadow-xs ${
                  idx % 2 === 1 ? 'lg:translate-y-3' : ''
                }`}
                style={{ backgroundColor: cardTints[idx % cardTints.length] }}
              >
                <h3 className="text-[16px] font-bold text-[#1D1B17]">{tp(pillar.title)}</h3>
                <p className="text-[13px] leading-[1.6] text-[#4c4840]">{tp(pillar.body)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Organic Wave */}
        <svg viewBox="0 0 1440 44" className="w-full h-7 sm:h-11 block" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,0 L1440,0 L1440,18 C1140,46 760,2 380,28 C180,40 80,32 0,20 Z" style={{ fill: waveBg }} />
        </svg>
      </section>

      {/* Optional Chapter: Featured Scholar */}
      <FeaturedStudent data={data} />

      {/* Chapter 3: About Our School (Campus Story — Principal Portrait Lives on /about) */}
      <section className="w-full py-16 sm:py-24">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5 flex justify-center">
            <div
              className="w-full max-w-[340px] aspect-square overflow-hidden shadow-xs"
              style={{
                borderRadius: '44% 56% 52% 48% / 48% 42% 58% 52%',
                backgroundColor: `color-mix(in srgb, ${primary} 12%, #FBF8F1)`,
              }}
            >
              {campusStoryPhoto ? (
                <img src={campusStoryPhoto} alt={tenant.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={tenant.name} className="h-20 w-20 object-contain opacity-90" />
                  ) : (
                    <span className="tenant-editorial-display text-6xl opacity-35" style={{ color: primary }}>
                      {tenant.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: primary }}>
                    {tenant.name}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: primary }}>
              {tp('About us')}
            </p>
            <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.12] text-[#1D1B17]">
              {tp('A school that feels like an extension of home')}
            </h2>
            <p className="text-[15px] leading-[1.7] text-[#4c4840]">
              {about.text}
            </p>
            {about.mission && (
              <p className="text-[14.5px] leading-[1.7] text-[#5e5a50] border-l-2 pl-4" style={{ borderColor: accent }}>
                {about.mission}
              </p>
            )}
            <div className="pt-1">
              <Link
                href={resolveHref('/about')}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold underline underline-offset-4 hover:opacity-75"
                style={{ color: primary }}
              >
                <span>{tp('Meet our Head of School & read our story')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 4: Our Classes (Crisp White Section with Dedicated Stage Photos or Designed Placeholders) */}
      <section className="w-full bg-white py-16 sm:py-24 border-y border-[#EFEADB]">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4 pb-10">
            <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.08] text-[#1D1B17]">
              {tp('Our classes')}
            </h2>
            <Link
              href={resolveHref('/academics')}
              className="text-[12px] font-semibold underline underline-offset-4 hover:opacity-75"
              style={{ color: primary }}
            >
              {tp('All programs')}
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {academicLevels.map((level, idx) => {
              const Icon = stageIcons[idx % stageIcons.length];
              const stageBg =
                idx === 0
                  ? `color-mix(in srgb, ${accent} 24%, #FAF6EC)`
                  : idx === 1
                    ? `color-mix(in srgb, ${primary} 13%, #FBF8F1)`
                    : `color-mix(in srgb, ${primary} 8%, color-mix(in srgb, ${accent} 16%, #FAF6EC))`;
              return (
                <div
                  key={idx}
                  className={`rounded-[26px] p-5 bg-[#FBF8F1] border border-[#EFEADB] space-y-4 ${
                    idx === 1 ? 'md:translate-y-4' : ''
                  }`}
                >
                  <div
                    className="aspect-[16/10] w-full rounded-[20px] rounded-tr-[6px] overflow-hidden relative flex items-center justify-center"
                    style={{ backgroundColor: stageBg }}
                  >
                    {level.imageUrl ? (
                      <img src={level.imageUrl} alt={level.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2.5 p-5 text-center">
                        <div
                          className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: '#FFFFFF', color: primary }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <span
                          className="text-[11px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: primary }}
                        >
                          Stage {String(idx + 1).padStart(2, '0')} · {level.ages}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 px-1">
                    <h3 className="tenant-editorial-display text-[22px] text-[#1D1B17]">{tp(level.name)}</h3>
                    <p className="text-[13.5px] leading-[1.6] text-[#4c4840]">
                      <span className="font-semibold text-[#1D1B17]">({level.ages})</span> {level.description}
                    </p>
                    <div className="pt-1">
                      <Link
                        href={resolveHref('/academics')}
                        className="text-[12px] font-semibold underline underline-offset-4 hover:opacity-75"
                        style={{ color: primary }}
                      >
                        {tp('See the class')}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Chapter 5: Deep Warm Logo-Tinted Admissions Band */}
      <section className="w-full py-16 sm:py-24 text-white" style={{ backgroundColor: deepBandBg }}>
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 space-y-10">
          <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.12] text-white max-w-lg">
            {tp('Joining us takes three simple steps')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {admissions.process.slice(0, 3).map((step) => (
              <div key={step.step} className="flex items-start gap-4">
                <span className="h-8 w-8 rounded-full border border-white/40 text-[13px] font-semibold flex items-center justify-center shrink-0">
                  {step.step}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-white">{tp(step.title)}</h3>
                  <p className="mt-1 text-[13px] leading-[1.6] text-white/80">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Link
              href={resolveHref('/admissions')}
              className="h-11 px-6 rounded-full text-[13px] font-semibold inline-flex items-center transition-opacity hover:opacity-90 shadow-xs"
              style={{ backgroundColor: accent, color: textOnAccent }}
            >
              {tp('Start your application')}
            </Link>
          </div>
        </div>
      </section>

      {/* Chapter 6: News & Events (Crisp Date Pills) */}
      <section id="news" className="w-full py-16 sm:py-22">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4 pb-8">
            <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.08] text-[#1D1B17]">
              {tp('News & events')}
            </h2>
            <Link
              href={resolveHref('/news')}
              className="text-[12px] font-semibold underline underline-offset-4 hover:opacity-75"
              style={{ color: primary }}
            >
              {tp('See everything')}
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {newsEvents.slice(0, 3).map((item, idx) => {
              const dateParts = item.date.trim().split(/\s+/);
              const isDayMonth = dateParts.length === 2 && /^\d{1,2}$/.test(dateParts[0]);
              return (
                <div
                  key={idx}
                  className="rounded-[22px] bg-white p-5 border border-[#EFEADB] flex items-start gap-4 shadow-xs"
                >
                  <div
                    className="min-w-[58px] min-h-[54px] rounded-2xl flex flex-col items-center justify-center text-center shrink-0 px-2.5 py-2 leading-tight"
                    style={{ backgroundColor: cardTints[idx % 2], color: primary }}
                  >
                    {isDayMonth ? (
                      <>
                        <span className="text-[16px] font-bold leading-none">{dateParts[0]}</span>
                        <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] mt-0.5 opacity-80">
                          {dateParts[1]}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10.5px] font-bold leading-tight">{item.date}</span>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#78746b]">
                      {item.category}
                    </p>
                    <h3 className="text-[15px] font-bold text-[#1D1B17] leading-snug">{item.title}</h3>
                    {item.summary && (
                      <p className="text-[12.5px] leading-[1.55] text-[#5e5a50]">{item.summary}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Chapter 7: Life at School — Blueprint 1 Organic 4-Tile Row (Circle / Rounded-Rect / Circle / Organic-Square) */}
      <section className="w-full pb-20 sm:pb-24">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4 pb-8">
            <h2 className="tenant-editorial-display text-[32px] sm:text-[42px] leading-[1.08] text-[#1D1B17]">
              {tp('Life at school')}
            </h2>
            <Link
              href={resolveHref('/gallery')}
              className="text-[12px] font-semibold underline underline-offset-4 hover:opacity-75"
              style={{ color: primary }}
            >
              {tp('All albums')}
            </Link>
          </div>

          {(() => {
            const fallbackAlbums = [
              { id: 'v-fb-1', imageUrl: '', caption: 'Sports Day' },
              { id: 'v-fb-2', imageUrl: '', caption: 'Art Week' },
              { id: 'v-fb-3', imageUrl: '', caption: 'Campus Life' },
              { id: 'v-fb-4', imageUrl: '', caption: 'Graduation' },
            ];
            const tiles = [0, 1, 2, 3].map((i) => featuredPhotos[i] || fallbackAlbums[i]);
            const tileShapes = [
              'aspect-square rounded-full',
              'aspect-[4/3.3] rounded-[28px]',
              'aspect-square rounded-full',
              'aspect-[4/3.4] rounded-[28px] rounded-tr-[10px]',
            ];
            const tileTints = [
              `color-mix(in srgb, ${accent} 34%, #FFFBF0)`,
              `color-mix(in srgb, ${primary} 14%, #FBF8F1)`,
              '#F4E6E4',
              `color-mix(in srgb, ${primary} 10%, #EEF5FA)`,
            ];

            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 items-center">
                {tiles.map((photo, idx) => (
                  <Link
                    key={photo.id}
                    href={resolveHref('/gallery')}
                    className="group block focus:outline-none"
                  >
                    <figure className="space-y-2.5 text-center">
                      <div
                        className={`w-full overflow-hidden transition-transform duration-300 group-hover:scale-[1.02] ${tileShapes[idx]}`}
                        style={{ backgroundColor: tileTints[idx] }}
                      >
                        {photo.imageUrl ? (
                          <img
                            src={photo.imageUrl}
                            alt={photo.caption || tenant.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center p-5 text-center">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5e5a50]">
                              Album
                            </span>
                            <span className="mt-1 text-[13px] font-semibold text-[#2d2b26]">
                              {photo.caption}
                            </span>
                          </div>
                        )}
                      </div>
                      {photo.imageUrl && photo.caption && (
                        <figcaption className="text-[12.5px] font-medium text-[#5e5a50]">
                          {photo.caption}
                        </figcaption>
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
