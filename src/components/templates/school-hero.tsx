'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { HeroSlide, PublicSiteData } from '@/lib/site-content';

type SchoolTemplate = 'heritage' | 'vanguard' | 'horizon';

export function SchoolHero({ data, variant }: { data: PublicSiteData; variant: SchoolTemplate }) {
  const { hero, tenant, branding, gallery } = data;
  const pathname = usePathname() || '';
  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);

  const resolveHref = (path: string) => {
    if (!path.startsWith('/')) return path;
    if (isSlugPath && !path.startsWith(`/${tenant.slug}`)) {
      return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    }
    return path;
  };

  const slides = useMemo(() => {
    const configured = hero.sliderSlides.filter((slide) => slide.title?.trim());
    const source: HeroSlide[] = configured.length
      ? configured
      : [
          {
            title: hero.title || `Welcome to ${tenant.name}`,
            subtitle: hero.subtitle,
            imageUrl: hero.imageUrl || null,
            ctaText: 'Explore admissions',
            ctaLink: '/admissions',
          },
        ];
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
  }, [gallery, hero, tenant.name]);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const move = useCallback(
    (direction: number) => {
      setActive((index) => (index + direction + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => move(1), 7000);
    return () => window.clearInterval(timer);
  }, [move, paused, slides.length]);

  const slide = slides[active] || slides[0];
  const image = slide?.imageUrl;
  const schoolName = tenant.name;
  const primary = branding.primaryColor || '#141414';
  const accent = branding.accentColor || '#1d5fbf';

  const getCleanHeadline = (rawTitle?: string) => {
    if (!rawTitle) return `Welcome to ${schoolName}`;
    const trimmed = rawTitle.trim();
    if (trimmed.toLowerCase() === tenant.slug.toLowerCase()) {
      return `Welcome to ${schoolName}`;
    }
    return trimmed;
  };

  // Chapter palette per template — flat, high contrast, zero gradients
  const theme =
    variant === 'vanguard'
      ? {
          bg: '#111315',
          ink: '#ffffff',
          muted: '#c4c2bc',
          ctaBg: accent,
          ctaInk: '#111315',
          secondaryBorder: 'border-white/30 text-white hover:bg-white/10',
          frameBg: '#1c1f24',
          controlBg: 'bg-white/10 text-white hover:bg-white/20',
        }
      : variant === 'horizon'
      ? {
          bg: '#ebe8df',
          ink: '#152019',
          muted: '#4d5950',
          ctaBg: primary,
          ctaInk: branding.textOnPrimary || '#ffffff',
          secondaryBorder: 'border-[#152019]/30 text-[#152019] hover:bg-[#152019]/5',
          frameBg: '#dcd8cc',
          controlBg: 'bg-white text-[#152019] hover:bg-[#f4f3f1]',
        }
      : {
          bg: '#f4f3f1',
          ink: '#0a0a0a',
          muted: '#57554f',
          ctaBg: primary,
          ctaInk: branding.textOnPrimary || '#ffffff',
          secondaryBorder: 'border-[#0a0a0a]/25 text-[#0a0a0a] hover:bg-[#0a0a0a]/5',
          frameBg: '#e4e2dd',
          controlBg: 'bg-white text-[#0a0a0a] hover:bg-[#f4f3f1]',
        };

  return (
    <section
      id="top"
      className="w-full"
      style={{ backgroundColor: theme.bg, color: theme.ink }}
    >
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-14 sm:py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Editorial Copy Column */}
        <div className="lg:col-span-6 space-y-7">
          <h1 className="tenant-editorial-display text-[48px] sm:text-[64px] lg:text-[78px] leading-[0.96] tracking-[-0.03em] font-normal break-words">
            {getCleanHeadline(slide?.title)}
          </h1>

          <p
            className="text-[17px] sm:text-[19px] leading-[1.55] max-w-[46ch]"
            style={{ color: theme.muted }}
          >
            {slide?.subtitle || hero.subtitle || `${schoolName} prepares students with disciplined scholarship and daily care.`}
          </p>

          {hero.motto && (
            <p className="text-[15px] italic" style={{ color: theme.muted }}>
              “{hero.motto}”
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href={resolveHref(slide?.ctaLink || '/admissions')}
              className="h-12 px-6 text-[14px] font-medium inline-flex items-center gap-2.5 transition-opacity hover:opacity-90"
              style={{ backgroundColor: theme.ctaBg, color: theme.ctaInk }}
            >
              <span>{slide?.ctaText || 'Explore admissions'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href={resolveHref('/academics')}
              className={`h-12 px-6 border text-[14px] font-medium inline-flex items-center transition-colors ${theme.secondaryBorder}`}
            >
              Explore academics
            </Link>
          </div>
        </div>

        {/* Full-Impact Square-Cropped Campus Photography */}
        <div
          className="lg:col-span-6"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div
            className="relative aspect-[4/3] w-full overflow-hidden"
            style={{ backgroundColor: theme.frameBg }}
          >
            {image ? (
              <img
                key={image}
                src={image}
                alt={`${schoolName}: ${slide?.title}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center p-10 text-center">
                <p className="tenant-editorial-display text-4xl sm:text-5xl">{schoolName}</p>
                <p className="mt-3 text-[14px] max-w-xs" style={{ color: theme.muted }}>
                  Upload campus photographs in Website Settings to feature your school here.
                </p>
              </div>
            )}
          </div>

          {slides.length > 1 && (
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {slides.map((item, index) => (
                  <button
                    key={`${item.title}-${index}`}
                    type="button"
                    onClick={() => setActive(index)}
                    aria-label={`Show campus photo ${index + 1}`}
                    aria-current={index === active}
                    className={`h-1.5 transition-[width] cursor-pointer ${
                      index === active ? 'w-10' : 'w-4 opacity-35 hover:opacity-70'
                    }`}
                    style={{ backgroundColor: theme.ink }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] ws-tabular mr-2" style={{ color: theme.muted }}>
                  {active + 1} / {slides.length}
                </span>
                <button
                  type="button"
                  onClick={() => move(-1)}
                  aria-label="Previous campus photo"
                  className={`h-9 w-9 flex items-center justify-center transition-colors cursor-pointer ${theme.controlBg}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="Next campus photo"
                  className={`h-9 w-9 flex items-center justify-center transition-colors cursor-pointer ${theme.controlBg}`}
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
