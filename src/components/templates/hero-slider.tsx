'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import type { HeroSlide } from '@/lib/site-content';

interface HeroSliderProps {
  slides: HeroSlide[];
  variant?: 'heritage' | 'vanguard' | 'horizon';
  primaryColor: string;
  accentColor: string;
  schoolName: string;
  motto?: string;
}

export function HeroSlider({
  slides,
  variant = 'heritage',
  primaryColor,
  accentColor,
  schoolName,
  motto,
}: HeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const safeSlides = slides.length > 0 ? slides : [
    {
      title: `Welcome to ${schoolName}`,
      subtitle: motto || 'Inspiring excellence, cultivating character, and shaping future global leaders.',
      imageUrl: null,
      ctaText: 'Apply for Admission',
      ctaLink: '/admissions',
    },
  ];

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % safeSlides.length);
  }, [safeSlides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + safeSlides.length) % safeSlides.length);
  }, [safeSlides.length]);

  useEffect(() => {
    if (isPaused || safeSlides.length <= 1) return;
    const interval = setInterval(nextSlide, 6500);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide, safeSlides.length]);

  const activeSlide = safeSlides[currentIndex];

  if (variant === 'vanguard') {
    return (
      <div
        className="relative overflow-hidden bg-slate-950 text-white min-h-[580px] lg:min-h-[640px] flex items-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Background Image / Gradient */}
        {activeSlide.imageUrl ? (
          <div className="absolute inset-0 z-0">
            <img
              src={activeSlide.imageUrl}
              alt={activeSlide.title}
              className="w-full h-full object-cover opacity-25 filter contrast-125 transition-all duration-1000 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/60" />
            <div className="absolute inset-0 bg-radial from-transparent via-slate-950/50 to-slate-950" />
          </div>
        ) : (
          <div
            className="absolute inset-0 z-0 opacity-30"
            style={{
              background: `radial-gradient(circle at 30% 50%, ${accentColor} 0%, transparent 60%), radial-gradient(circle at 80% 20%, ${primaryColor} 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0f_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0f_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-white/10 border border-white/15 backdrop-blur-md mb-6 text-emerald-400 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Admissions Open • 2025/2026 Academic Session</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6 drop-shadow-sm">
              {activeSlide.title}
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-2xl font-normal">
              {activeSlide.subtitle || motto || 'Equipping tomorrow’s innovators with advanced STEM curricula, world-class faculty, and global leadership skills.'}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={activeSlide.ctaLink || '/admissions'}
                className="px-7 py-4 rounded-xl font-extrabold text-sm text-slate-950 shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
              >
                <span>{activeSlide.ctaText || 'Apply for Admission'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/academics"
                className="px-6 py-4 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white transition-all"
              >
                Curriculum & STEM Tracks
              </Link>
            </div>
          </div>

          {/* Right Floating Metric Card */}
          <div className="lg:col-span-4 hidden lg:flex flex-col gap-4">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-mono tracking-widest text-slate-400">WAEC / IGCSE Pass Rate</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-4xl font-black text-white mb-1">100%</div>
              <p className="text-xs text-slate-400">Consistent A* to B distinction across all science and commercial tracks.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-mono tracking-widest text-slate-400">Teacher-Student Ratio</span>
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-4xl font-black text-white mb-1">1:12</div>
              <p className="text-xs text-slate-400">Individualized mentorship and interactive hands-on laboratories.</p>
            </div>
          </div>
        </div>

        {/* Slide navigation controls */}
        {safeSlides.length > 1 && (
          <div className="absolute bottom-6 inset-x-0 z-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {safeSlides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevSlide}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md transition-colors"
                  aria-label="Previous Slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md transition-colors"
                  aria-label="Next Slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'horizon') {
    return (
      <div
        className="relative overflow-hidden bg-slate-900 text-white min-h-[580px] lg:min-h-[620px] flex items-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Background Image / Soft Gradient */}
        {activeSlide.imageUrl ? (
          <div className="absolute inset-0 z-0">
            <img
              src={activeSlide.imageUrl}
              alt={activeSlide.title}
              className="w-full h-full object-cover opacity-35 transition-all duration-1000 scale-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-900/60" />
          </div>
        ) : (
          <div
            className="absolute inset-0 z-0 opacity-40"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
            }}
          />
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10 w-full text-center max-w-4xl mx-auto">
          {motto && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide bg-white/15 border border-white/20 backdrop-blur-md mb-6 text-amber-200">
              <span>{motto}</span>
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            {activeSlide.title}
          </h1>

          <p className="text-base sm:text-xl text-slate-200 leading-relaxed mb-10 max-w-2xl mx-auto font-light">
            {activeSlide.subtitle || 'A nurturing learning community where curiosity is sparked, creativity is nurtured, and character is built for life.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href={activeSlide.ctaLink || '/admissions'}
              className="px-8 py-4 rounded-2xl font-bold text-base text-slate-900 shadow-2xl transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
              style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
            >
              <span>{activeSlide.ctaText || 'Begin Admission Inquiry'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/about"
              className="px-7 py-4 rounded-2xl font-bold text-base bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-md text-white transition-all"
            >
              About Our School
            </Link>
          </div>
        </div>

        {/* Carousel indicator tabs */}
        {safeSlides.length > 1 && (
          <div className="absolute bottom-6 inset-x-0 z-20">
            <div className="flex items-center justify-center gap-3">
              {safeSlides.map((slide, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    idx === currentIndex
                      ? 'bg-white text-slate-900 shadow-md font-bold'
                      : 'bg-white/20 text-white/80 hover:bg-white/40'
                  }`}
                >
                  {slide.title.substring(0, 24)}...
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: 'heritage' (Classic, Prestigious, Collegiate)
  return (
    <div
      className="relative overflow-hidden text-white min-h-[580px] lg:min-h-[640px] flex items-center shadow-inner"
      style={{
        backgroundColor: primaryColor,
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background slide picture */}
      {activeSlide.imageUrl ? (
        <div className="absolute inset-0 z-0">
          <img
            src={activeSlide.imageUrl}
            alt={activeSlide.title}
            className="w-full h-full object-cover opacity-25 filter contrast-110 transition-all duration-1000"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}F0 0%, ${primaryColor}99 50%, #0F172ACC 100%)`,
            }}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, #0F172A 100%)`,
          }}
        />
      )}

      {/* Decorative Heraldic Crest Motif */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] rounded-full border border-white/10 pointer-events-none opacity-40 flex items-center justify-center">
        <div className="w-[450px] h-[450px] rounded-full border border-white/5" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-serif tracking-widest uppercase bg-white/10 border border-white/20 backdrop-blur-md mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
            <span>{motto || 'Excellence • Integrity • Leadership'}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-black tracking-tight leading-[1.15] mb-6 text-white drop-shadow-sm">
            {activeSlide.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-200 leading-relaxed mb-10 max-w-2xl font-light">
            {activeSlide.subtitle || 'Fostering academic distinction, ethical grounding, and intellectual curiosity in a supportive collegiate environment.'}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={activeSlide.ctaLink || '/admissions'}
              className="px-8 py-4 rounded-xl font-bold text-sm tracking-wide shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
              style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
            >
              <span>{activeSlide.ctaText || 'Apply for Admission'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/about"
              className="px-7 py-4 rounded-xl font-semibold text-sm bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-md text-white transition-all"
            >
              Our Heritage & Vision
            </Link>
          </div>
        </div>

        {/* Right Preview Card / Stately Crest Box */}
        <div className="lg:col-span-4 hidden lg:block">
          <div className="p-8 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-2xl text-center">
            <div
              className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center font-serif text-3xl font-black shadow-lg"
              style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
            >
              {schoolName.charAt(0)}
            </div>
            <h3 className="font-serif text-xl font-bold text-white mb-2">{schoolName}</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Founded on the bedrock of moral virtue, academic rigour, and dedicated mentorship.
            </p>
            <div className="pt-4 border-t border-white/15 flex justify-around text-center text-xs">
              <div>
                <span className="block font-black text-lg text-white">Top 1%</span>
                <span className="text-slate-300">National Standing</span>
              </div>
              <div className="border-r border-white/15" />
              <div>
                <span className="block font-black text-lg text-white">100%</span>
                <span className="text-slate-300">University Placement</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slider dots and navigation */}
      {safeSlides.length > 1 && (
        <div className="absolute bottom-6 inset-x-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {safeSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevSlide}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md transition-colors"
                aria-label="Previous Slide"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md transition-colors"
                aria-label="Next Slide"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
