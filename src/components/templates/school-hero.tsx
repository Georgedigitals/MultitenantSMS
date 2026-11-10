'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HeroSlide, PublicSiteData } from '@/lib/site-content';

type SchoolTemplate = 'heritage' | 'vanguard' | 'horizon';

export function SchoolHero({ data, variant }: { data: PublicSiteData; variant: SchoolTemplate }) {
  const { hero, tenant, branding, gallery } = data;
  const slides = useMemo(() => {
    const configured = hero.sliderSlides.filter((slide) => slide.title?.trim());
    const source: HeroSlide[] = configured.length ? configured : [{
      title: hero.title || `Welcome to ${tenant.name}`,
      subtitle: hero.subtitle,
      imageUrl: hero.imageUrl || null,
      ctaText: 'Explore admissions',
      ctaLink: '/admissions',
    }];
    const galleryImages = gallery.map((image) => image.imageUrl).filter(Boolean);
    const mapped = source.map((slide, index) => ({
      ...slide,
      imageUrl: slide.imageUrl || galleryImages[index] || hero.imageUrl || galleryImages[0] || null,
      ctaText: slide.ctaText || 'Explore admissions',
      ctaLink: slide.ctaLink || '/admissions',
    }));
    const seenImages = new Set<string>();
    const distinctPhotos = mapped.filter((slide) => {
      if (!slide.imageUrl || seenImages.has(slide.imageUrl)) return false;
      seenImages.add(slide.imageUrl);
      return true;
    });
    return distinctPhotos.length ? distinctPhotos : mapped.slice(0, 1);
  }, [gallery, hero]);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const move = useCallback((direction: number) => {
    setActive((index) => (index + direction + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => move(1), 7000);
    return () => window.clearInterval(timer);
  }, [move, paused, slides.length]);

  const slide = slides[active] || slides[0];
  const image = slide?.imageUrl;
  const schoolName = tenant.name;
  const primary = branding.primaryColor;
  const accent = branding.accentColor;

  const getCleanHeadline = (rawTitle?: string) => {
    if (!rawTitle) return `Welcome to ${schoolName}`;
    const trimmed = rawTitle.trim();
    if (trimmed.toLowerCase() === tenant.slug.toLowerCase()) {
      return `Welcome to ${schoolName}`;
    }
    return trimmed;
  };

  if (variant === 'vanguard') {
    return (
      <section className="relative overflow-hidden bg-[#10283c] text-white" style={{ '--school-accent': accent } as CSSProperties}>
        <div className="absolute inset-y-0 left-[38%] hidden w-5 bg-[#15344b] lg:block" aria-hidden="true" />
        <div className="mx-auto grid min-h-[620px] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-16 lg:py-20">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-white/65">
              <span className="h-1 w-9" style={{ backgroundColor: accent }} /> {schoolName}
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-5xl lg:text-6xl break-words whitespace-pre-line" style={{ fontFamily: 'var(--brand-font-heading, Georgia, serif)' }}>
              {getCleanHeadline(slide?.title)}
            </h1>
            <div className="mt-5 h-1 w-16 rounded-full" style={{ backgroundColor: accent }} />
            {hero.motto && <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>{hero.motto}</p>}
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">{slide?.subtitle || hero.subtitle}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={slide?.ctaLink || '/admissions'} className="inline-flex min-h-12 items-center gap-3 px-5 text-sm font-bold text-[#10283c] transition hover:brightness-110" style={{ backgroundColor: accent }}>
                {slide?.ctaText || 'Explore admissions'} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/academics" className="inline-flex min-h-12 items-center gap-2 border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10">
                Our academics <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {slides.length > 1 && (
              <div className="mt-12 flex items-center gap-5" aria-label="Campus photographs">
                <div className="flex gap-2">
                  {slides.map((item, index) => (
                    <button key={`${item.title}-${index}`} type="button" onClick={() => setActive(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === active} className={`h-1.5 transition-[width] ${index === active ? 'w-10 bg-white' : 'w-4 bg-white/35 hover:bg-white/70'}`} />
                  ))}
                </div>
                <span className="text-xs tabular-nums text-white/55">{active + 1} / {slides.length}</span>
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => move(-1)} aria-label="Previous campus photo" className="grid h-10 w-10 place-items-center bg-white/10 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ChevronLeft className="h-5 w-5" /></button>
                  <button type="button" onClick={() => move(1)} aria-label="Next campus photo" className="grid h-10 w-10 bg-white/10 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ChevronRight className="h-5 w-5" /></button>
                </div>
              </div>
            )}
          </div>
          <div className="relative min-w-0" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
            <div className="relative aspect-[4/3] overflow-hidden bg-[#1d4058] lg:aspect-[1.08/1]">
              {image ? <img key={image} src={image} alt={`${schoolName}: ${slide?.title}`} className="h-full w-full object-cover transition duration-700" /> : <PhotoPlaceholder schoolName={schoolName} accent={accent} />}
              <div className="absolute inset-0 bg-[#10283c]/35" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-white sm:bottom-7 sm:left-7 sm:right-7">
                <div><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">A day at</span><p className="mt-1 text-lg font-semibold sm:text-xl">{schoolName}</p></div>
                <BookOpen className="mb-1 h-5 w-5 shrink-0" style={{ color: accent }} aria-hidden="true" />
              </div>
            </div>
            <span className="absolute -bottom-3 -left-3 -z-0 h-4 w-24" style={{ backgroundColor: accent }} aria-hidden="true" />
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'horizon') {
    return (
      <section className="overflow-hidden bg-[#f5f1e8] text-[#23352c]" style={{ '--school-accent': accent } as CSSProperties}>
        <div className="mx-auto grid min-h-[610px] max-w-[1360px] items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:px-14 lg:py-16">
          <div className="order-2 lg:order-1">
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.19em]" style={{ color: primary }}>{schoolName} <span className="mx-2 text-[#c8bba8]">/</span> Learning together</p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-5xl lg:text-[3.65rem] break-words whitespace-pre-line" style={{ fontFamily: 'var(--brand-font-heading, Georgia, serif)' }}>{getCleanHeadline(slide?.title)}</h1>
            <div className="mt-5 h-1 w-16 rounded-full" style={{ backgroundColor: primary }} />
            <p className="mt-6 max-w-xl text-base leading-7 text-[#59675f] sm:text-lg sm:leading-8">{slide?.subtitle || hero.subtitle}</p>
            {hero.motto && <p className="mt-5 text-sm italic text-[#68756a]">“{hero.motto}”</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={slide?.ctaLink || '/admissions'} className="inline-flex min-h-12 items-center gap-3 rounded-full px-6 text-sm font-bold text-white transition hover:brightness-110" style={{ backgroundColor: primary }}>{slide?.ctaText || 'Explore admissions'} <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/contact" className="inline-flex min-h-12 items-center rounded-full border border-[#b7c0b5] px-6 text-sm font-semibold text-[#34453a] transition hover:bg-white/70">Talk to our school</Link>
            </div>
            {slides.length > 1 && <div className="mt-9 flex items-center gap-3">
              {slides.map((item, index) => <button key={`${item.title}-${index}`} type="button" onClick={() => setActive(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === active} className={`h-[58px] w-[82px] overflow-hidden rounded-xl border-2 transition ${index === active ? 'border-[#304b3c]' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center bg-[#d9e0d7] text-xs">{index + 1}</span>}
              </button>)}
              <span className="ml-1 text-xs text-[#6d776f]">Scenes from our school</span>
            </div>}
          </div>
          <div className="order-1 lg:order-2" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
            <div className="relative mx-auto max-w-[680px]">
              <div className="absolute -right-3 -top-3 h-24 w-24 rounded-full bg-[#e6d4bc] sm:-right-5 sm:-top-5 sm:h-32 sm:w-32" aria-hidden="true" />
              <div className="relative aspect-[4/3] overflow-hidden rounded-[38%_38%_18px_18px] bg-[#e0e4dc]">
                {image ? <img key={image} src={image} alt={`${schoolName}: ${slide?.title}`} className="h-full w-full object-cover transition duration-700" /> : <PhotoPlaceholder schoolName={schoolName} accent={accent} />}
                <div className="absolute inset-x-0 bottom-0 bg-[#15271e]/75 px-6 pb-6 pt-20 text-white sm:px-8 sm:pb-8">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Come and see</p><p className="mt-1 text-lg font-semibold sm:text-xl">{schoolName}, through the school day</p>
                </div>
              </div>
              {slides.length > 1 && <div className="absolute bottom-5 right-5 flex gap-2 sm:bottom-7 sm:right-7">
                <button type="button" onClick={() => move(-1)} aria-label="Previous campus photo" className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#24392d]"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => move(1)} aria-label="Next campus photo" className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#24392d]"><ChevronRight className="h-5 w-5" /></button>
              </div>}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden bg-[#f8f6ef] text-[#202c35]" style={{ '--school-accent': accent } as CSSProperties}>
      <div className="mx-auto grid min-h-[620px] max-w-[1400px] items-center gap-11 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-14 lg:py-16">
        <div className="relative z-10">
            <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#75694e]"><span className="h-1 w-8 bg-[#a58a4a]" /> {schoolName}</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.12] tracking-[-0.035em] text-[#132e44] sm:text-5xl lg:text-[3.8rem] break-words whitespace-pre-line" style={{ fontFamily: 'var(--brand-font-heading, Georgia, serif)' }}>{getCleanHeadline(slide?.title)}</h1>
          <div className="mt-5 h-1 w-16 rounded-full bg-[#a58a4a]" />
          <p className="mt-6 max-w-xl text-base leading-7 text-[#59636a] sm:text-lg sm:leading-8">{slide?.subtitle || hero.subtitle}</p>
          {hero.motto && <p className="mt-5 border-l-2 border-[#a58a4a] pl-4 text-sm font-medium italic text-[#6f674f]">{hero.motto}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={slide?.ctaLink || '/admissions'} className="inline-flex min-h-12 items-center gap-3 px-6 text-sm font-bold text-white transition hover:brightness-110" style={{ backgroundColor: primary }}>{slide?.ctaText || 'Explore admissions'} <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/academics" className="inline-flex min-h-12 items-center px-5 text-sm font-semibold text-[#263d50] underline decoration-[#b8a36f] decoration-1 underline-offset-4 hover:text-[#10283c]">View our academics</Link>
          </div>
          <p className="mt-10 text-xs font-medium tracking-wide text-[#7b7d76]">A school community for learners and families</p>
        </div>
        <div className="relative min-w-0" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
          <div className="absolute -left-5 top-8 hidden h-[76%] w-7 bg-[#e6dfcd] lg:block" aria-hidden="true" />
          <div className="relative aspect-[4/3] overflow-hidden bg-[#d7dcd9]">
            {image ? <img key={image} src={image} alt={`${schoolName}: ${slide?.title}`} className="h-full w-full object-cover transition duration-700" /> : <PhotoPlaceholder schoolName={schoolName} accent={accent} />}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-[#10283c]/80 px-5 py-5 text-white sm:px-7 sm:py-7">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">From our school</p><p className="mt-1 text-lg font-semibold">{slide?.title}</p></div>
              {slides.length > 1 && <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => move(-1)} aria-label="Previous campus photo" className="grid h-10 w-10 place-items-center border border-white/60 bg-[#10283c]/40 transition hover:bg-[#10283c]/80"><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(1)} aria-label="Next campus photo" className="grid h-10 w-10 place-items-center border border-white/60 bg-[#10283c]/40 transition hover:bg-[#10283c]/80"><ArrowRight className="h-4 w-4" /></button>
              </div>}
            </div>
          </div>
          {slides.length > 1 && <div className="mt-4 flex items-center gap-2">
            {slides.map((item, index) => <button key={`${item.title}-${index}`} type="button" onClick={() => setActive(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === active} className={`h-1 transition-[width] ${index === active ? 'w-12 bg-[#a58a4a]' : 'w-6 bg-[#b9b9b0] hover:bg-[#7f817a]'}`} />)}
            <span className="ml-2 text-[11px] text-[#747a7c]">Use arrows to view the campus</span>
          </div>}
        </div>
      </div>
    </section>
  );
}

function PhotoPlaceholder({ schoolName, accent }: { schoolName: string; accent: string }) {
  return <div className="grid h-full w-full place-items-center bg-[#e0e6e3] p-8 text-center text-[#183a4c]">
    <div><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-[#8b9b92] bg-white/60"><BookOpen className="h-7 w-7" style={{ color: accent }} aria-hidden="true" /></div>
      <p className="font-serif text-2xl font-semibold">{schoolName}</p><p className="mt-2 max-w-xs text-sm text-[#53645b]">Add school and student photos to bring this space to life.</p></div>
  </div>;
}
