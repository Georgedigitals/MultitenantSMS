'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, FileCheck2, ShieldCheck } from 'lucide-react';
import { getTemplateThemeTokens, type TenantTemplateId } from '@/lib/template-theme';

interface TenantAuthShellProps {
  slug: string;
  schoolName: string;
  motto?: string;
  templateId: TenantTemplateId;
  branding: {
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
    textOnPrimary?: string;
    textOnAccent?: string;
  };
  heading: string;
  subheading: string;
  children: React.ReactNode;
}

export function TenantAuthShell({
  slug,
  schoolName,
  motto,
  templateId,
  branding,
  heading,
  subheading,
  children,
}: TenantAuthShellProps) {
  const pathname = usePathname() || '';
  const isPathRouted = pathname.startsWith(`/${slug}`);
  const homeHref = isPathRouted ? `/${slug}` : '/';
  const resultsHref = isPathRouted ? `/${slug}/results/check` : '/results/check';

  const primary = branding.primaryColor || '#1D3251';
  const accent = branding.accentColor || '#C8A45D';
  const textOnAccent = branding.textOnAccent || '#171614';
  const theme = getTemplateThemeTokens(templateId, primary, accent);

  return (
    <div
      className="min-h-screen grid grid-cols-1 lg:grid-cols-12 text-[#171614] antialiased"
      style={{
        backgroundColor: theme.canvasBg,
        ['--brand-primary' as any]: primary,
        ['--brand-accent' as any]: accent,
      }}
    >
      {/* Left Brand Showcase Panel (Desktop) */}
      <aside
        className="hidden lg:flex lg:col-span-5 relative overflow-hidden flex-col justify-between p-10 xl:p-12 text-white"
        style={{ backgroundColor: theme.deepBandBg }}
      >
        {/* Template-Specific Subtle Decorative Geometry */}
        {templateId === 'horizon' ? (
          <div
            className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full opacity-20 pointer-events-none"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
        ) : templateId === 'vanguard' ? (
          <div
            className="absolute -bottom-24 -right-16 h-80 w-80 opacity-20 pointer-events-none"
            style={{
              backgroundColor: accent,
              borderRadius: '54% 46% 48% 52% / 44% 55% 45% 56%',
            }}
            aria-hidden="true"
          />
        ) : (
          <div
            className="absolute -bottom-16 -right-16 h-72 w-56 rounded-t-full border border-white/15 pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Top Brand Crest */}
        <div className="relative z-10 flex items-center gap-3">
          <Link href={homeHref} className="flex items-center gap-3 group">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={schoolName}
                className="h-11 w-11 rounded-xl object-contain bg-white p-1.5 shadow-sm shrink-0"
              />
            ) : (
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm shrink-0"
                style={{ backgroundColor: accent, color: textOnAccent }}
              >
                {schoolName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[16px] font-semibold tracking-[-0.01em] text-white truncate">
                {schoolName}
              </p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                Official School Portal
              </p>
            </div>
          </Link>
        </div>

        {/* Center Institutional Statement */}
        <div className="relative z-10 space-y-6 my-12">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#FFFFFF' }}
          >
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: accent }} />
            Secure Tenant Workspace
          </span>

          <h2 className={`${theme.headingClass} text-[34px] xl:text-[40px] leading-[1.1] text-white`}>
            {schoolName}
          </h2>

          <p className="text-[15px] leading-[1.7] text-white/80 max-w-md">
            {motto || 'One unified portal for school administrators, faculty, parents, and students.'}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {['School Admin', 'Teachers', 'Students', 'Parents'].map((role) => (
              <span
                key={role}
                className="px-3 py-1 rounded-full text-[11.5px] font-medium bg-white/10 text-white/90 border border-white/15"
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Shortcut: Term Result Checker */}
        <div className="relative z-10 space-y-4">
          <Link
            href={resultsHref}
            className="block rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 p-4 transition-colors group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: accent, color: textOnAccent }}
                >
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white">Checking a term report card?</p>
                  <p className="text-[11.5px] text-white/70 truncate">Open the public Result Checker PIN portal</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-white/75 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </Link>

          <p className="text-[11px] text-white/50">
            © {new Date().getFullYear()} {schoolName}. All rights reserved.
          </p>
        </div>
      </aside>

      {/* Right Auth Form Panel */}
      <main className="lg:col-span-7 flex flex-col min-h-screen">
        {/* Top Utility Bar */}
        <header className="w-full px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href={homeHref} className="flex lg:hidden items-center gap-2.5 min-w-0">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={schoolName}
                className="h-8 w-8 rounded-lg object-contain bg-white border border-black/10 p-1 shrink-0"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                style={{ backgroundColor: primary, color: branding.textOnPrimary || '#FFFFFF' }}
              >
                {schoolName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-[14.5px] text-[#171614] truncate max-w-[180px]">
              {schoolName}
            </span>
          </Link>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <Link
              href={resultsHref}
              className="lg:hidden text-[12px] font-semibold underline underline-offset-4"
              style={{ color: primary }}
            >
              Results
            </Link>
            <Link
              href={homeHref}
              className={`h-9 px-3.5 ${theme.buttonRadius} border ${theme.borderClass} bg-white text-[12.5px] font-medium text-[#171614] hover:bg-black/5 transition-colors inline-flex items-center gap-1.5`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>School website</span>
            </Link>
          </div>
        </header>

        {/* Centered Form Card */}
        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8">
          <div className="w-full max-w-[440px]">
            <div className={`bg-white border ${theme.borderClass} ${theme.cardRadius} p-7 sm:p-9 shadow-sm space-y-6`}>
              <div className="space-y-1.5">
                <h1 className={`${theme.headingClass} text-[28px] sm:text-[32px] leading-[1.1] text-[#171614]`}>
                  {heading}
                </h1>
                <p className="text-[13.5px] leading-[1.6] text-[#5c5952]">{subheading}</p>
              </div>

              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
