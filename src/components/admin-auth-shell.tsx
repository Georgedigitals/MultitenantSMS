'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { ThemeToggle, useAdminTheme } from '@/components/admin-theme-provider';
import { LanguageSwitcher } from '@/components/language-provider';

export interface AdminAuthBrand {
  name: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  adminThemePreset?: 'ledger' | 'brand' | 'emerald' | 'custom';
  adminAccentColor?: string;
}

interface AdminAuthShellProps {
  brand: AdminAuthBrand;
  backHref?: string;
  backLabel?: string;
  panelEyebrow: string;
  panelHeadline: React.ReactNode;
  panelDescription: string;
  panelHighlights: string[];
  children: React.ReactNode;
}

export function AdminAuthShell({
  brand,
  backHref = '/',
  backLabel,
  panelEyebrow,
  panelHeadline,
  panelDescription,
  panelHighlights,
  children,
}: AdminAuthShellProps) {
  const { theme } = useAdminTheme();
  const platformName = brand.name?.trim() || 'School Platform';
  const resolvedBackLabel = backLabel || `Back to ${platformName}`;

  let resolvedAccent: string;
  let resolvedAccentFg = '#ffffff';
  if (brand.adminThemePreset === 'brand') {
    resolvedAccent = brand.accentColor || brand.primaryColor || '#17834b';
  } else if (brand.adminThemePreset === 'emerald') {
    resolvedAccent = theme === 'dark' ? '#10b981' : '#17834b';
  } else if (brand.adminThemePreset === 'custom' && brand.adminAccentColor) {
    resolvedAccent = brand.adminAccentColor;
  } else {
    resolvedAccent = theme === 'dark' ? '#f4f4f5' : '#141414';
    resolvedAccentFg = theme === 'dark' ? '#111110' : '#ffffff';
  }

  const accentStyle = {
    '--adm-accent': resolvedAccent,
    '--adm-accent-fg': resolvedAccentFg,
    '--adm-accent-subtle': `color-mix(in srgb, ${resolvedAccent} ${theme === 'dark' ? '14%' : '9%'}, transparent)`,
    '--adm-accent-border': `color-mix(in srgb, ${resolvedAccent} ${theme === 'dark' ? '32%' : '22%'}, transparent)`,
  } as React.CSSProperties;

  return (
    <main style={accentStyle} className="adm-shell min-h-svh flex flex-col">
      {/* Top Bar */}
      <header className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={platformName}
              className="h-9 w-9 shrink-0 rounded-lg border adm-divider bg-white object-contain p-1"
            />
          ) : (
            <span className="adm-btn-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[14px] font-bold">
              {platformName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 leading-tight">
            <span data-no-translate="true" className="block truncate text-[15px] font-semibold tracking-[-0.02em] adm-text-primary">
              {platformName}
            </span>
            <span className="mt-0.5 block truncate text-[11px] adm-text-muted">
              Platform administration
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <LanguageSwitcher variant="admin" />
          <ThemeToggle />
          <Link
            href={backHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border adm-divider adm-surface adm-surface-hover px-3 text-[12px] font-medium adm-text-secondary transition-colors"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            <span className="hidden sm:inline">{resolvedBackLabel}</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 gap-8 px-5 pb-10 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12 lg:px-12 lg:pb-12">
        {/* Left Editorial Ledger Panel */}
        <section
          className={`relative hidden min-h-[580px] flex-col justify-between overflow-hidden rounded-2xl border px-10 py-10 lg:flex xl:px-14 xl:py-14 ${
            theme === 'dark'
              ? 'border-white/10 bg-[#12151b] text-zinc-100'
              : 'border-[#1f1f1d] bg-[#141413] text-[#f5f4f0]'
          }`}
        >
          {/* Subtle architectural grid lines */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
              <ShieldCheck size={13} aria-hidden="true" className="text-zinc-300" />
              <span>{panelEyebrow}</span>
            </div>
            <span data-no-translate="true" className="font-mono text-[11px] text-zinc-400">
              {platformName}
            </span>
          </div>

          <div className="relative z-10 max-w-[500px] py-14">
            <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              Super Admin Console
            </p>
            <h1
              className="text-[clamp(2.4rem,3.8vw,3.75rem)] font-normal leading-[1.06] tracking-[-0.025em] text-[#f5f4f0]"
              style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
              {panelHeadline}
            </h1>
            <p className="mt-6 max-w-[420px] text-[15px] leading-7 text-zinc-300">
              {panelDescription}
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/12 pt-5 text-[12px] text-zinc-400">
            {panelHighlights.map((item, idx) => (
              <React.Fragment key={item}>
                {idx > 0 && <span className="h-1 w-1 rounded-full bg-zinc-500" aria-hidden="true" />}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Right Form Column */}
        <section className="flex items-center justify-center py-2 sm:py-6 lg:py-10">
          <div className="w-full max-w-[436px]">
            {children}
            <p className="mt-6 px-2 text-center text-[11px] leading-5 adm-text-muted">
              <span data-no-translate="true">{platformName}</span> administration{' '}
              <span className="px-1.5 opacity-50">·</span> School accounts remain strictly isolated and protected.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
