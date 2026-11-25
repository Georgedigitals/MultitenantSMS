'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { extractColorsFromImage } from '@/lib/color-extractor';
import { useLanguage } from '@/components/language-provider';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
import { RegisterLivePreviewModal } from './register-live-preview-modal';
import { EDUCATION_SYSTEM_PRESETS, getPresetByKey } from '@/lib/class-level-presets';
import { Sparkles, Palette, Shield, Rocket, Heart, ChevronLeft, ChevronRight, Check } from 'lucide-react';

function RegisterFormContent() {
  const { formatMoney } = useLanguage();
  const searchParams = useSearchParams();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const initialPlanFromUrl = searchParams.get('planId') || 'plan_growth';

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [schoolName, setSchoolName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [educationSystem, setEducationSystem] = useState<string>('nigeria');
  const [lowestLevelName, setLowestLevelName] = useState('Nursery 1');
  const [highestLevelName, setHighestLevelName] = useState('SSS 3');
  const [primaryColor, setPrimaryColor] = useState('#0b2f48');
  const [accentColor, setAccentColor] = useState('#17834b');
  const [planId, setPlanId] = useState(initialPlanFromUrl);
  const [planOptions, setPlanOptions] = useState<Array<{ id: string; name: string; priceFormatted: string; cap: number; features: string[] }>>([]);
  const [trialDays, setTrialDays] = useState(14);

  // Design Templates & Branding State
  const [templateId, setTemplateId] = useState<'heritage' | 'vanguard' | 'horizon'>('heritage');
  const [extractedPalette, setExtractedPalette] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [heroImageUrl, setHeroImageUrl] = useState<string>('');
  const [motto, setMotto] = useState<string>('Excellence, Integrity, and Knowledge');
  const [heroSubheading, setHeroSubheading] = useState<string>(
    'Nurturing future leaders through academic excellence, character development, and modern learning.'
  );
  const [galleryImages, setGalleryImages] = useState<Array<{ title: string; url: string }>>([]);
  const [showLivePreviewModal, setShowLivePreviewModal] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [livePreviewTab, setLivePreviewTab] = useState<'website' | 'portal'>('website');

  useEffect(() => {
    const pId = searchParams.get('planId');
    if (pId) {
      setPlanId(pId);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/platform/plans')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.plans)) throw new Error(data.error || 'Plans unavailable');
        const options = data.plans.map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          priceFormatted: formatMoney(Number(plan.price), 0),
          cap: plan.studentCeiling,
          features: (plan.features || []).map((feature: any) => feature.name),
        }));
        setPlanOptions(options);
        if (!options.some((option: { id: string }) => option.id === initialPlanFromUrl) && options[0]) {
          setPlanId(options[0].id);
        }
      })
      .catch((err) => setError(err.message || 'Could not load subscription plans'));
    fetch('/api/platform/trial-settings')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Number.isInteger(data?.trialDays)) setTrialDays(data.trialDays); })
      .catch(() => { });
  }, [initialPlanFromUrl]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setSchoolName(name);
    if (!slug || slug === autoSlug(schoolName)) {
      setSlug(autoSlug(name));
    }
  };

  const autoSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30);
  };

  const [logoUploading, setLogoUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo image file size must be less than 5MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }

    // 1. Instant client-side color extraction from the school logo crest!
    extractColorsFromImage(file)
      .then((extracted) => {
        if (extracted.primaryColor) setPrimaryColor(extracted.primaryColor);
        if (extracted.accentColor) setAccentColor(extracted.accentColor);
        if (extracted.palette && extracted.palette.length > 0) {
          setExtractedPalette(extracted.palette);
        }
      })
      .catch((colErr) => {
        console.warn('Auto color extraction notice:', colErr);
      });

    setLogoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'logos');

      const res = await fetch('/api/platform/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload logo');
      }

      setLogoUrl(data.url);
    } catch (err: any) {
      setError(err.message || 'Logo upload failed. Please try again.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Hero banner image file size must be less than 5MB.');
      return;
    }

    setHeroUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'banners');

      const res = await fetch('/api/platform/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload hero banner');
      }

      setHeroImageUrl(data.url);
    } catch (err: any) {
      setError(err.message || 'Hero banner upload failed.');
    } finally {
      setHeroUploading(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setGalleryUploading(true);
    setError(null);

    try {
      const newImages: Array<{ title: string; url: string }> = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024 || !file.type.startsWith('image/')) continue;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'gallery');

        const res = await fetch('/api/platform/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          newImages.push({
            title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            url: data.url,
          });
        }
      }

      setGalleryImages((prev) => [...prev, ...newImages].slice(0, 6));
    } catch (err: any) {
      setError(err.message || 'Gallery upload failed.');
    } finally {
      setGalleryUploading(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !slug.trim()) {
      setError('Please provide school name and desired subdomain slug.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim() || !password) {
      setError('Please fill in all administrator details.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep(4);
  };

  const handleNextStep4 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep(5);
  };

  const buildRegistrationPayload = () => ({
    schoolName,
    slug,
    adminName,
    adminEmail,
    password,
    planId,
    educationSystem,
    lowestLevelName,
    highestLevelName,
    primaryColor,
    accentColor,
    logoUrl,
    heroImageUrl: heroImageUrl || (galleryImages[0]?.url) || null,
    motto,
    heroSubheading,
    templateId,
    galleryImages,
  });

  const handleStartTrial = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/platform/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildRegistrationPayload(), registrationMode: 'trial' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create trial account');
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setError(err.message || 'Could not start the trial');
      setLoading(false);
    }
  };

  const handleProceedToPaystack = async () => {
    setError(null);
    setLoading(true);

    const regPayload = { ...buildRegistrationPayload(), registrationMode: 'paid' };

    try {
      const res = await fetch('/api/platform/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...regPayload,
          registrationMode: 'paid',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to initialize Paystack gateway checkout');
        setLoading(false);
        return;
      }

      if (!data.authorizationUrl) throw new Error('Paystack did not return a secure checkout link. Please try again.');
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      setError('A network error occurred connecting to Paystack gateway.');
      setLoading(false);
    }
  };

  return (
    <div className="register-content max-w-7xl w-full mx-auto my-8 px-4 sm:px-6 lg:px-8 z-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:items-start">
        <div className="min-w-0">
          {/* Wizard Step Progress (5 Steps) */}
          <div className="register-progress mb-6">
            <div className="grid grid-cols-5 gap-2 sm:gap-4 max-w-3xl mx-auto mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className={`register-step flex flex-col items-center text-center gap-2 ${step === s ? 'is-current' : step > s ? 'is-complete' : ''}`}>
                  <div
                    className={`register-step-number w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-colors ${step === s
                      ? 'bg-[#17834b] text-white'
                      : step > s
                        ? 'bg-[#17834b] text-white'
                        : 'bg-white text-[#5d6d78] border border-[#dce6e0]'
                      }`}
                  >
                    {step > s ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : s}
                  </div>
                  <span className="register-step-label text-[10px] leading-tight sm:text-xs font-semibold text-[#5d6d78]">
                    {s === 1 && 'School identity'}
                    {s === 2 && 'Admin account'}
                    {s === 3 && 'Logo & branding'}
                    {s === 4 && 'Website content'}
                    {s === 5 && 'Plan & payment'}
                  </span>
                </div>
              ))}
            </div>
            <div className="w-full bg-[#eaf2ed] h-1 rounded-full overflow-hidden">
              <div
                className="bg-[#17834b] h-full transition-[width] duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* Form Container */}
          <div data-registration-form className="bg-white border border-[#dce6e0] rounded-3xl p-5 sm:p-8 ">
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-950/80 border border-[#eed0c9] text-red-300 text-xs font-medium flex items-center justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-[#102d43] font-bold ml-4">×</button>
              </div>
            )}

            {/* STEP 1: School Identity */}
            {step === 1 && (
              <form onSubmit={handleNextStep1} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#102d43] mb-1">Tell us about your school</h2>
                  <p className="text-xs text-[#5d6d78]">
                    Enter your official school name and choose your custom portal subdomain.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-2">
                    Official School Name
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={handleNameChange}
                    placeholder="e.g. Bright Stars International School"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-sm focus:outline-hidden focus:border-[#17834b] focus:ring-1 focus:ring-[#17834b] transition-colors font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-2">
                    Subdomain Slug Choice
                  </label>
                  <div className="flex rounded-xl bg-[#f4f7f5] border border-[#dce6e0] overflow-hidden focus-within:border-[#17834b] focus-within:ring-1 focus-within:ring-blue-500">
                    <span className="px-4 py-3 text-xs text-[#5d6d78] bg-white border-r border-[#dce6e0]  flex items-center">
                      https://
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(autoSlug(e.target.value))}
                      placeholder="brightstars"
                      required
                      className="flex-1 px-4 py-3 bg-transparent text-[#102d43] text-sm  focus:outline-hidden"
                    />
                    <span className="px-4 py-3 text-xs text-[#5d6d78] bg-white border-l border-[#dce6e0]  flex items-center">
                      .{rootDomain}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5d6d78] mt-2 ">
                    Your school portal address: <span className="text-[#17834b]">{slug || 'your-school'}.{rootDomain}</span>
                  </p>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-[#17834b] hover:bg-[#126d3d] text-[#102d43] text-xs font-bold   transition-colors cursor-pointer"
                  >
                    Continue to Admin Setup →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Admin Account */}
            {step === 2 && (
              <form onSubmit={handleNextStep2} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#102d43] mb-1">Create Administrator Account</h2>
                  <p className="text-xs text-[#5d6d78]">
                    This master account will have full administrative control over {schoolName}.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-2">
                    Administrator Full Name
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Dr. Sarah Johnson"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-sm focus:outline-hidden focus:border-[#17834b] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-2">
                    Admin Email Address (Username)
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="principal@brightstars.edu.ng"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-sm focus:outline-hidden focus:border-[#17834b] transition-colors "
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#425966] mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-sm focus:outline-hidden focus:border-[#17834b] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#425966] mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-sm focus:outline-hidden focus:border-[#17834b] transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="py-3 px-5 rounded-xl bg-[#eaf2ed] hover:bg-[#eaf2ed] text-[#425966] text-xs font-semibold cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-[#17834b] hover:bg-[#126d3d] text-[#102d43] text-xs font-bold   transition-colors cursor-pointer"
                  >
                    Continue to Logo & Styling →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: School Logo & Brand Styling */}
            {step === 3 && (
              <form onSubmit={handleNextStep3} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#102d43] mb-1">School Logo & Brand Identity</h2>
                  <p className="text-xs text-[#5d6d78]">
                    Upload your school crest/logo and select your official brand colors. Your logo will be automatically used for your custom website and student report cards!
                  </p>
                </div>

                {/* Logo Upload Box */}
                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-2">
                    Official School Crest / Logo (PNG or JPG)
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-[#f4f7f5] border border-[#dce6e0]">
                    <div className="w-24 h-24 rounded-2xl bg-white border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0  relative group">
                      {logoUrl ? (
                        <img src={logoUrl} alt="School Logo Preview" className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className="text-center p-2">
                          <span className="text-2xl block mb-1"></span>
                          <span className="text-[10px] text-[#5d6d78] ">No Logo</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <input
                        type="file"
                        id="logo-upload-input"
                        accept="image/*"
                        disabled={logoUploading}
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="logo-upload-input"
                        className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-[#eaf2ed] hover:bg-[#eaf2ed] text-[#102d43] text-xs font-semibold cursor-pointer border border-slate-700 transition-colors  disabled:opacity-50"
                      >
                        {logoUploading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Uploading Logo...</span>
                          </>
                        ) : (
                          <span>{logoUrl ? 'Change School Logo' : 'Upload School Logo'}</span>
                        )}
                      </label>
                      {logoUrl && !logoUploading && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="ml-3 text-xs text-red-400 hover:underline "
                        >
                          Remove Logo
                        </button>
                      )}
                      <p className="text-[11px] text-[#5d6d78] mt-2 ">
                        Recommended: Transparent PNG or high-res square logo (Max 5MB).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Extracted Swatches from Logo */}
                {extractedPalette.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#f4f7f5] border border-[#dce6e0]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span className="text-xs font-bold text-[#102d43]">Palette Auto-Extracted from Crest</span>
                      </div>
                      <span className="text-[10px] text-[#5d6d78] ">Tap swatch to set</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {extractedPalette.map((hex, i) => (
                        <div key={i} className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white border border-[#dce6e0]">
                          <span className="w-5 h-5 rounded-lg  border border-white/10 shrink-0" style={{ backgroundColor: hex }} />
                          <span className="text-[11px]  text-[#425966] pr-1">{hex}</span>
                          <button
                            type="button"
                            onClick={() => setPrimaryColor(hex)}
                            title="Set as Primary Color"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#eaf2ed] hover:bg-[#17834b] text-[#425966] hover:text-[#102d43] transition-colors"
                          >
                            Pri
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccentColor(hex)}
                            title="Set as Accent Color"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#eaf2ed] hover:bg-cyan-600 text-[#425966] hover:text-[#102d43] transition-colors"
                          >
                            Acc
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Brand Colors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-[#425966] mb-2">
                      Primary Brand Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-12 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] cursor-pointer p-1"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-xs "
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#425966] mb-2">
                      Accent Brand Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-12 h-12 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] cursor-pointer p-1"
                      />
                      <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-xs "
                      />
                    </div>
                  </div>
                </div>

                {/* Academic Levels & Global Education System */}
                <div className="p-4 rounded-2xl bg-[#f4f7f5] border border-[#dce6e0] space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#102d43] mb-1">
                      Grade / Class Naming System
                    </label>
                    <p className="text-[11px] text-[#5d6d78] mb-2.5">
                      Choose a starter template for your region. You can freely add, rename, reorder, or delete any class inside your dashboard later.
                    </p>
                    <select
                      value={educationSystem}
                      onChange={(e) => {
                        const nextKey = e.target.value;
                        setEducationSystem(nextKey);
                        const preset = getPresetByKey(nextKey);
                        if (preset && preset.classes.length > 0) {
                          setLowestLevelName(preset.classes[0]);
                          setHighestLevelName(preset.classes[preset.classes.length - 1]);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-[#dce6e0] text-[#102d43] text-xs font-semibold focus:outline-hidden focus:border-[#17834b]"
                    >
                      {EDUCATION_SYSTEM_PRESETS.map((preset) => (
                        <option key={preset.key} value={preset.key}>
                          {preset.label} — {preset.region}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const activePreset = getPresetByKey(educationSystem);
                    const presetClasses = activePreset?.classes || [];
                    if (presetClasses.length === 0) {
                      return (
                        <p className="text-[11px] text-[#425966] bg-white px-3.5 py-2.5 rounded-xl border border-[#dce6e0]">
                          Custom setup selected — we&apos;ll start your school with a clean slate so you can add your exact class names in <strong>Dashboard → Classes</strong>.
                        </p>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#425966] mb-1.5">
                            Lowest Class Level Offered
                          </label>
                          <select
                            value={lowestLevelName}
                            onChange={(e) => setLowestLevelName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#dce6e0] text-[#102d43] text-xs font-medium focus:outline-hidden"
                          >
                            {presetClasses.map((cls) => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#425966] mb-1.5">
                            Highest Class Level Offered
                          </label>
                          <select
                            value={highestLevelName}
                            onChange={(e) => setHighestLevelName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#dce6e0] text-[#102d43] text-xs font-medium focus:outline-hidden"
                          >
                            {presetClasses.map((cls) => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Branding Live Preview Box */}
                <div className="p-5 rounded-2xl bg-[#f4f7f5] border border-[#dce6e0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase  text-[#5d6d78] block">Live Header Preview</span>
                    <button
                      type="button"
                      onClick={() => setShowLivePreviewModal(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17834b] hover:text-[#126d3d] transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Full Page Live Preview ↗
                    </button>
                  </div>
                  <div
                    className="p-3.5 rounded-xl flex items-center justify-between text-[#102d43] font-bold text-sm  transition-colors"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-lg bg-white p-1 object-contain " />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center font-black text-[#102d43] text-sm">
                          {slug.substring(0, 2).toUpperCase() || 'BS'}
                        </div>
                      )}
                      <div>
                        <span className="block leading-snug">{schoolName || 'Bright Stars Academy'}</span>
                        <span className="text-[10px] opacity-80 font-normal  block">{slug || 'brightstars'}.{rootDomain}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLivePreviewModal(true)}
                      className="text-xs px-3.5 py-1.5 rounded-full bg-white/25 hover:bg-white/40 border border-white/30 backdrop-blur-md font-bold text-[#102d43]  transition-colors hover:scale-105 cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live Preview
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="py-3 px-5 rounded-xl bg-[#eaf2ed] hover:bg-[#eaf2ed] text-[#425966] text-xs font-semibold cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-[#17834b] hover:bg-[#126d3d] text-[#102d43] text-xs font-bold   transition-colors cursor-pointer"
                  >
                    Continue to Website Content →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Public Website Content, Template & Campus Photos */}
            {step === 4 && (
              <form onSubmit={handleNextStep4} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#102d43] mb-1">Choose Website Template & Content</h2>
                  <p className="text-xs text-[#5d6d78]">
                    Select from 3 high-design website templates tailored for modern schools, complete with an interactive hero section slider.
                  </p>
                </div>

                {/* Template Selector Grid */}
                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-3">
                    Select Public Website Template *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Heritage */}
                    <div
                      onClick={() => setTemplateId('heritage')}
                      className={`p-5 rounded-2xl border cursor-pointer text-left transition-colors flex flex-col justify-between focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700 ${templateId === 'heritage'
                        ? 'bg-white border-amber-500 ring-2 ring-amber-500/30 '
                        : 'bg-[#f4f7f5] border-[#dce6e0] hover:border-slate-700'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Shield className="w-5 h-5" />
                          </div>
                          {templateId === 'heritage' && (
                            <span className="text-[10px]  font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800">
                              Selected
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif font-bold text-base text-[#102d43] mb-1">The Heritage Academy</h3>
                        <p className="text-xs text-[#5d6d78] leading-relaxed mb-4">
                          Collegiate & prestigious. Classic serif typography, heraldic crest watermark, and stately slow-fade hero slider.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#dce6e0] flex items-center justify-between text-[11px] text-[#5d6d78]">
                        <span>Style: Ivy League</span>
                        <span className=" text-amber-400 font-bold">Classic</span>
                      </div>
                    </div>

                    {/* 2. Vanguard */}
                    <div
                      onClick={() => setTemplateId('vanguard')}
                      className={`p-5 rounded-2xl border cursor-pointer transition-colors flex flex-col justify-between ${templateId === 'vanguard'
                        ? 'bg-white border-cyan-500 ring-2 ring-cyan-500/30 '
                        : 'bg-[#f4f7f5] border-[#dce6e0] hover:border-slate-700'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <Rocket className="w-5 h-5" />
                          </div>
                          {templateId === 'vanguard' && (
                            <span className="text-[10px]  font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800">
                              Selected
                            </span>
                          )}
                        </div>
                        <h3 className=" font-bold text-base text-[#102d43] mb-1">The Vanguard STEM</h3>
                        <p className="text-xs text-[#5d6d78] leading-relaxed mb-4">
                          Modern, high-tech & future-focused. Dynamic card slider, real-time metric counters, and crisp contrast.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#dce6e0] flex items-center justify-between text-[11px] text-[#5d6d78]">
                        <span>Style: Modern Tech</span>
                        <span className=" text-cyan-400 font-bold">Innovation</span>
                      </div>
                    </div>

                    {/* 3. Horizon */}
                    <div
                      onClick={() => setTemplateId('horizon')}
                      className={`p-5 rounded-2xl border cursor-pointer transition-colors flex flex-col justify-between ${templateId === 'horizon'
                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/30 '
                        : 'bg-[#f4f7f5] border-[#dce6e0] hover:border-slate-700'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Heart className="w-5 h-5" />
                          </div>
                          {templateId === 'horizon' && (
                            <span className="text-[10px]  font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                              Selected
                            </span>
                          )}
                        </div>
                        <h3 className="font-sans font-bold text-base text-[#102d43] mb-1">The Horizon Community</h3>
                        <p className="text-xs text-[#5d6d78] leading-relaxed mb-4">
                          Warm, holistic & friendly. Rounded geometry, photo carousel with slide writeups, Montessori and K-12 focus.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#dce6e0] flex items-center justify-between text-[11px] text-[#5d6d78]">
                        <span>Style: Warm Holistic</span>
                        <span className=" text-emerald-400 font-bold">Community</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hero Banner Upload */}
                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-2">
                    Hero Section Banner Image (Optional)
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-[#f4f7f5] border border-[#dce6e0]">
                    <div className="w-32 h-20 rounded-xl bg-white border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0  relative">
                      {heroImageUrl ? (
                        <img src={heroImageUrl} alt="Hero Banner" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-2">
                          <span className="text-xs text-[#5d6d78] ">No Banner</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <input
                        type="file"
                        id="hero-banner-upload-input"
                        accept="image/*"
                        disabled={heroUploading}
                        onChange={handleHeroUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="hero-banner-upload-input"
                        className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-[#eaf2ed] hover:bg-[#eaf2ed] text-[#102d43] text-xs font-semibold cursor-pointer border border-slate-700 transition-colors "
                      >
                        {heroUploading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Uploading Banner...</span>
                          </>
                        ) : (
                          <span>{heroImageUrl ? 'Change Hero Banner' : 'Upload Hero Banner Photo'}</span>
                        )}
                      </label>
                      {heroImageUrl && !heroUploading && (
                        <button
                          type="button"
                          onClick={() => setHeroImageUrl('')}
                          className="ml-3 text-xs text-red-400 hover:underline "
                        >
                          Remove
                        </button>
                      )}
                      <p className="text-[11px] text-[#5d6d78] mt-2 ">
                        High-definition landscape photo of students or school building (16:9 ratio, Max 5MB).
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-2">
                    School Motto / Tagline
                  </label>
                  <input
                    type="text"
                    value={motto}
                    onChange={(e) => setMotto(e.target.value)}
                    placeholder="e.g. Excellence, Integrity, and Knowledge"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-sm focus:outline-hidden focus:border-[#17834b] transition-colors font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#425966] mb-2">
                    Hero Subheading / Welcome Message
                  </label>
                  <textarea
                    value={heroSubheading}
                    onChange={(e) => setHeroSubheading(e.target.value)}
                    rows={3}
                    placeholder="Brief introduction displayed prominently on your school landing page."
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-sm focus:outline-hidden focus:border-[#17834b] transition-colors"
                  />
                </div>

                {/* Campus Gallery Photo Uploader */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-medium text-[#425966]">
                      Campus Photos Gallery (Optional, Up to 6 Photos)
                    </label>
                    <span className="text-[11px] text-[#5d6d78] ">{galleryImages.length} / 6 Uploaded</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#f4f7f5] border border-[#dce6e0] space-y-4">
                    {galleryImages.length < 6 && (
                      <div>
                        <input
                          type="file"
                          id="gallery-upload-input"
                          accept="image/*"
                          multiple
                          disabled={galleryUploading}
                          onChange={handleGalleryUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="gallery-upload-input"
                          className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#dce6e0] hover:border-[#17834b]/50 rounded-xl cursor-pointer bg-white/50 hover:bg-white transition-colors group"
                        >
                          {galleryUploading ? (
                            <div className="flex flex-col items-center justify-center py-2">
                              <div className="w-6 h-6 border-2 border-[#17834b] border-t-transparent rounded-full animate-spin mb-2" />
                              <span className="text-xs text-[#17834b] font-semibold">Uploading photos...</span>
                            </div>
                          ) : (
                            <>
                              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform"></span>
                              <span className="text-xs text-[#425966] font-semibold">Click to select campus photos</span>
                              <span className="text-[10px] text-[#5d6d78] mt-1 ">Upload classrooms, science labs, sports grounds, etc. (Max 5MB each)</span>
                            </>
                          )}
                        </label>
                      </div>
                    )}

                    {/* Photo Grid Preview */}
                    {galleryImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {galleryImages.map((img, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden bg-white border border-[#dce6e0] aspect-video">
                            <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-[#f4f7f5]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-2">
                              <span className="text-[10px] text-[#102d43] truncate font-medium max-w-[80%]">{img.title}</span>
                              <button
                                type="button"
                                onClick={() => removeGalleryImage(idx)}
                                className="w-6 h-6 rounded-full bg-red-600 text-[#102d43] text-xs font-bold flex items-center justify-center hover:bg-red-500"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Website Live Card Preview */}
                <div className="p-5 rounded-2xl bg-[#f4f7f5] border border-[#dce6e0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase  text-[#5d6d78] block">Live Website Homepage Card</span>
                    <button
                      type="button"
                      onClick={() => setShowLivePreviewModal(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17834b] hover:text-[#126d3d] transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Full Page Live Preview ↗
                    </button>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-[#dce6e0] relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-3">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl bg-white p-1 object-contain " />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[#102d43] text-base "
                          style={{ backgroundColor: primaryColor }}
                        >
                          {slug.substring(0, 2).toUpperCase() || 'BS'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-base font-bold text-[#102d43] leading-tight">{schoolName || 'Bright Stars International School'}</h4>
                        <p className="text-xs text-[#17834b] italic font-serif">&ldquo;{motto}&rdquo;</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#425966] line-clamp-2 mb-3 leading-relaxed">{heroSubheading}</p>

                    {galleryImages.length > 0 && (
                      <div className="flex gap-2 overflow-hidden pt-2 border-t border-[#dce6e0]">
                        {galleryImages.slice(0, 3).map((img, i) => (
                          <div key={i} className="w-16 h-10 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                            <img src={img.url} alt="Gallery" className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {galleryImages.length > 3 && (
                          <div className="w-10 h-10 rounded-lg bg-[#eaf2ed] text-[10px]  text-[#5d6d78] flex items-center justify-center border border-slate-700">
                            +{galleryImages.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="py-3 px-5 rounded-xl bg-[#eaf2ed] hover:bg-[#eaf2ed] text-[#425966] text-xs font-semibold cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-[#17834b] hover:bg-[#126d3d] text-[#102d43] text-xs font-bold   transition-colors cursor-pointer"
                  >
                    Select Subscription Plan →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 5: Plan Selection & Paystack Payment Gateway */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#102d43] mb-1">Select Subscription Tier (₦)</h2>
                  <p className="text-xs text-[#5d6d78]">Choose a plan, then start your {trialDays}-day trial or pay now. Plan prices are set by the platform administrator.</p>
                </div>

                {planOptions.length === 0 ? <p className="text-sm text-amber-300">Loading available plans…</p> : <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {planOptions.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setPlanId(p.id)}
                      aria-pressed={planId === p.id}
                      className={`p-5 rounded-2xl border cursor-pointer text-left transition-colors flex flex-col justify-between focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700 ${planId === p.id
                        ? 'bg-[#eaf4ed] border-[#17834b]'
                        : 'bg-[#f7faf8] border-[#dce6e0] hover:border-slate-700'
                        }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-sm text-[#102d43]">{p.name}</span>
                          {planId === p.id && <span className="text-[#17834b] font-bold text-xs inline-flex items-center gap-1"><Check size={14} aria-hidden="true" /> Selected</span>}
                        </div>
                        <span className="text-2xl font-black text-[#102d43] block mb-1">{p.priceFormatted}</span>
                        <span className="text-[11px] text-[#5d6d78] block mb-3 ">Cap: {p.cap} Students</span>
                      </div>

                      <ul className="space-y-1 text-[11px] text-[#5d6d78]">
                        {p.features.map((f, idx) => (
                          <li key={idx}>• {f}</li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>}

                {/* Order Summary Box */}
                <div className="p-5 rounded-2xl bg-[#f4f7f5] border border-[#dce6e0] space-y-3">
                  <div className="flex justify-between items-center border-b border-[#dce6e0] pb-2">
                    <h4 className="text-xs font-medium text-[#5d6d78]">Provisioning Order Summary</h4>
                    <span className="text-xs  text-[#17834b] bg-teal-950 px-2 py-0.5 rounded border border-teal-800">
                      Choose trial or payment
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#425966]">
                    <span>School Branding:</span>
                    <div className="flex items-center gap-2">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-5 h-5 rounded bg-white object-contain" />
                      ) : null}
                      <span className="font-bold text-[#102d43]">{schoolName} ({slug}.{rootDomain})</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-[#425966]">
                    <span>Master Administrator:</span>
                    <span className=" text-[#17834b]">{adminEmail}</span>
                  </div>
                  {motto && (
                    <div className="flex justify-between text-xs text-[#425966]">
                      <span>Motto:</span>
                      <span className="italic text-[#5d6d78] truncate max-w-[240px]">&ldquo;{motto}&rdquo;</span>
                    </div>
                  )}
                  {galleryImages.length > 0 && (
                    <div className="flex justify-between text-xs text-[#425966]">
                      <span>Campus Photos:</span>
                      <span className=" text-emerald-400">{galleryImages.length} Photos Configured</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-[#425966] border-t border-[#dce6e0] pt-2">
                    <span>Total Amount:</span>
                    <span className="font-bold text-[#17834b]">{planOptions.find((o) => o.id === planId)?.priceFormatted || '—'} / term</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    disabled={loading}
                    className="py-3 px-5 rounded-xl bg-[#eaf2ed] hover:bg-[#eaf2ed] text-[#425966] text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    ← Back
                  </button>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button type="button" onClick={handleStartTrial} disabled={loading || planOptions.length === 0} className="py-3.5 px-6 rounded-xl bg-[#eaf2ed] hover:bg-[#eaf2ed] text-[#102d43] text-xs font-bold  disabled:opacity-50">{loading ? 'Setting up…' : `Start ${trialDays}-Day Trial`}</button>
                    <button type="button" onClick={handleProceedToPaystack} disabled={loading || planOptions.length === 0} className="py-3.5 px-6 rounded-xl bg-[#17834b] hover:bg-[#126d3d] text-[#102d43] text-xs font-bold    transition-colors disabled:opacity-50">{loading ? 'Preparing checkout…' : 'Pay Now & Activate →'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real-Template Full Page Live Preview Modal (z-[120] above fixed navbar) */}
          <RegisterLivePreviewModal
            open={showLivePreviewModal}
            onClose={() => setShowLivePreviewModal(false)}
            templateId={templateId}
            onChangeTemplate={setTemplateId}
            schoolName={schoolName}
            slug={slug}
            rootDomain={rootDomain}
            primaryColor={primaryColor}
            accentColor={accentColor}
            logoUrl={logoUrl}
            heroImageUrl={heroImageUrl}
            motto={motto}
            heroSubheading={heroSubheading}
            lowestLevelName={lowestLevelName}
            highestLevelName={highestLevelName}
            galleryImages={galleryImages}
          />
        </div>

        {/* Tesla-Style Sticky Live School Configurator Preview */}
        <aside className="hidden lg:block sticky top-24">
          <div className="overflow-hidden rounded-2xl border border-[#e6e4de] bg-white text-[#141518] shadow-[0_12px_40px_rgba(17,17,16,0.08)]">
            <div className="flex items-center justify-between gap-2 border-b border-[#e6e4de] bg-[#f6f5f2] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#717278]">
                  Live School Configurator
                </p>
                <p className="truncate font-mono text-[11px] text-[#141518]">
                  {rootDomain}/{slug || 'your-school'}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-[#e6e4de]/70 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setLivePreviewTab('website')}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${livePreviewTab === 'website' ? 'bg-white text-[#141518] shadow-xs' : 'text-[#5a5b60]'
                    }`}
                >
                  Website
                </button>
                <button
                  type="button"
                  onClick={() => setLivePreviewTab('portal')}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${livePreviewTab === 'portal' ? 'bg-white text-[#141518] shadow-xs' : 'text-[#5a5b60]'
                    }`}
                >
                  Portal
                </button>
              </div>
            </div>

            {livePreviewTab === 'website' ? (
              <div>
                {/* Mini School Navbar */}
                <div
                  className="flex items-center justify-between px-5 py-3 text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded-md bg-white object-contain p-0.5 shrink-0" />
                    ) : (
                      <span
                        className="grid h-7 w-7 place-items-center rounded-md text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: accentColor }}
                      >
                        {(schoolName || 'S').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate text-xs font-semibold">{schoolName || 'Your School Name'}</span>
                  </div>
                  <span
                    className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: accentColor }}
                  >
                    Portal
                  </span>
                </div>

                {/* Mini Hero */}
                <div className="relative overflow-hidden bg-[#faf9f6] p-6">
                  {heroImageUrl && (
                    <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-xl border border-[#e6e4de]">
                      <img src={heroImageUrl} alt="Campus" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    {templateId} template
                  </span>
                  <h3
                    className="mt-3 text-2xl font-normal leading-tight tracking-[-0.02em] text-[#141518]"
                    style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
                  >
                    {schoolName || 'Your School Name'}
                  </h3>
                  <p className="mt-1 text-[11px] font-semibold text-[#5a5b60]">
                    {motto || 'Excellence, Integrity, and Knowledge'}
                  </p>
                  <p className="mt-2.5 text-xs leading-5 text-[#717278] line-clamp-3">
                    {heroSubheading}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className="inline-flex h-8 items-center rounded-lg px-3.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: accentColor }}
                    >
                      Apply for Admission →
                    </span>
                    <span className="inline-flex h-8 items-center rounded-lg border border-[#d5d2ca] bg-white px-3 text-[11px] font-medium text-[#141518]">
                      Check Results
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-[#faf9f6] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded-lg border border-[#e6e4de] bg-white object-contain p-0.5" />
                    ) : (
                      <span
                        className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {(schoolName || 'S').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#141518]">{schoolName || 'Your School'}</p>
                      <p className="text-[10px] text-[#717278]">{lowestLevelName} – {highestLevelName}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Live Workspace
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-[#e6e4de] bg-white p-3">
                    <p className="text-[10px] text-[#717278]">Admin Account</p>
                    <p className="mt-1 truncate text-xs font-semibold text-[#141518]">{adminName || 'Principal'}</p>
                    <p className="truncate font-mono text-[10px] text-[#717278]">{adminEmail || 'admin@school.edu'}</p>
                  </div>
                  <div className="rounded-xl border border-[#e6e4de] bg-white p-3">
                    <p className="text-[10px] text-[#717278]">Selected Plan</p>
                    <p className="mt-1 truncate text-xs font-semibold text-[#141518]">
                      {planOptions.find((p) => p.id === planId)?.name || 'Growth'}
                    </p>
                    <p className="font-mono text-[10px] text-emerald-700">
                      {trialDays}-day free trial
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#e6e4de] bg-white p-3.5 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5a5b60]">Custom School Website</span>
                    <span className="font-semibold text-emerald-700">Included</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#efede9] pt-2">
                    <span className="text-[#5a5b60]">Direct-to-School Payments</span>
                    <span className="font-semibold text-emerald-700">Ready</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#efede9] pt-2">
                    <span className="text-[#5a5b60]">Tenant Data Isolation</span>
                    <span className="font-semibold text-[#141518]">Verified</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-[#e6e4de] bg-white px-4 py-2.5 flex items-center justify-between text-[11px] text-[#717278]">
              <span>Updates live as you type</span>
              <span className="font-mono font-semibold text-[#141518]">Step {step} of 5</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function RegisterSchoolPage() {
  return (
    <div className="register-page min-h-screen bg-[#faf9f6] text-[#141518] flex flex-col justify-between font-sans relative">
      <PublicNavbar />

      <Suspense fallback={<div className="text-center py-20 text-[#5d6d78] text-sm">Loading school configurator…</div>}>
        <RegisterFormContent />
      </Suspense>

      <PublicFooter />
    </div>
  );
}
