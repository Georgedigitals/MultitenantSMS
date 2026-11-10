'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, LogIn, Menu, X, GraduationCap, Sparkles } from 'lucide-react';

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

  const isSlugPath = pathname.startsWith(`/${slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) {
      return path === '/' ? `/${slug}` : `/${slug}${path}`;
    }
    return path;
  };

  const navLinks = [
    { label: 'Home', href: resolveHref('/') },
    { label: 'About Us', href: resolveHref('/about') },
    { label: 'Academics', href: resolveHref('/academics') },
    { label: 'Admissions', href: resolveHref('/admissions'), badge: 'Apply' },
    { label: 'Gallery', href: resolveHref('/gallery') },
    { label: 'Contact', href: resolveHref('/contact') },
  ];

  const isActiveLink = (href: string) => {
    if (href === '/' || href === `/${slug}`) {
      return pathname === '/' || pathname === `/${slug}` || pathname === '';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link href={resolveHref('/')} className="flex items-center gap-3 group">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={tenantName}
              className="h-10 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-xs shrink-0 transition-transform group-hover:scale-105"
              style={{ backgroundColor: branding.primaryColor, color: branding.textOnPrimary || '#FFFFFF' }}
            >
              {tenantName.charAt(0)}
            </div>
          )}
          <div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 block truncate max-w-[170px] sm:max-w-xs group-hover:text-blue-600 transition-colors">
              {tenantName}
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block -mt-0.5">
              Academic Portal
            </span>
          </div>
        </Link>

        {/* Desktop Multi-Page Navigation */}
        <nav className="hidden lg:flex items-center gap-1.5 text-sm font-semibold">
          {navLinks.map((item) => {
            const active = isActiveLink(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  active
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
                }`}
                style={active ? { backgroundColor: branding.primaryColor } : undefined}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/20 text-white' : 'text-white'
                    }`}
                    style={!active ? { backgroundColor: branding.accentColor } : undefined}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Quick Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href={resolveHref('/results/check')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all shadow-2xs whitespace-nowrap flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Check Result</span>
          </Link>
          <Link
            href={resolveHref('/login')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:opacity-95 transition-all whitespace-nowrap flex items-center gap-1.5"
            style={{ backgroundColor: branding.accentColor, color: branding.textOnAccent || '#FFFFFF' }}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Portal Login</span>
          </Link>
        </div>

        {/* Mobile Hamburger Trigger */}
        <div className="flex lg:hidden items-center gap-2">
          <Link
            href={resolveHref('/results/check')}
            className="sm:hidden px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Results</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/98 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3 shadow-2xl">
          <nav className="flex flex-col space-y-1 py-1">
            {navLinks.map((item) => {
              const active = isActiveLink(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  style={active ? { backgroundColor: branding.primaryColor } : undefined}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: branding.accentColor }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
            <Link
              href={resolveHref('/results/check')}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 px-4 rounded-xl text-center text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Check Student Result</span>
            </Link>
            <Link
              href={resolveHref('/login')}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 px-4 rounded-xl text-center text-xs font-bold text-white shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: branding.accentColor, color: branding.textOnAccent || '#FFFFFF' }}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to School Portal</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
