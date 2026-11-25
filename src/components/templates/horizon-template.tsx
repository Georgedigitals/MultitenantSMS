'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { FeaturedStudent } from './featured-student';
import { InlineCallbackForm } from './inline-callback-form';
import type { PublicSiteData } from '@/lib/site-content';
import { useLanguage } from '@/components/language-provider';

interface TemplateProps {
  data: PublicSiteData;
}

export function HorizonTemplate({ data }: TemplateProps) {
  const { tenant, branding, hero, about, stats, highlights, academics, admissions, newsEvents, parentQuote, gallery } = data;
  const { tp } = useLanguage();
  const pathname = usePathname() || '';
  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    return path;
  };

  const primary = branding.primaryColor || '#0F6B5D';
  const accent = branding.accentColor || '#F49D2A';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const textOnAccent = branding.textOnAccent || '#171614';

  const heroTint = `color-mix(in srgb, ${primary} 12%, #FAF9F5)`;
  const deepBandBg = `color-mix(in srgb, ${primary} 85%, #0a1f1c)`;
  const quoteBandBg = `color-mix(in srgb, ${accent} 22%, #FAF9F5)`;

  const academicLevels =
    academics.levels && academics.levels.length > 0
      ? academics.levels.slice(0, 4)
      : [
          { name: 'Nursery', ages: 'Ages 2–5', description: 'Play-led days for confidence and first friendships.' },
          { name: 'Primary', ages: 'Ages 6–11', description: 'Strong foundations in reading, numbers, and curiosity.' },
          { name: 'Junior Secondary', ages: 'Ages 11–14', description: 'Subject depth, independence, and good habits.' },
          { name: 'Senior Secondary', ages: 'Ages 14–17', description: 'Exam preparation and guidance on what comes next.' },
        ];

  const stageTints = [
    `color-mix(in srgb, ${primary} 11%, #FAF9F5)`,
    `color-mix(in srgb, ${accent} 22%, #FFFBF2)`,
    '#F5EEF2',
    `color-mix(in srgb, ${primary} 8%, #EFF6FC)`,
  ];

  const titleWords = (hero.title || `Welcome to ${tenant.name}`).trim().split(/\s+/);
  const highlightWord = titleWords.length > 1 ? titleWords.pop() : '';
  const leadTitle = titleWords.join(' ');

  const featuredPhotos = gallery.slice(0, 3);
  const aboutPhoto = about.campusPhotoUrl || gallery[0]?.imageUrl || hero.imageUrl || null;
  const bentoThumb = highlights.featureImageUrl || gallery[1]?.imageUrl || hero.imageUrl || null;
  const openDoorCard = highlights.items[0] || {
    title: 'An open door',
    body: 'Direct, regular communication between teachers and parents every week.',
  };
  const outdoorsCard = highlights.items[1] || {
    title: 'Outdoors, every day',
    body: 'Balanced academics, creative arts, sports, and practical discovery across every term.',
  };

  return (
    <div className="bg-[#FAF9F5] text-[#171614]">
      {/* Chapter 1: Soft Logo-Tinted Rounded Hero Card */}
      <section className="w-full pt-5 pb-10 sm:pt-7 sm:pb-14">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
          <div
            className="rounded-[28px] px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center overflow-hidden"
            style={{ backgroundColor: heroTint }}
          >
            {/* Left Copy */}
            <div className="lg:col-span-6 space-y-5">
              <span className="inline-flex items-center rounded-full bg-white/85 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#45433d] shadow-xs">
                {hero.motto || 'Admissions Open'}
              </span>

              <h1 className="text-[36px] sm:text-[48px] font-bold leading-[1.08] tracking-[-0.03em] text-[#171614]">
                {leadTitle}{' '}
                {highlightWord && (
                  <span
                    className="inline-block rounded-xl px-3 py-0.5 -rotate-1"
                    style={{ backgroundColor: accent, color: textOnAccent }}
                  >
                    {highlightWord}
                  </span>
                )}
              </h1>

              <p className="text-[15px] leading-[1.65] text-[#4c4a43] max-w-[46ch]">
                {hero.subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={resolveHref('/admissions')}
                  className="h-11 px-6 rounded-full text-[13px] font-semibold inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primary, color: textOnPrimary }}
                >
                  <span>{tp('Apply for admission')}</span>
                </Link>
                <Link
                  href={resolveHref('/contact')}
                  className="h-11 px-6 rounded-full bg-white text-[#171614] text-[13px] font-semibold inline-flex items-center hover:bg-white/80 transition-colors shadow-xs"
                >
                  {tp('Book a visit')}
                </Link>
              </div>

              {/* Compact 3-Metric Row */}
              <div className="pt-4 flex flex-wrap items-center gap-7 border-t border-black/10">
                <div>
                  <p className="text-[18px] font-bold" style={{ color: primary }}>{stats.foundedYear}</p>
                  <p className="text-[11px] text-[#5e5c54]">{tp('Founded')}</p>
                </div>
                <div>
                  <p className="text-[18px] font-bold" style={{ color: primary }}>{stats.teacherRatio}</p>
                  <p className="text-[11px] text-[#5e5c54]">{tp('Ratio')}</p>
                </div>
                <div>
                  <p className="text-[18px] font-bold" style={{ color: primary }}>{stats.passRate}</p>
                  <p className="text-[11px] text-[#5e5c54]">{tp('Success')}</p>
                </div>
              </div>
            </div>

            {/* Right Framed Photo Composition */}
            <div className="lg:col-span-6 relative flex justify-center">
              <div className="relative w-full max-w-[350px] aspect-square">
                {/* Circular Photo */}
                <div
                  className="relative z-10 h-full w-full rounded-full overflow-hidden shadow-md ring-4 ring-white/75"
                  style={{ backgroundColor: `color-mix(in srgb, ${primary} 55%, #ffffff)` }}
                >
                  {hero.imageUrl ? (
                    <img
                      src={hero.imageUrl}
                      alt={tenant.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center text-white">
                      {branding.logoUrl ? (
                        <img src={branding.logoUrl} alt={tenant.name} className="h-20 w-20 object-contain bg-white rounded-2xl p-2" />
                      ) : (
                        <span className="text-5xl font-bold">{tenant.name.charAt(0).toUpperCase()}</span>
                      )}
                      <p className="mt-3 text-xs font-medium opacity-90">{tenant.name}</p>
                    </div>
                  )}
                </div>
                {/* Accent Orb Sitting Above the Outer Rim (Lightly Kissing the Edge) */}
                <div
                  className="absolute -top-2 -right-3 z-20 h-20 w-20 sm:h-24 sm:w-24 rounded-full shadow-sm ring-4 pointer-events-none"
                  style={{
                    backgroundColor: accent,
                    ['--tw-ring-color' as any]: heroTint,
                  }}
                  aria-hidden="true"
                />
                {/* Floating Badge */}
                <div className="absolute bottom-2 -left-2 z-20 rounded-xl bg-white px-3.5 py-2 shadow-md flex items-center gap-2.5 border border-black/5">
                  <span
                    className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${accent} 30%, #ffffff)`, color: primary }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-[11px] font-semibold text-[#171614]">{tenant.name}</p>
                    <p className="text-[10px] text-[#6d6a62]">{tp('Now enrolling')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 2: Bento "Why Families Choose Us" Grid */}
      <section className="w-full pb-14 sm:pb-20">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Large Primary Bento */}
          <div
            className="lg:col-span-6 rounded-[24px] p-7 sm:p-9 flex flex-col justify-between min-h-[260px]"
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
              {tp('Why families choose us')}
            </p>
            <div className="space-y-3 pt-10">
              <h2 className="text-[30px] sm:text-[36px] font-bold leading-[1.1] tracking-[-0.02em]">
                {tp(highlights.headline || 'Small classes, big attention.')}
              </h2>
              <p className="text-[14px] leading-[1.6] opacity-85 max-w-[44ch]">
                {about.mission}
              </p>
            </div>
          </div>

          {/* Right 3-Card Bento Stack */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className="rounded-[24px] p-6 flex flex-col justify-between min-h-[135px]"
              style={{ backgroundColor: accent, color: textOnAccent }}
            >
              <p className="text-[32px] font-bold tracking-[-0.02em]">{stats.teacherRatio}</p>
              <p className="text-[12px] font-medium opacity-85">{tp('Pupil-to-teacher ratio')}</p>
            </div>

            <div className="rounded-[24px] bg-white p-6 border border-[#ece9e0] flex flex-col justify-between min-h-[135px]">
              <h3 className="text-[16px] font-bold text-[#171614]">{tp(openDoorCard.title)}</h3>
              <p className="text-[12.5px] leading-[1.55] text-[#5e5c54]">
                {tp(openDoorCard.body)}
              </p>
            </div>

            <div
              className="sm:col-span-2 rounded-[24px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
              style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, #FAF9F5)` }}
            >
              <div className="space-y-1.5">
                <h3 className="text-[17px] font-bold text-[#171614]">{tp(outdoorsCard.title)}</h3>
                <p className="text-[13px] leading-[1.55] text-[#545149] max-w-[36ch]">
                  {tp(outdoorsCard.body)}
                </p>
              </div>
              <Link
                href={resolveHref('/gallery')}
                className="shrink-0 w-full sm:w-40 h-24 rounded-2xl overflow-hidden flex items-center justify-center shadow-xs hover:opacity-90 transition-opacity"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 34%, #FAF9F5)` }}
              >
                {bentoThumb ? (
                  <img src={bentoThumb} alt="Campus outdoor life" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[11px] font-semibold text-[#545149] px-3 text-center">
                    {tp('Campus outdoors')}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Optional Chapter: Featured Scholar */}
      <FeaturedStudent data={data} />

      {/* Chapter 3: Rooted in Community (About Split) */}
      <section className="w-full py-12 sm:py-20">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-6 relative">
            <div className="aspect-[4/3] w-full rounded-[24px] overflow-hidden bg-[#E6DFD2]">
              {aboutPhoto ? (
                <img src={aboutPhoto} alt={tenant.name} className="h-full w-full object-cover" />
              ) : (
                <div
                  className="h-full w-full flex items-center justify-center p-8 text-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${primary} 10%, #E6DFD2)` }}
                >
                  <p className="text-sm font-medium text-[#5e5c54]">{tenant.name}</p>
                </div>
              )}
            </div>
            <div className="absolute -bottom-3 -left-2 rounded-xl bg-white px-4 py-2.5 shadow-md -rotate-2 border border-[#ece9e0]">
              <p className="text-[11px] text-[#6d6a62]">{tp('Founded in')}</p>
              <p className="text-[15px] font-bold" style={{ color: primary }}>{stats.foundedYear}</p>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: primary }}>
              {tp('About us')}
            </p>
            <h2 className="text-[30px] sm:text-[38px] font-bold leading-[1.12] tracking-[-0.02em] text-[#171614]">
              {tp('Growing with')}{' '}
              <span style={{ color: primary }}>{tp('every child')}</span>
            </h2>
            <p className="text-[14.5px] leading-[1.7] text-[#524f47]">
              {about.text}
            </p>
            <ul className="space-y-2.5 pt-1">
              {(about.coreValues.length > 0 ? about.coreValues.slice(0, 3) : ['Qualified, caring teachers', 'A safe, welcoming campus', 'Direct regular contact with parents']).map(
                (val) => (
                  <li key={val} className="flex items-center gap-2.5 text-[13.5px] font-medium text-[#2d2b26]">
                    <span
                      className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: accent, color: textOnAccent }}
                    >
                      <Check className="w-3 h-3" />
                    </span>
                    <span>{val}</span>
                  </li>
                )
              )}
            </ul>
            <div className="pt-2">
              <Link
                href={resolveHref('/about')}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold underline underline-offset-4 hover:opacity-75"
                style={{ color: primary }}
              >
                <span>{tp('Read our story')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 4: Find Your Child's Place (4 Pastel Stage Cards) */}
      <section className="w-full bg-white py-16 sm:py-22 border-y border-[#ece9e0]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 pb-8">
            <h2 className="text-[28px] sm:text-[36px] font-bold tracking-[-0.02em] text-[#171614]">
              {tp("Find your child's place")}
            </h2>
            <Link
              href={resolveHref('/academics')}
              className="text-[12px] font-semibold underline underline-offset-4 hover:opacity-75"
              style={{ color: primary }}
            >
              {tp('All programs')}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {academicLevels.map((level, idx) => (
              <div
                key={idx}
                className="rounded-[22px] p-6 flex flex-col justify-between gap-5"
                style={{ backgroundColor: stageTints[idx % stageTints.length] }}
              >
                <div className="space-y-3">
                  {/* Small Logo-Colored Duo Emblem */}
                  <div className="flex items-center gap-1">
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: primary }} />
                    <span className="h-3.5 w-3.5 rounded-md" style={{ backgroundColor: accent }} />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold text-[#171614]">{tp(level.name)}</h3>
                    <p className="text-[11.5px] font-medium text-[#66635a] mt-0.5">{level.ages}</p>
                  </div>
                  <p className="text-[13px] leading-[1.6] text-[#4c4a43]">{level.description}</p>
                </div>
                <Link
                  href={resolveHref('/academics')}
                  className="text-[12px] font-semibold underline underline-offset-4 hover:opacity-75"
                  style={{ color: primary }}
                >
                  {tp('Explore')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 5: Deep Logo-Tinted Admissions Band + Inline Callback Form */}
      <section className="w-full py-16 sm:py-24 text-white" style={{ backgroundColor: deepBandBg }}>
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
              {tp('Admissions')}
            </p>
            <h2 className="text-[32px] sm:text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-white">
              {tp('Three steps to a place with us')}
            </h2>

            <div className="space-y-5 pt-2">
              {admissions.process.slice(0, 3).map((step) => (
                <div key={step.step} className="flex items-start gap-4">
                  <span
                    className="h-7 w-7 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: accent, color: textOnAccent }}
                  >
                    {step.step}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{tp(step.title)}</h3>
                    <p className="text-[13px] leading-[1.55] text-white/75 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <InlineCallbackForm
              slug={tenant.slug}
              levels={academicLevels}
              primaryColor={primary}
              textOnPrimary={textOnPrimary}
            />
          </div>
        </div>
      </section>

      {/* Chapter 6: News & Events */}
      <section id="news" className="w-full py-16 sm:py-22">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 pb-8">
            <h2 className="text-[28px] sm:text-[36px] font-bold tracking-[-0.02em] text-[#171614]">
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
            {newsEvents.slice(0, 3).map((item, idx) => (
              <div key={idx} className="space-y-3">
                <div
                  className="aspect-[16/10] w-full rounded-[20px] overflow-hidden"
                  style={{ backgroundColor: stageTints[idx % stageTints.length] }}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs font-medium text-[#5e5c54] p-4 text-center">
                      {item.title}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]">
                  <span
                    className="rounded-full px-2.5 py-0.5"
                    style={{ backgroundColor: `color-mix(in srgb, ${primary} 12%, #ffffff)`, color: primary }}
                  >
                    {item.category}
                  </span>
                  <span className="text-[#78746b]">{item.date}</span>
                </div>
                <h3 className="text-[16px] font-bold text-[#171614] leading-snug">{item.title}</h3>
                {item.summary && <p className="text-[13px] leading-[1.55] text-[#5e5c54]">{item.summary}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 7: Polaroid Life at School — Blueprint 2 Trio */}
      <section className="w-full pb-16 sm:pb-24">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 pb-10">
            <h2 className="text-[28px] sm:text-[36px] font-bold tracking-[-0.02em] text-[#171614]">
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
            const fallbackPolaroids = [
              { id: 'h-fb-1', imageUrl: '', caption: 'Morning assembly' },
              { id: 'h-fb-2', imageUrl: '', caption: 'Discovery lab' },
              { id: 'h-fb-3', imageUrl: '', caption: 'Sports & arts' },
            ];
            const polaroids = [0, 1, 2].map((i) => featuredPhotos[i] || fallbackPolaroids[i]);
            const polaroidTints = ['#EAE2D3', '#DCEBF4', '#F3DDE2'];
            const tilts = ['-rotate-2', 'rotate-1 sm:translate-y-2', '-rotate-1'];

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-[880px] mx-auto">
                {polaroids.map((photo, idx) => (
                  <Link key={photo.id} href={resolveHref('/gallery')} className="block group">
                    <figure
                      className={`bg-white p-3 pb-6 rounded-[4px] shadow-md border border-[#ece9e0] transition-transform duration-300 group-hover:rotate-0 ${tilts[idx]}`}
                    >
                      <div
                        className="aspect-[4/3.6] w-full overflow-hidden rounded-[2px]"
                        style={{ backgroundColor: polaroidTints[idx] }}
                      >
                        {photo.imageUrl ? (
                          <img
                            src={photo.imageUrl}
                            alt={photo.caption || tenant.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-medium text-[#5e5a50] p-4 text-center">
                            {photo.caption}
                          </div>
                        )}
                      </div>
                      <figcaption className="mt-3.5 text-[13px] font-medium italic text-[#4c4a43]">
                        {photo.caption || tenant.name}
                      </figcaption>
                    </figure>
                  </Link>
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      {/* Chapter 8: Parent Quote Banner */}
      <section className="w-full py-16 sm:py-20" style={{ backgroundColor: quoteBandBg }}>
        <div className="max-w-[780px] mx-auto px-5 sm:px-8 text-center space-y-5">
          <span className="text-4xl font-serif leading-none block" style={{ color: primary }}>
            “
          </span>
          <blockquote className="text-[20px] sm:text-[26px] font-bold leading-[1.35] tracking-[-0.015em] text-[#171614]">
            “{parentQuote.quote}”
          </blockquote>
          <p className="text-[12.5px] font-medium text-[#545149]">
            <span className="font-semibold text-[#171614]">{parentQuote.author}</span> · {parentQuote.role}
          </p>
        </div>
      </section>
    </div>
  );
}
