'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DEFAULT_NAV_LINKS,
  type CmsBrandConfig,
} from '@/lib/public-site-cms-schema';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';

interface PublicNavbarProps {
  brand?: Partial<CmsBrandConfig>;
  disableNavigation?: boolean;
  previewViewport?: 'desktop' | 'tablet' | 'mobile';
}

const DEFAULT_BRAND: CmsBrandConfig = {
  name: 'School Platform',
  tagline: 'School management',
  logoUrl: '',
  primaryColor: '#092b45',
  accentColor: '#17834b',
  footerNote: '',
  headerCtaLabel: 'Set up your school',
  headerCtaHref: '/register',
  showSignInLink: true,
  navLinks: DEFAULT_NAV_LINKS,
};

export function PublicNavbar({
  brand: initialBrand,
  disableNavigation = false,
  previewViewport,
}: PublicNavbarProps) {
  const pathname = usePathname();
  const { t, tp } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [brand, setBrand] = useState<CmsBrandConfig>({
    ...DEFAULT_BRAND,
    ...(initialBrand || {}),
  });

  useEffect(() => {
    if (initialBrand) {
      setBrand((prev) => ({ ...prev, ...initialBrand }));
      return;
    }
    let active = true;
    fetch('/api/platform/branding')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.name) {
          setBrand((prev) => ({
            ...prev,
            ...data,
          }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [initialBrand]);

  const navLinks =
    Array.isArray(brand.navLinks) && brand.navLinks.length > 0
      ? brand.navLinks
      : DEFAULT_NAV_LINKS;

  const isForcedMobile = previewViewport === 'mobile';
  const isForcedDesktop = previewViewport === 'desktop' || previewViewport === 'tablet';

  const monogram =
    brand.name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'SP';

  const handleNavClick = (e: React.MouseEvent) => {
    if (disableNavigation) e.preventDefault();
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 text-white backdrop-blur-md"
      style={{ backgroundColor: `color-mix(in srgb, ${brand.primaryColor} 94%, transparent)` }}
    >
      <div className="mx-auto flex h-[74px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10 gap-4">
        {/* Brand */}
        <Link href="/" onClick={handleNavClick} className="group flex shrink-0 items-center gap-3 min-w-0">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="h-9 w-auto rounded-lg object-contain" />
          ) : (
            <div
              className="grid h-9 w-9 place-items-center rounded-lg text-xs font-bold text-white shrink-0 shadow-xs"
              style={{ backgroundColor: brand.accentColor }}
            >
              {monogram}
            </div>
          )}
          <div className="min-w-0">
            <span data-no-translate="true" className="block text-[15.5px] font-semibold leading-tight tracking-[-0.02em] text-white truncate">
              {brand.name}
            </span>
            <span className="block pt-0.5 text-[11px] font-normal text-white/60 truncate max-w-[180px]">
              {brand.tagline || 'School management'}
            </span>
          </div>
        </Link>

        {/* Center Nav (Desktop) */}
        <nav
          className={
            isForcedMobile
              ? 'hidden'
              : isForcedDesktop
              ? 'flex items-center gap-1'
              : 'hidden items-center gap-1 md:flex'
          }
        >
          {navLinks.map((link, i) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={`${link.href}-${i}`}
                href={link.href}
                onClick={handleNavClick}
                className={`px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white/12 text-white'
                    : 'text-white/72 hover:bg-white/6 hover:text-white'
                }`}
              >
                {tp(link.label)}
              </Link>
            );
          })}
        </nav>

        {/* Action CTAs (Desktop) */}
        <div
          className={
            isForcedMobile
              ? 'hidden'
              : isForcedDesktop
              ? 'flex items-center gap-2.5 shrink-0'
              : 'hidden md:flex items-center gap-2.5 shrink-0'
          }
        >
          {!disableNavigation && <LanguageSwitcher variant="public" />}
          {brand.showSignInLink !== false && (
            <Link
              href="/admin/login"
              onClick={handleNavClick}
              className="px-3 py-2 rounded-lg text-[13px] font-medium text-white/80 transition-colors hover:bg-white/8 hover:text-white whitespace-nowrap"
            >
              {t('nav.signIn', 'Sign in')}
            </Link>
          )}
          {brand.headerCtaLabel && (
            <Link
              href={brand.headerCtaHref || '/register'}
              onClick={handleNavClick}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 shadow-xs inline-flex items-center whitespace-nowrap"
              style={{ backgroundColor: brand.accentColor }}
            >
              {tp(brand.headerCtaLabel)}
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Trigger */}
        <div
          className={
            isForcedMobile
              ? 'flex items-center gap-2'
              : isForcedDesktop
              ? 'hidden'
              : 'flex md:hidden items-center gap-2'
          }
        >
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md border border-white/35 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          className={`space-y-4 border-t border-white/10 px-5 pb-6 pt-3 sm:px-8 ${
            isForcedDesktop ? 'hidden' : isForcedMobile ? 'block' : 'md:hidden'
          }`}
          style={{ backgroundColor: brand.primaryColor }}
        >
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link, i) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={`${link.href}-${i}`}
                  href={link.href}
                  onClick={(e) => {
                    handleNavClick(e);
                    setMobileMenuOpen(false);
                  }}
                  className={`rounded-md px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-2.5 border-t border-white/15 pt-3">
            {brand.headerCtaLabel && (
              <Link
                href={brand.headerCtaHref || '/register'}
                onClick={(e) => {
                  handleNavClick(e);
                  setMobileMenuOpen(false);
                }}
                className="w-full rounded-md px-4 py-3 text-center text-xs font-bold text-white"
                style={{ backgroundColor: brand.accentColor }}
              >
                {brand.headerCtaLabel}
              </Link>
            )}
            {brand.showSignInLink !== false && (
              <Link
                href="/admin/login"
                onClick={(e) => {
                  handleNavClick(e);
                  setMobileMenuOpen(false);
                }}
                className="w-full rounded-md px-4 py-2.5 text-center text-xs font-medium text-white/80 hover:text-white"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
