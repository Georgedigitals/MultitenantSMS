'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { HeritageTemplate } from '@/components/templates/heritage-template';
import { HorizonTemplate } from '@/components/templates/horizon-template';
import { VanguardTemplate } from '@/components/templates/vanguard-template';
import type { PublicSiteData } from '@/lib/site-content';

interface RegisterLivePreviewModalProps {
  open: boolean;
  onClose: () => void;
  templateId: 'heritage' | 'vanguard' | 'horizon';
  onChangeTemplate: (next: 'heritage' | 'vanguard' | 'horizon') => void;
  schoolName: string;
  slug: string;
  rootDomain: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  heroImageUrl: string;
  motto: string;
  heroSubheading: string;
  lowestLevelName: string;
  highestLevelName: string;
  galleryImages: Array<{ title: string; url: string }>;
}

function getContrastText(hex: string): string {
  const clean = (hex || '#1D3251').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9A-Fa-f]{6}$/.test(full)) return '#FFFFFF';
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.58 ? '#171614' : '#FFFFFF';
}

export function RegisterLivePreviewModal({
  open,
  onClose,
  templateId,
  onChangeTemplate,
  schoolName,
  slug,
  rootDomain,
  primaryColor,
  accentColor,
  logoUrl,
  heroImageUrl,
  motto,
  heroSubheading,
  lowestLevelName,
  highestLevelName,
  galleryImages,
}: RegisterLivePreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const displayName = schoolName.trim() || 'Your School Name';
  const displaySlug = slug.trim() || 'yourschool';
  const textOnPrimary = getContrastText(primaryColor);
  const textOnAccent = getContrastText(accentColor);

  const previewData: PublicSiteData = {
    tenant: {
      id: 'preview',
      name: displayName,
      slug: displaySlug,
    },
    branding: {
      primaryColor,
      accentColor,
      logoUrl: logoUrl || null,
      faviconUrl: null,
      fontHeading: 'Inter',
      fontBody: 'Inter',
      templateId,
      textOnPrimary,
      textOnAccent,
      contrastRatioPrimary: 7,
      contrastRatioAccent: 5,
      isPrimaryCompliant: true,
      isAccentCompliant: true,
    } as any,
    templateId,
    hero: {
      title: `Welcome to ${displayName}`,
      subtitle:
        heroSubheading.trim() ||
        'Nurturing future leaders through academic excellence, character development, and modern learning.',
      imageUrl: heroImageUrl || galleryImages[0]?.url || null,
      motto: motto.trim() || 'Excellence, Integrity, and Knowledge',
      sliderSlides: [],
      featuredStudent: null,
    },
    about: {
      title: `About ${displayName}`,
      text: `${displayName} is dedicated to providing high-quality education, character development, and academic excellence from ${lowestLevelName} through ${highestLevelName}.`,
      mission:
        'To inspire intellectual growth, moral fortitude, and global leadership skills in every learner through purposeful inquiry and high standards.',
      vision:
        'To be a premier institution recognized for transformative education, ethical grounding, and academic innovation.',
      coreValues: ['Excellence', 'Integrity', 'Innovation', 'Discipline', 'Empathy & Service'],
      principalMessage: `At ${displayName}, we believe every child possesses innate gifts waiting to be unlocked. Our dedicated faculty fosters an environment of curiosity, resilience, and compassion.`,
      headName: `Head of School, ${displayName}`,
      headPhotoUrl: null,
      campusPhotoUrl: galleryImages[0]?.url || heroImageUrl || null,
    },
    stats: {
      foundedYear: String(new Date().getFullYear()),
      teacherRatio: '12:1',
      passRate: '98%',
    },
    highlights: {
      headline: 'Small classes, big attention.',
      featureImageUrl: galleryImages[1]?.url || heroImageUrl || null,
      items: [
        { title: 'An open door', body: 'Direct, regular communication between teachers and parents every week.' },
        { title: 'Outdoors, every day', body: 'Balanced academics, creative arts, sports, and practical discovery.' },
        { title: 'Small classes', body: 'Teachers who notice the quiet child as much as the loud one.' },
        { title: 'Stories first', body: 'Language, curiosity, and structured reading built every single day.' },
      ],
    },
    newsEvents: [
      {
        date: 'Open Day',
        category: 'Event',
        title: 'Campus Open Day & Tour',
        summary: 'Meet our faculty, tour our classrooms, and experience an ordinary school day.',
        imageUrl: galleryImages[0]?.url || null,
      },
      {
        date: '20 Jun',
        category: 'Event',
        title: 'Annual Sports & Athletics Day',
        summary: 'Inter-house track, field, and team events celebrating spirit and teamwork.',
        imageUrl: galleryImages[1]?.url || null,
      },
      {
        date: 'New',
        category: 'News',
        title: 'Admissions Open for Upcoming Session',
        summary: `Applications are now open from ${lowestLevelName} to ${highestLevelName}.`,
        imageUrl: galleryImages[2]?.url || null,
      },
    ],
    parentQuote: {
      quote: `Our child looks forward to ${displayName} every single morning. The teachers know every student personally and keep parents informed at every step.`,
      author: 'Parent Community',
      role: `${displayName} Family`,
    },
    academics: {
      text: `Comprehensive curriculum spanning ${lowestLevelName} to ${highestLevelName}.`,
      highlights: ['Early Years Foundation', 'Primary Literacy & Numeracy', 'STEM & Digital Readiness'],
      curricula: ['National & International Standards', 'STEM & Robotics', 'Creative Arts & Sports'],
      levels: [
        { name: 'Early Years & Nursery', ages: 'Ages 2 – 5', description: 'Play-led days for confidence, language, and joyful foundations.', imageUrl: galleryImages[0]?.url || null },
        { name: 'Primary School', ages: 'Ages 6 – 11', description: 'Strong foundations in reading, mathematics, science, and arts.', imageUrl: galleryImages[1]?.url || null },
        { name: 'Secondary School', ages: 'Ages 11 – 17', description: 'Subject depth, leadership, and examination preparation.', imageUrl: galleryImages[2]?.url || null },
      ],
    },
    admissions: {
      text: `Joining ${displayName} is the first step toward a bright future. We invite prospective families to tour our campus.`,
      requirements: ['Completed Online Application Form', 'Previous School Report Card', 'Birth Certificate'],
      process: [
        { step: 1, title: 'Enquire', desc: 'Send us a short message or request a callback.' },
        { step: 2, title: 'Visit', desc: 'Tour the campus and meet our teachers in person.' },
        { step: 3, title: 'Apply', desc: 'Submit your form and documents for prompt confirmation.' },
      ],
      feeGuideText: 'Transparent termly tuition structure with sibling discounts available.',
    },
    contact: {
      email: `admissions@${displaySlug}.edu`,
      phone: '+1 (555) 010-2000',
      whatsapp: null,
      address: `${displayName} Campus`,
      officeHours: 'Monday – Friday: 7:30 AM – 4:30 PM',
    },
    gallery: galleryImages.map((img, i) => ({
      id: `preview-gal-${i}`,
      imageUrl: img.url,
      caption: img.title || `${displayName} Campus`,
      album: 'Campus',
      uploadedAt: new Date(),
    })),
  };

  const pageBg =
    templateId === 'horizon' ? '#FAF9F5' : templateId === 'vanguard' ? '#FBF8F1' : '#F8F5EE';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-5 bg-slate-950/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Top Browser & Template Switcher Toolbar (Always Visible Above Navbar) */}
        <div className="px-4 sm:px-5 py-3 bg-slate-950 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 truncate max-w-[220px] sm:max-w-xs">
              https://{displaySlug}.{rootDomain}
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {(['heritage', 'horizon', 'vanguard'] as const).map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => onChangeTemplate(tpl)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                  templateId === tpl
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tpl}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Preview</span>
          </button>
        </div>

        {/* Live Scrollable Real Template Viewport */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: pageBg }}>
          <div className="pointer-events-none select-none">
            <TenantPublicHeader
              slug={displaySlug}
              tenantName={displayName}
              branding={previewData.branding}
              templateId={templateId}
              contact={previewData.contact}
            />
            {templateId === 'vanguard' ? (
              <VanguardTemplate data={previewData} />
            ) : templateId === 'horizon' ? (
              <HorizonTemplate data={previewData} />
            ) : (
              <HeritageTemplate data={previewData} />
            )}
            <TenantPublicFooter data={previewData} />
          </div>
        </div>
      </div>
    </div>
  );
}
