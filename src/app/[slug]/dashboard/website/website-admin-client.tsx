'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ImageUploadInput from '@/components/image-upload-input';
import {
  Palette,
  FileText,
  Camera,
  Globe,
  Layout,
  CheckCircle2,
  Sparkles,
  Award,
  Layers,
  Heart,
  Shield,
  ArrowRight,
  Plus,
  Trash2,
} from 'lucide-react';

interface WebsiteAdminClientProps {
  tenantSlug: string;
  tenantName?: string;
  initialBranding: {
    primaryColor: string;
    accentColor: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    fontHeading: string;
    fontBody: string;
    templateId?: 'heritage' | 'vanguard' | 'horizon';
    textOnPrimary: string;
    textOnAccent: string;
    contrastRatioPrimary: number;
    contrastRatioAccent: number;
    isPrimaryCompliant: boolean;
    isAccentCompliant: boolean;
  };
  initialSiteData: {
    templateId?: 'heritage' | 'vanguard' | 'horizon';
    hero: {
      title: string;
      subtitle: string;
      imageUrl: string | null;
      motto?: string;
      featuredStudent?: { name?: string; className?: string; achievement?: string; imageUrl?: string | null } | null;
    };
    about: {
      title: string;
      text: string;
      mission?: string;
      vision?: string;
      principalMessage?: string;
      anthem?: string;
      coreValues?: string[];
    };
    academics: {
      text: string;
      highlights: string[];
      curricula?: string[];
    };
    admissions?: {
      text: string;
      requirements?: string[];
      feeGuideText?: string;
    };
    contact: {
      email: string | null;
      phone: string | null;
      address: string | null;
      officeHours?: string;
    };
    gallery: Array<{ id: string; imageUrl: string; caption: string | null; album: string | null }>;
  };
  domainAliases?: Array<{ id: string; domain: string; isPrimary?: boolean }>;
  hasCustomDomainFeature?: boolean;
  hasWebsiteCmsFeature?: boolean;
  hasGalleryFeature?: boolean;
}

export default function WebsiteAdminClient({
  tenantSlug,
  tenantName,
  initialBranding,
  initialSiteData,
  domainAliases = [],
  hasCustomDomainFeature = true,
  hasGalleryFeature = false,
}: WebsiteAdminClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'template' | 'branding' | 'content' | 'gallery' | 'domains'>('template');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Template state
  const [templateId, setTemplateId] = useState<'heritage' | 'vanguard' | 'horizon'>(
    initialSiteData.templateId || initialBranding.templateId || 'heritage'
  );

  // Branding state
  const [primaryColor, setPrimaryColor] = useState(initialBranding.primaryColor);
  const [accentColor, setAccentColor] = useState(initialBranding.accentColor);
  const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl || '');
  const [faviconUrl, setFaviconUrl] = useState(initialBranding.faviconUrl || '');

  // Content state - Hero & Identity
  const [heroTitle, setHeroTitle] = useState(initialSiteData.hero.title);
  const [heroSubtitle, setHeroSubtitle] = useState(initialSiteData.hero.subtitle);
  const [heroMotto, setHeroMotto] = useState(initialSiteData.hero.motto || '');
  const [heroImageUrl, setHeroImageUrl] = useState(initialSiteData.hero.imageUrl || '');

  // Content state - Featured Student
  const [featuredStudentName, setFeaturedStudentName] = useState(initialSiteData.hero.featuredStudent?.name || '');
  const [featuredStudentClass, setFeaturedStudentClass] = useState(initialSiteData.hero.featuredStudent?.className || '');
  const [featuredStudentAchievement, setFeaturedStudentAchievement] = useState(initialSiteData.hero.featuredStudent?.achievement || '');
  const [featuredStudentImage, setFeaturedStudentImage] = useState(initialSiteData.hero.featuredStudent?.imageUrl || '');

  // Content state - About & Leadership
  const [aboutTitle, setAboutTitle] = useState(initialSiteData.about.title);
  const [aboutText, setAboutText] = useState(initialSiteData.about.text);
  const [principalMessage, setPrincipalMessage] = useState(initialSiteData.about.principalMessage || '');
  const [mission, setMission] = useState(initialSiteData.about.mission || '');
  const [vision, setVision] = useState(initialSiteData.about.vision || '');
  const [aboutAnthem, setAboutAnthem] = useState(initialSiteData.about.anthem || '');
  const [coreValues, setCoreValues] = useState((initialSiteData.about.coreValues || []).join(', '));

  // Content state - Academics & Admissions
  const [academicsText, setAcademicsText] = useState(initialSiteData.academics.text);
  const [academicHighlights, setAcademicHighlights] = useState(
    (initialSiteData.academics.highlights || []).join('\n')
  );
  const [curricula, setCurricula] = useState(
    (initialSiteData.academics.curricula || []).join('\n')
  );
  const [admissionsText, setAdmissionsText] = useState(initialSiteData.admissions?.text || '');
  const [admissionsRequirements, setAdmissionsRequirements] = useState(
    (initialSiteData.admissions?.requirements || []).join('\n')
  );
  const [admissionsFeeGuide, setAdmissionsFeeGuide] = useState(
    initialSiteData.admissions?.feeGuideText || ''
  );

  // Content state - Contact
  const [contactEmail, setContactEmail] = useState(initialSiteData.contact.email || '');
  const [contactPhone, setContactPhone] = useState(initialSiteData.contact.phone || '');
  const [contactAddress, setContactAddress] = useState(initialSiteData.contact.address || '');
  const [contactOfficeHours, setContactOfficeHours] = useState(
    initialSiteData.contact.officeHours || ''
  );

  // Gallery state
  const [galleryList, setGalleryList] = useState(initialSiteData.gallery);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [newGalleryCaption, setNewGalleryCaption] = useState('');
  const [newGalleryAlbum, setNewGalleryAlbum] = useState('General');

  // Compute live WCAG contrast
  const calcLuminance = (r: number, g: number, b: number) => {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };

  const getRatio = (hex: string) => {
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map((c) => c + c).join('');
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) return 1.0;
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const lum = calcLuminance(r, g, b);
    const whiteLum = 1.0;
    const ratio = (whiteLum + 0.05) / (lum + 0.05);
    return Math.round(ratio * 10) / 10;
  };

  const primaryRatio = getRatio(primaryColor);
  const accentRatio = getRatio(accentColor);

  const handleSaveTemplate = async (selectedId: 'heritage' | 'vanguard' | 'horizon') => {
    setLoading(true);
    setMsg(null);
    setTemplateId(selectedId);
    try {
      // Save to branding & home page content simultaneously
      const [brandingRes, contentRes] = await Promise.all([
        fetch('/api/tenant/branding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: selectedId }),
        }),
        fetch('/api/tenant/site-content', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page: 'home',
            content: { templateId: selectedId },
          }),
        }),
      ]);

      if (!brandingRes.ok) {
        const d = await brandingRes.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update template in branding');
      }
      if (!contentRes.ok) {
        const d = await contentRes.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update template in content');
      }

      setMsg({ type: 'success', text: `Website design template updated to "${selectedId.toUpperCase()}"!` });
      router.refresh();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to update template' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/tenant/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryColor,
          accentColor,
          logoUrl: logoUrl || null,
          faviconUrl: faviconUrl || null,
          templateId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMsg({ type: 'success', text: 'Branding tokens updated successfully!' });
      router.refresh();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to update branding' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContent = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const pages = [
        {
          page: 'home',
          content: {
            templateId,
            heroTitle,
            heroSubtitle,
            motto: heroMotto || null,
            heroImageUrl: heroImageUrl || null,
            featuredStudent: featuredStudentName.trim()
              ? {
                  name: featuredStudentName.trim(),
                  className: featuredStudentClass.trim(),
                  achievement: featuredStudentAchievement.trim(),
                  imageUrl: featuredStudentImage || null,
                }
              : null,
          },
        },
        {
          page: 'about',
          content: {
            title: aboutTitle,
            text: aboutText,
            principalMessage: principalMessage || null,
            mission: mission || null,
            vision: vision || null,
            anthem: aboutAnthem || null,
            coreValues: coreValues.split(',').map((x) => x.trim()).filter(Boolean),
          },
        },
        {
          page: 'academics',
          content: {
            text: academicsText,
            highlights: academicHighlights.split('\n').filter((x) => x.trim()),
            curricula: curricula.split('\n').filter((x) => x.trim()),
          },
        },
        {
          page: 'admissions',
          content: {
            text: admissionsText,
            requirements: admissionsRequirements.split('\n').filter((x) => x.trim()),
            feeGuideText: admissionsFeeGuide || null,
          },
        },
        {
          page: 'contact',
          content: {
            email: contactEmail,
            phone: contactPhone,
            address: contactAddress,
            officeHours: contactOfficeHours || null,
          },
        },
      ];

      for (const item of pages) {
        const res = await fetch('/api/tenant/site-content', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update content');
        }
      }

      setMsg({ type: 'success', text: 'Public website copy, leadership message & academic sections updated!' });
      router.refresh();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to update content' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddGalleryImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGalleryUrl) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/tenant/site-content/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: newGalleryUrl,
          caption: newGalleryCaption || null,
          album: newGalleryAlbum || 'General',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setGalleryList([data, ...galleryList]);
      setNewGalleryUrl('');
      setNewGalleryCaption('');
      setMsg({ type: 'success', text: 'Image added to photo gallery!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGalleryImage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this gallery photo?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/site-content/gallery?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete image');
      setGalleryList(galleryList.filter((g) => g.id !== id));
      setMsg({ type: 'success', text: 'Image deleted from gallery.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Universal Access CMS
            </span>
            <span className="text-xs text-slate-400">• Included in all plans</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            School Website &amp; Design Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your public landing page, select architectural design templates, update copy, and upload media.
          </p>
        </div>

        <a
          href={`/${tenantSlug}`}
          target="_blank"
          rel="noreferrer"
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
        >
          <span>View Public Website</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-2xl text-sm font-medium border flex items-center justify-between gap-4 flex-wrap shadow-xs ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{msg.text}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('template')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'template'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span>Website Template</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'branding'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Brand Colors &amp; Crest</span>
        </button>

        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'content'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Public Copy &amp; Leadership</span>
        </button>

        {hasGalleryFeature && <button
          onClick={() => setActiveTab('gallery')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'gallery'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Photo Gallery ({galleryList.length})</span>
        </button>}

        <button
          onClick={() => setActiveTab('domains')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'domains'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Custom Domain</span>
        </button>
      </div>

      {/* ── TAB 0: TEMPLATE SELECTOR ── */}
      {activeTab === 'template' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Choose Website Architectural Template</h2>
            <p className="text-xs text-slate-500 mt-1">
              Select one of the 3 bespoke design templates tailored to your school&apos;s ethos. All plans have full access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Heritage Card */}
            <div
              onClick={() => handleSaveTemplate('heritage')}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                templateId === 'heritage'
                  ? 'border-indigo-600 bg-indigo-50/30 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-serif font-bold">
                    🏛️
                  </span>
                  {templateId === 'heritage' && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-base">The Heritage Template</h3>
                  <p className="text-[11px] font-sans font-semibold text-amber-800 uppercase tracking-wider mt-0.5">
                    Traditional &amp; Prestigious Academy
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Split-screen authoritative hero, formal Rector&apos;s address on parchment paper, classical academic ledger, and vintage photo exhibits.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200/80 mt-4 flex justify-between items-center text-xs">
                <span className="text-slate-500">Best for grammar schools &amp; academies</span>
                <span className="font-bold text-indigo-600">{templateId === 'heritage' ? 'Selected' : 'Activate →'}</span>
              </div>
            </div>

            {/* Vanguard Card */}
            <div
              onClick={() => handleSaveTemplate('vanguard')}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                templateId === 'vanguard'
                  ? 'border-cyan-500 bg-cyan-950/10 shadow-md ring-2 ring-cyan-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-2xl bg-cyan-900 text-cyan-300 flex items-center justify-center font-mono font-bold">
                    🚀
                  </span>
                  {templateId === 'vanguard' && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500 text-slate-950 font-mono">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">The Vanguard Template</h3>
                  <p className="text-[11px] font-mono font-semibold text-cyan-600 uppercase tracking-wider mt-0.5">
                    Modern STEM &amp; Digital Campus
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Dark obsidian aesthetic, asymmetrical Bento Grid hero, interactive stage switcher tabs, and cutting-edge science lab showcases.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200/80 mt-4 flex justify-between items-center text-xs">
                <span className="text-slate-500">Best for STEM, robotics &amp; modern colleges</span>
                <span className="font-bold text-cyan-600">{templateId === 'vanguard' ? 'Selected' : 'Activate →'}</span>
              </div>
            </div>

            {/* Horizon Card */}
            <div
              onClick={() => handleSaveTemplate('horizon')}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                templateId === 'horizon'
                  ? 'border-emerald-600 bg-emerald-50/30 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    🌿
                  </span>
                  {templateId === 'horizon' && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">The Horizon Template</h3>
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mt-0.5">
                    Warm Community &amp; Early Years
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Warm sage &amp; terracotta palette, floating campus tour scheduler card, child nurture pillars, and parent testimonial spotlight.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200/80 mt-4 flex justify-between items-center text-xs">
                <span className="text-slate-500">Best for nursery, primary &amp; preparatory</span>
                <span className="font-bold text-emerald-700">{templateId === 'horizon' ? 'Selected' : 'Activate →'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: BRANDING TOKENS & CREST ── */}
      {activeTab === 'branding' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
            School Colors, Crest &amp; Favicon
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Primary Color */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <label className="block text-sm font-bold text-slate-800">Primary Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border border-slate-300 p-1 bg-white"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="px-3 py-2 border rounded-xl font-mono text-sm uppercase w-32 border-slate-300 bg-white"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-slate-500">WCAG 2.1 AA Contrast Ratio:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full ${
                    primaryRatio >= 4.5
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {primaryRatio}:1 {primaryRatio >= 4.5 ? '✓ Compliant' : 'Low Contrast'}
                </span>
              </div>
            </div>

            {/* Accent Color */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <label className="block text-sm font-bold text-slate-800">Accent Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border border-slate-300 p-1 bg-white"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="px-3 py-2 border rounded-xl font-mono text-sm uppercase w-32 border-slate-300 bg-white"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-slate-500">WCAG 2.1 AA Contrast Ratio:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full ${
                    accentRatio >= 4.5
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {accentRatio}:1 {accentRatio >= 4.5 ? '✓ Compliant' : 'Low Contrast'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <ImageUploadInput
                label="School Crest / Official Logo"
                value={logoUrl || ''}
                onChange={setLogoUrl}
                endpoint="/api/tenant/upload"
                folder="logos"
                helperText="Official school crest shown on public website header and hero."
                recommendedDimensions="PNG, JPG, WebP or GIF up to 5MB"
                previewShape="square"
              />
            </div>
            <div>
              <ImageUploadInput
                label="Website Favicon"
                value={faviconUrl || ''}
                onChange={setFaviconUrl}
                endpoint="/api/tenant/upload"
                folder="favicons"
                helperText="Square 32x32 or 64x64 icon displayed on browser tabs."
                recommendedDimensions="Square .ico, .png, or .svg up to 2MB"
                previewShape="square"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSaveBranding}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save Brand Tokens'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 2: PUBLIC COPY & LEADERSHIP ── */}
      {activeTab === 'content' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-8">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
            Public Website Copy &amp; Section CMS
          </h2>

          {/* Hero & Motto */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              1. Hero &amp; School Motto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Main Heading / Hero Title (Press Enter to create line breaks)
                </label>
                <textarea
                  rows={2}
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  placeholder="e.g. Inspiring Excellence &amp; Character&#10;For Tomorrow's Visionary Leaders"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">School Motto</label>
                <input
                  type="text"
                  value={heroMotto}
                  onChange={(e) => setHeroMotto(e.target.value)}
                  placeholder="e.g. In Truth and Knowledge We Strive"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subheading Copy</label>
                <textarea
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div className="md:col-span-2">
                <ImageUploadInput
                  label="Hero Featured Photo"
                  value={heroImageUrl}
                  onChange={setHeroImageUrl}
                  endpoint="/api/tenant/upload"
                  folder="hero"
                  helperText="Primary high-resolution photo displayed across templates."
                  recommendedDimensions="Landscape photo (16:9 or 4:3) up to 5MB"
                  previewShape="landscape"
                />
              </div>
            </div>
          </div>

          {/* Featured Student */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
                  2. Scholar of the Term (Featured Student Spotlight)
                </h3>
                <p className="text-xs text-slate-500">Celebrate a student achievement banner on the public homepage. Clear all fields if not needed.</p>
              </div>
              {featuredStudentName && (
                <button
                  type="button"
                  onClick={() => {
                    setFeaturedStudentName('');
                    setFeaturedStudentClass('');
                    setFeaturedStudentAchievement('');
                    setFeaturedStudentImage('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer"
                >
                  Clear / Disable Spotlight
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Name</label>
                <input
                  value={featuredStudentName}
                  onChange={(e) => setFeaturedStudentName(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Year</label>
                <input
                  value={featuredStudentClass}
                  onChange={(e) => setFeaturedStudentClass(e.target.value)}
                  maxLength={80}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Achievement Description</label>
                <textarea
                  value={featuredStudentAchievement}
                  onChange={(e) => setFeaturedStudentAchievement(e.target.value)}
                  maxLength={300}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div className="md:col-span-2">
                <ImageUploadInput
                  label="Student Photo"
                  value={featuredStudentImage}
                  onChange={setFeaturedStudentImage}
                  endpoint="/api/tenant/upload"
                  folder="gallery"
                  helperText="Use a clear portrait photo."
                  previewShape="landscape"
                />
              </div>
            </div>
          </div>

          {/* Leadership & About */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              3. Leadership &amp; About Us
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Principal / Rector Message</label>
                <textarea
                  value={principalMessage}
                  onChange={(e) => setPrincipalMessage(e.target.value)}
                  rows={4}
                  placeholder="Official address from the Head of School to prospective parents..."
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">School Overview / History</label>
                <textarea
                  value={aboutText}
                  onChange={(e) => setAboutText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mission Statement</label>
                  <textarea
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vision Statement</label>
                  <textarea
                    value={vision}
                    onChange={(e) => setVision(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Core Values (Separated by commas)
                </label>
                <input
                  type="text"
                  value={coreValues}
                  onChange={(e) => setCoreValues(e.target.value)}
                  placeholder="e.g. Excellence, Integrity, Innovation, Discipline, Empathy"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School Anthem &amp; Pledge Lyrics
                </label>
                <textarea
                  value={aboutAnthem}
                  onChange={(e) => setAboutAnthem(e.target.value)}
                  rows={3}
                  placeholder="Forward ever, backward never, shining brightly as the stars..."
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Academics & Admissions */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              4. Academics &amp; Admissions Notice
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Academics Overview</label>
                <textarea
                  value={academicsText}
                  onChange={(e) => setAcademicsText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Curriculum Highlights (One per line)
                </label>
                <textarea
                  value={academicHighlights}
                  onChange={(e) => setAcademicHighlights(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Curricula &amp; Accreditations Offered (One per line)
                </label>
                <textarea
                  value={curricula}
                  onChange={(e) => setCurricula(e.target.value)}
                  rows={3}
                  placeholder="e.g. Nigerian National Curriculum (NERDC)&#10;British Cambridge Assessment Curriculum&#10;Advanced STEM &amp; Robotics"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admissions Callout Text</label>
                <textarea
                  value={admissionsText}
                  onChange={(e) => setAdmissionsText(e.target.value)}
                  rows={2}
                  placeholder="Information regarding applications, entrance assessments, and registration deadlines..."
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admission Requirements (One per line)
                </label>
                <textarea
                  value={admissionsRequirements}
                  onChange={(e) => setAdmissionsRequirements(e.target.value)}
                  rows={3}
                  placeholder="e.g. Completed Online Admission Form&#10;Previous 2 terms report card&#10;Birth Certificate &amp; 2 passport photos"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tuition &amp; Fee Policy Guide Note
                </label>
                <textarea
                  value={admissionsFeeGuide}
                  onChange={(e) => setAdmissionsFeeGuide(e.target.value)}
                  rows={2}
                  placeholder="Our tuition structure is transparent and structured across terms..."
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              5. Official Contact Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campus Physical Address</label>
                <input
                  type="text"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Working Hours</label>
                <input
                  type="text"
                  value={contactOfficeHours}
                  onChange={(e) => setContactOfficeHours(e.target.value)}
                  placeholder="e.g. Monday – Friday: 7:30 AM – 4:30 PM"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSaveContent}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save All Website Content'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 3: PHOTO GALLERY ── */}
      {activeTab === 'gallery' && hasGalleryFeature && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Campus Photo Gallery</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload facility photos, laboratory spaces, arts exhibits, and sports events.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddGalleryImage} className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Upload New Photo to Campus Album
            </h3>
            
            <ImageUploadInput
              label="Select or Upload Photo"
              value={newGalleryUrl}
              onChange={setNewGalleryUrl}
              endpoint="/api/tenant/upload"
              folder="gallery"
              helperText="Upload campus facilities, laboratories, library, ceremonies, etc."
              recommendedDimensions="Landscape 16:9 or 4:3 high-res photo up to 5MB"
              previewShape="landscape"
            />

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Photo Caption / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Chemistry Practical Examination"
                  value={newGalleryCaption}
                  onChange={(e) => setNewGalleryCaption(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300 bg-white"
                />
              </div>

              <div className="w-full sm:w-48">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Album Category
                </label>
                <select
                  value={newGalleryAlbum}
                  onChange={(e) => setNewGalleryAlbum(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300 bg-white"
                >
                  <option value="General">General</option>
                  <option value="Academics">Academics &amp; STEM</option>
                  <option value="Facilities">Campus Facilities</option>
                  <option value="Sports">Sports &amp; Athletics</option>
                  <option value="Arts">Creative Arts</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !newGalleryUrl}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {loading ? 'Adding...' : '+ Add Photo'}
              </button>
            </div>
          </form>

          {/* Photo Roster */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
              Published Gallery Photos ({galleryList.length})
            </h3>

            {galleryList.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                <Camera className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">No photos published in the campus gallery yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {galleryList.map((item) => (
                  <div
                    key={item.id}
                    className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs"
                  >
                    <div className="aspect-16/10 bg-slate-100 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.caption || 'Campus photo'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{item.caption || 'Untitled Photo'}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{item.album || 'General'}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteGalleryImage(item.id)}
                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: CUSTOM DOMAIN ── */}
      {activeTab === 'domains' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Custom Domain &amp; Subdomain Mapping
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Connect your school&apos;s custom domain (e.g.{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-600">
                myschool.edu.ng
              </code>
              ) to point directly to your school portal.
            </p>
          </div>

          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Default Subdomain</h3>
            <p className="text-xs text-slate-600">
              Your default platform web address is always active:
            </p>
            <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-xs text-slate-800 select-all">
              https://{tenantSlug}.edusaas.ng
            </div>
          </div>

          {!hasCustomDomainFeature && (
            <div className="p-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-2">
              <strong className="block text-amber-950 font-bold text-sm">Custom CNAME Domain Mapping</strong>
              <p className="text-amber-800">
                Custom apex domain mapping with automated SSL certificates is supported on the Enterprise tier. On Starter and Growth, schools use their dedicated subdomain.
              </p>
              <div className="pt-1">
                <Link
                  href={`/${tenantSlug}/dashboard/subscription`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-colors"
                >
                  View Plan Upgrade
                </Link>
              </div>
            </div>
          )}

          {hasCustomDomainFeature && (
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Connected Custom Domains</h3>
              {domainAliases.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No custom domain configured yet. Add your domain via DNS CNAME records.</p>
              ) : (
                <div className="space-y-2">
                  {domainAliases.map((d) => (
                    <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-800">{d.domain}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        CNAME Verified
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
