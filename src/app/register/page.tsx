'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { extractColorsFromImage } from '@/lib/color-extractor';
import { useLanguage } from '@/components/language-provider';
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
      .catch(() => {});
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
    <div className="register-content max-w-4xl w-full mx-auto my-10 px-4 sm:px-6 z-10">
      {/* Wizard Step Progress (5 Steps) */}
      <div className="register-progress mb-6">
        <div className="grid grid-cols-5 gap-2 sm:gap-4 max-w-3xl mx-auto mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`register-step flex flex-col items-center text-center gap-2 ${step === s ? 'is-current' : step > s ? 'is-complete' : ''}`}>
              <div
                className={`register-step-number w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-colors ${
                  step === s
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

            {/* Academic Levels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-[#425966] mb-2">
                  Lowest Class Level Offered
                </label>
                <select
                  value={lowestLevelName}
                  onChange={(e) => setLowestLevelName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-xs font-medium focus:outline-hidden"
                >
                  <option value="Nursery 1">Nursery 1</option>
                  <option value="Primary 1">Primary 1</option>
                  <option value="JSS 1">JSS 1</option>
                  <option value="SSS 1">SSS 1</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#425966] mb-2">
                  Highest Class Level Offered
                </label>
                <select
                  value={highestLevelName}
                  onChange={(e) => setHighestLevelName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#f4f7f5] border border-[#dce6e0] text-[#102d43] text-xs font-medium focus:outline-hidden"
                >
                  <option value="Primary 6">Primary 6</option>
                  <option value="JSS 3">JSS 3</option>
                  <option value="SSS 3">SSS 3</option>
                </select>
              </div>
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
                  className={`p-5 rounded-2xl border cursor-pointer text-left transition-colors flex flex-col justify-between focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                    templateId === 'heritage'
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
                  className={`p-5 rounded-2xl border cursor-pointer transition-colors flex flex-col justify-between ${
                    templateId === 'vanguard'
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
                  className={`p-5 rounded-2xl border cursor-pointer transition-colors flex flex-col justify-between ${
                    templateId === 'horizon'
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
                  className={`p-5 rounded-2xl border cursor-pointer text-left transition-colors flex flex-col justify-between focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                    planId === p.id
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

      {/* Interactive Live Website Preview Modal with Template Switching & Hero Slider */}
      {showLivePreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Simulated Browser Bar with Template Switcher */}
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>

              {/* Template Switcher Tabs inside Modal */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTemplateId('heritage')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    templateId === 'heritage'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Heritage
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateId('vanguard')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    templateId === 'vanguard'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Vanguard
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateId('horizon')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    templateId === 'horizon'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Horizon
                </button>
              </div>

              <div className="hidden sm:flex flex-1 max-w-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-1 items-center justify-center gap-2 text-xs text-slate-400 font-mono">
                <span className="truncate">{slug || 'brightstars'}.{rootDomain}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowLivePreviewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-sm transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Scrollable Public Website Preview Body */}
            <div className="flex-1 overflow-y-auto bg-slate-950 font-sans text-slate-100">
              {/* Public Header with Multi-Page Navigation */}
              <header className="px-6 py-4 bg-white/95 text-slate-900 border-b border-slate-200 flex items-center justify-between shadow-xs sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain shadow-xs" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {slug.substring(0, 2).toUpperCase() || 'BS'}
                    </div>
                  )}
                  <div>
                    <span className="font-extrabold text-base text-slate-900 block leading-tight">{schoolName || 'Bright Stars Academy'}</span>
                  <span className="text-xs text-slate-500 block">Academic portal</span>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-600">
                  <span className="text-blue-600 border-b-2 border-blue-600 pb-0.5">Home</span>
                  <span className="hover:text-slate-950">About Us</span>
                  <span className="hover:text-slate-950">Academics</span>
                  <span className="hover:text-slate-950">Admissions</span>
                  <span className="hover:text-slate-950">Gallery</span>
                  <span className="hover:text-slate-950">Contact</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700">Check Result</span>
                  <span
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    Portal Login
                  </span>
                </div>
              </header>

              {/* Template-Aware Interactive Hero Slider */}
              {(() => {
                const sampleHeroImage = heroImageUrl || (galleryImages[0]?.url) || null;
                const sampleSlides = [
                  {
                    title: motto ? `${schoolName || 'Bright Stars Academy'}` : `Welcome to ${schoolName || 'Bright Stars Academy'}`,
                    subtitle: heroSubheading,
                    imageUrl: sampleHeroImage,
                    tag: 'Admissions 2025/2026',
                  },
                  {
                    title: 'Academic Distinction & Moral Leadership',
                    subtitle: 'A world-class curriculum designed to unleash academic curiosity and global competitiveness.',
                    imageUrl: galleryImages[1]?.url || sampleHeroImage,
                    tag: 'Global Standards',
                  },
                  {
                    title: 'State-of-the-Art Learning & Innovation',
                    subtitle: 'Comprehensive STEM labs, modern sports arenas, and vibrant extracurricular programs.',
                    imageUrl: galleryImages[2]?.url || sampleHeroImage,
                    tag: 'Modern Campus Life',
                  },
                ];

                const currentSlide = sampleSlides[previewSlideIndex % sampleSlides.length];

                if (templateId === 'vanguard') {
                  return (
                    <section className="relative overflow-hidden bg-slate-950 text-white py-16 px-6 sm:px-10 border-b border-slate-900">
                      {currentSlide.imageUrl ? (
                        <div className="absolute inset-0 z-0">
                          <img src={currentSlide.imageUrl} alt="Hero" className="w-full h-full object-cover opacity-20 filter contrast-125" />
                          <div className="absolute inset-0 bg-slate-950/55" />
                        </div>
                      ) : null}

                      <div className="relative z-10 max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                          <span>{currentSlide.tag}</span>
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
                          {currentSlide.title}
                        </h2>
                        <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8 max-w-2xl font-light">
                          {currentSlide.subtitle}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="px-6 py-3 rounded-xl font-bold text-xs bg-cyan-400 text-slate-950 shadow-lg">
                            Apply for Admission
                          </span>
                          <span className="px-6 py-3 rounded-xl font-bold text-xs bg-white/10 border border-white/20 text-white">
                            Explore STEM Curriculum
                          </span>
                        </div>

                        {/* Slider controls */}
                        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-900">
                          <div className="text-xs text-slate-400 font-mono">Slide {previewSlideIndex + 1} of {sampleSlides.length}</div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewSlideIndex((p) => (p - 1 + sampleSlides.length) % sampleSlides.length)}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                            >
                              ← Prev Slide
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewSlideIndex((p) => (p + 1) % sampleSlides.length)}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                            >
                              Next Slide →
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                }

                if (templateId === 'horizon') {
                  return (
                    <section className="relative overflow-hidden bg-slate-900 text-white py-16 px-6 sm:px-10 border-b border-slate-800">
                      {currentSlide.imageUrl ? (
                        <div className="absolute inset-0 z-0">
                          <img src={currentSlide.imageUrl} alt="Hero" className="w-full h-full object-cover opacity-30" />
                          <div className="absolute inset-0 bg-slate-950/50" />
                        </div>
                      ) : null}

                      <div className="relative z-10 max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-4">
                          <span>{motto || 'Nurturing Potential & Character'}</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
                          {currentSlide.title}
                        </h2>
                        <p className="text-sm sm:text-base text-slate-200 leading-relaxed mb-8 max-w-xl mx-auto font-light">
                          {currentSlide.subtitle}
                        </p>
                        <div className="flex justify-center gap-3">
                          <span
                            className="px-6 py-3 rounded-2xl font-bold text-xs text-slate-950 shadow-lg"
                            style={{ backgroundColor: accentColor }}
                          >
                            Online Admission Inquiry
                          </span>
                          <span className="px-6 py-3 rounded-2xl font-bold text-xs bg-white/15 border border-white/20 text-white">
                            About Our Community
                          </span>
                        </div>

                        {/* Slider controls */}
                        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-800/80">
                          <div className="text-xs text-slate-400 font-mono">Slide {previewSlideIndex + 1} of {sampleSlides.length}</div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewSlideIndex((p) => (p - 1 + sampleSlides.length) % sampleSlides.length)}
                              className="p-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs"
                            >
                              ← Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewSlideIndex((p) => (p + 1) % sampleSlides.length)}
                              className="p-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                }

                // Default: Heritage Template
                return (
                  <section
                    className="relative overflow-hidden text-white py-16 px-6 sm:px-10 border-b border-white/10"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {currentSlide.imageUrl ? (
                      <div className="absolute inset-0 z-0">
                        <img src={currentSlide.imageUrl} alt="Hero" className="w-full h-full object-cover opacity-25 filter contrast-110" />
                        <div className="absolute inset-0 bg-slate-950/45" />
                      </div>
                    ) : null}

                    <div className="relative z-10 max-w-4xl mx-auto">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-serif bg-white/15 border border-white/20 mb-4 text-amber-300">
                        <span>{motto || 'Excellence • Integrity • Knowledge'}</span>
                      </div>
                      <h2 className="text-3xl sm:text-5xl font-serif font-black text-white mb-4 leading-tight">
                        {currentSlide.title}
                      </h2>
                      <p className="text-sm sm:text-base text-slate-200 leading-relaxed mb-8 max-w-2xl font-light">
                        {currentSlide.subtitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className="px-6 py-3 rounded-xl font-serif font-semibold text-sm text-slate-900"
                          style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
                        >
                          Apply for Admission
                        </span>
                        <span className="px-6 py-3 rounded-xl font-serif font-semibold text-sm bg-white/15 border border-white/25 text-white">
                          Institutional Heritage
                        </span>
                      </div>

                      {/* Slider controls */}
                      <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/15">
                        <div className="text-xs text-slate-300 font-mono">Slide {previewSlideIndex + 1} of {sampleSlides.length}</div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewSlideIndex((p) => (p - 1 + sampleSlides.length) % sampleSlides.length)}
                            className="p-1.5 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-serif"
                          >
                            ← Prev Slide
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewSlideIndex((p) => (p + 1) % sampleSlides.length)}
                            className="p-1.5 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-serif"
                          >
                            Next Slide →
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* Multi-Page Highlights Preview */}
              <section className="p-8 bg-slate-900 border-b border-slate-800">
                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-xs font-mono uppercase text-blue-400 font-bold block mb-1">About Us Page</span>
                    <h4 className="font-bold text-sm text-white mb-2">Heritage & Leadership</h4>
                    <p className="text-[11px] text-slate-400">Dedicated page with school history, mission, vision, anthem, and principal&apos;s address.</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-xs font-mono uppercase text-emerald-400 font-bold block mb-1">Academics Page</span>
                    <h4 className="font-bold text-sm text-white mb-2">{lowestLevelName} to {highestLevelName}</h4>
                    <p className="text-[11px] text-slate-400">Curricula frameworks, levels, subject offerings, and CBT digital examination halls.</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-xs font-mono uppercase text-amber-400 font-bold block mb-1">Admissions Page</span>
                    <h4 className="font-bold text-sm text-white mb-2">Online Application</h4>
                    <p className="text-[11px] text-slate-400">Interactive inquiry form, 4-step admission roadmap, and tuition fee guidelines.</p>
                  </div>
                </div>
              </section>

              {/* Campus Gallery Preview */}
              <section className="p-8 bg-slate-950">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-base text-white">Campus Gallery ({galleryImages.length} Photos)</h4>
                    <span className="text-xs font-mono text-blue-400">Dedicated /gallery route</span>
                  </div>
                  {galleryImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {galleryImages.map((img, idx) => (
                        <div key={idx} className="rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video">
                          <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                      No gallery images uploaded yet. Upload campus facilities in Step 4.
                    </div>
                  )}
                </div>
              </section>

              {/* Multi-Page Footer */}
              <footer className="p-6 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500">
                <div className="flex justify-center gap-6 mb-3 text-slate-400">
                  <span>Home</span>
                  <span>About</span>
                  <span>Academics</span>
                  <span>Admissions</span>
                  <span>Gallery</span>
                  <span>Contact</span>
                </div>
                © {new Date().getFullYear()} {schoolName || 'Bright Stars Academy'}. Powered by BMS Platform.
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegisterSchoolPage() {
  return (
    <div className="register-page min-h-screen bg-[#0A2E47] text-white flex flex-col justify-between font-sans selection:bg-[#17834b] selection:text-white relative">

      {/* Header */}
      <header className="border-b border-white/10 bg-[#0A2E47] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17834b] flex items-center justify-center font-black text-white text-xl">B</div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block">
                BMS
              </span>
              <span className="text-xs text-[#17834b] font-semibold block">
                School management for Nigerian schools
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-semibold text-white/75 hover:text-white transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <Suspense fallback={<div className="text-center py-20 text-[#5d6d78] text-sm">Loading registration form…</div>}>
        <RegisterFormContent />
      </Suspense>

      {/* Footer */}
      <footer className="text-center py-5 text-xs text-white/65 z-10 border-t border-white/10 bg-[#0A2E47]">
        © {new Date().getFullYear()} BMS · School management for Nigerian schools
      </footer>
    </div>
  );
}
