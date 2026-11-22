'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';

interface TenantPublicHeaderProps {
  slug: string;
  tenantName: string;
  branding: {
    logoUrl?: string | null;
    primaryColor: string;
    accentColor: string;
    textOnPrimary?: string;
    textOnAccent?: string;
  };
}

export function TenantPublicHeader({ slug, tenantName, branding }: TenantPublicHeaderProps) {
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

  const navLinks = [
    { label: 'Home', href: resolveHref('/') },
    { label: 'About', href: resolveHref('/about') },
    { label: 'Academics', href: resolveHref('/academics') },
    { label: 'Admissions', href: resolveHref('/admissions') },
    { label: 'Gallery', href: resolveHref('/gallery') },
    { label: 'Contact', href: resolveHref('/contact') },
  ];

  const isActiveLink = (href: string) => {
    if (href === '/' || href === `/${slug}`) {
      return pathname === '/' || pathname === `/${slug}` || pathname === '';
    }
    return pathname.startsWith(href);
  };

  const primary = branding.primaryColor || '#141414';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e4e2dd]">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-6">
        {/* School Wordmark & Crest */}
        <Link href={resolveHref('/')} className="flex items-center gap-3 min-w-0">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={tenantName}
              className="h-10 w-auto object-contain shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 flex items-center justify-center font-semibold text-base shrink-0"
              style={{ backgroundColor: primary, color: textOnPrimary }}
            >
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-[16px] tracking-[-0.02em] text-[#0a0a0a] truncate max-w-[180px] sm:max-w-xs">
            {tenantName}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="Main navigation">
          {navLinks.map((item) => {
            const active = isActiveLink(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2 text-[14px] transition-colors border-b-2 ${
                  active
                    ? 'text-[#0a0a0a] font-medium border-[#0a0a0a]'
                    : 'text-[#66645e] border-transparent hover:text-[#0a0a0a]'
                }`}
              >
                {tp(item.label)}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <LanguageSwitcher variant="tenant" />
          <Link
            href={resolveHref('/results/check')}
            className="h-10 px-4 border border-[#d4d1ca] text-[13px] font-medium text-[#0a0a0a] hover:bg-[#f4f3f1] transition-colors inline-flex items-center whitespace-nowrap"
          >
            {tp('Check Results')}
          </Link>
          <Link
            href={resolveHref('/login')}
            className="h-10 px-5 text-[13px] font-medium transition-opacity hover:opacity-90 inline-flex items-center whitespace-nowrap"
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            {tp('Portal Login')}
          </Link>
        </div>

        {/* Mobile Controls */}
        <div className="flex lg:hidden items-center gap-2">
          <Link
            href={resolveHref('/results/check')}
            className="sm:hidden h-9 px-3 border border-[#d4d1ca] text-[12px] font-medium text-[#0a0a0a] inline-flex items-center"
          >
            Results
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="h-9 w-9 border border-[#d4d1ca] text-[#0a0a0a] hover:bg-[#f4f3f1] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#e4e2dd] bg-white px-5 py-5 space-y-5">
          <nav className="flex flex-col space-y-1" aria-label="Mobile navigation">
            {navLinks.map((item) => {
              const active = isActiveLink(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 text-[15px] transition-colors ${
                    active
                      ? 'bg-[#f4f3f1] text-[#0a0a0a] font-medium'
                      : 'text-[#4f4d48] hover:bg-[#f4f3f1] hover:text-[#0a0a0a]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-[#e4e2dd] flex flex-col gap-2.5">
            <Link
              href={resolveHref('/results/check')}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full h-11 px-4 border border-[#d4d1ca] text-[14px] font-medium text-[#0a0a0a] flex items-center justify-center"
            >
              Check student result
            </Link>
            <Link
              href={resolveHref('/login')}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full h-11 px-4 text-[14px] font-medium flex items-center justify-center"
              style={{ backgroundColor: primary, color: textOnPrimary }}
            >
              Sign in to school portal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
