'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';

interface TenantPublicHeaderProps {
  slug: string;
  tenantName: string;
  templateId?: 'heritage' | 'vanguard' | 'horizon';
  contact?: {
    phone?: string | null;
    email?: string | null;
  };
  branding: {
    logoUrl?: string | null;
    primaryColor: string;
    accentColor: string;
    textOnPrimary?: string;
    textOnAccent?: string;
  };
}

export function TenantPublicHeader({
  slug,
  tenantName,
  templateId = 'heritage',
  contact,
  branding,
}: TenantPublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname() || '';
  const { tp } = useLanguage();

  const isSlugPath = pathname.startsWith(`/${slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) {
      return path === '/' ? `/${slug}` : `/${slug}${path}`;
    }
    return path;
  };

  const academicsLabel =
    templateId === 'vanguard' ? 'Classes' : templateId === 'horizon' ? 'Programs' : 'Academics';

  const navLinks = [
    ...(templateId === 'horizon' ? [] : [{ label: 'Home', href: resolveHref('/') }]),
    { label: 'About', href: resolveHref('/about') },
    { label: academicsLabel, href: resolveHref('/academics') },
    { label: 'Admissions', href: resolveHref('/admissions') },
    { label: 'News & Events', href: resolveHref('/news') },
    { label: 'Gallery', href: resolveHref('/gallery') },
    { label: 'Contact', href: resolveHref('/contact') },
  ];

  const isActiveLink = (href: string) => {
    if (href === '/' || href === `/${slug}`) {
      return pathname === '/' || pathname === `/${slug}` || pathname === '';
    }
    return pathname.startsWith(href);
  };

  const primary = branding.primaryColor || '#1e3a5f';
  const accent = branding.accentColor || '#c59b43';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const textOnAccent = branding.textOnAccent || '#FFFFFF';

  const isHeritage = templateId === 'heritage';
  const isVanguard = templateId === 'vanguard';
  const isHorizon = templateId === 'horizon';

  // ─── HERITAGE: Classic Utility Top Bar + Centered Crest + Hairline Nav ───────
  if (isHeritage) {
    return (
      <header id="top" className="sticky top-0 z-50 bg-[#F8F5EE]/95 backdrop-blur-md border-b border-[#E5DEC9]">
        {/* Deep Brand Utility Bar */}
        <div
          className="text-[11px] font-medium"
          style={{
            backgroundColor: `color-mix(in srgb, ${primary} 88%, #0c1420)`,
            color: textOnPrimary,
          }}
        >
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-9 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 opacity-85 truncate">
              {contact?.phone && <span className="truncate">{contact.phone}</span>}
              {contact?.email && <span className="hidden sm:inline truncate">{contact.email}</span>}
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="hidden sm:block">
                <LanguageSwitcher variant="public" />
              </div>
              <Link href={resolveHref('/results/check')} className="hover:underline opacity-90">
                {tp('Check Results')}
              </Link>
              <Link href={resolveHref('/login')} className="font-semibold hover:underline">
                {tp('Parent Portal')}
              </Link>
            </div>
          </div>
        </div>

        {/* Centered Crest + Brand Row */}
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between lg:justify-center relative">
          <Link href={resolveHref('/')} className="flex flex-col items-start lg:items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-2.5 lg:flex-col lg:gap-1.5">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={tenantName}
                  className="h-10 w-10 rounded-full object-contain bg-white border border-[#E5DEC9] p-1 shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-serif font-semibold text-base border shrink-0"
                  style={{ borderColor: primary, color: primary, backgroundColor: '#FFFFFF' }}
                >
                  {tenantName.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                data-no-translate="true"
                className="tenant-editorial-display text-[20px] sm:text-[22px] tracking-[-0.01em] text-[#171614] truncate max-w-[240px] sm:max-w-md"
              >
                {tenantName}
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden h-9 w-9 rounded-md border border-[#D8D0BE] text-[#171614] flex items-center justify-center cursor-pointer"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Classic Centered Horizontal Nav Bar */}
        <nav
          className="hidden lg:flex items-center justify-center gap-8 border-t border-[#E8E2D2] py-2.5 px-8"
          aria-label="Main navigation"
        >
          {navLinks.map((item) => {
            const active = isActiveLink(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[11px] uppercase tracking-[0.14em] transition-colors py-1 border-b-2 ${active ? 'font-semibold text-[#171614]' : 'text-[#666055] border-transparent hover:text-[#171614]'
                  }`}
                style={active ? { borderColor: primary } : undefined}
              >
                {tp(item.label)}
              </Link>
            );
          })}
        </nav>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E5DEC9] bg-[#F8F5EE] px-5 py-4 space-y-4">
            <nav className="flex flex-col space-y-1">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-[#171614] hover:bg-black/5 rounded"
                >
                  {tp(item.label)}
                </Link>
              ))}
            </nav>
            <div className="pt-3 border-t border-[#E5DEC9] flex flex-col gap-2">
              <Link
                href={resolveHref('/admissions')}
                onClick={() => setMobileMenuOpen(false)}
                className="h-10 flex items-center justify-center text-xs font-semibold uppercase tracking-wider"
                style={{ backgroundColor: primary, color: textOnPrimary }}
              >
                {tp('Apply for Admission')}
              </Link>
            </div>
          </div>
        )}
      </header>
    );
  }

  // ─── HORIZON & VANGUARD: Clean Single-Row Pill Header ────────────────────────
  const headerBg = isVanguard ? 'bg-[#FBF8F1]/95 border-[#EFE7D6]' : 'bg-[#FAF9F5]/95 border-[#E6E4DC]';
  const ctaColor = isHorizon ? accent : primary;
  const ctaText = isHorizon ? textOnAccent : textOnPrimary;

  return (
    <header id="top" className={`sticky top-0 z-50 backdrop-blur-md border-b ${headerBg}`}>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-18 flex items-center justify-between gap-4">
        <Link href={resolveHref('/')} className="flex items-center gap-2.5 min-w-0">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={tenantName}
              className="h-9 w-9 rounded-xl object-contain bg-white border border-black/10 p-1 shrink-0"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
              style={{ backgroundColor: primary, color: textOnPrimary }}
            >
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
          <span
            data-no-translate="true"
            className="font-semibold text-[15.5px] tracking-[-0.02em] text-[#171614] truncate max-w-[180px] sm:max-w-xs"
          >
            {tenantName}
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-5" aria-label="Main navigation">
          {navLinks.map((item) => {
            const active = isActiveLink(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-1.5 text-[12.5px] transition-colors border-b-2 ${active
                  ? 'font-semibold text-[#171614]'
                  : 'text-[#5c5952] border-transparent hover:text-[#171614]'
                  }`}
                style={active ? { borderColor: primary, color: primary } : undefined}
              >
                {tp(item.label)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <LanguageSwitcher variant="tenant" />
          <Link
            href={resolveHref('/results/check')}
            className="text-[12px] font-medium text-[#5c5952] hover:text-[#171614] transition-colors whitespace-nowrap"
          >
            {tp('Results')}
          </Link>
          <Link
            href={resolveHref('/login')}
            className="text-[12px] font-medium text-[#5c5952] hover:text-[#171614] transition-colors whitespace-nowrap"
          >
            {tp('Portal')}
          </Link>
          <Link
            href={resolveHref('/admissions')}
            className="h-9 px-5 rounded-full text-[12.5px] font-semibold transition-opacity hover:opacity-90 inline-flex items-center whitespace-nowrap shadow-xs"
            style={{ backgroundColor: ctaColor, color: ctaText }}
          >
            {tp('Apply now')}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden h-9 w-9 rounded-full border border-black/15 bg-white text-[#171614] flex items-center justify-center cursor-pointer"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-black/10 bg-white px-5 py-5 space-y-4">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl text-[14px] font-medium text-[#171614] hover:bg-black/5"
              >
                {tp(item.label)}
              </Link>
            ))}
          </nav>
          <div className="pt-3 border-t border-black/10 grid grid-cols-2 gap-2">
            <Link
              href={resolveHref('/results/check')}
              onClick={() => setMobileMenuOpen(false)}
              className="h-10 rounded-full border border-black/15 flex items-center justify-center text-xs font-semibold text-[#171614]"
            >
              {tp('Check Results')}
            </Link>
            <Link
              href={resolveHref('/login')}
              onClick={() => setMobileMenuOpen(false)}
              className="h-10 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ backgroundColor: primary, color: textOnPrimary }}
            >
              {tp('Portal Login')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
