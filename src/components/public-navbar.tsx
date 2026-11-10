'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function PublicNavbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Platform', href: '/services' },
    { label: 'Plans', href: '/pricing' },
    { label: 'Schools', href: '/schools' },
    { label: 'About', href: '/about' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#092b45] text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        {/* Brand */}
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#17834b] text-lg font-bold text-white transition-colors group-hover:bg-[#20a15d]">
            B
          </div>
          <div>
            <span className="block text-[15px] font-bold leading-tight tracking-[-.02em] text-white">BMS</span>
            <span className="block pt-0.5 text-[9px] font-semibold uppercase tracking-[.12em] text-[#a9c0ce]">School management</span>
          </div>
        </Link>

        {/* Center Nav (Desktop) */}
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`py-2 text-[13px] font-semibold transition-colors ${
                  isActive
                    ? 'text-[#68d28f]'
                    : 'text-[#d1dce3] hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Action CTAs (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/admin/login"
            className="px-2 py-2 text-[13px] font-semibold text-[#d1dce3] transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-[#17834b] px-4 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-[#126b3d]"
          >
            Set up your school
          </Link>
        </div>

        {/* Mobile Hamburger Trigger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md border border-white/35 px-3 py-2.5 text-xs font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#68d28f]"
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
        <div className="space-y-4 border-t border-white/10 bg-[#092b45] px-5 pb-6 pt-3 sm:px-8 md:hidden">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-md px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white/10 text-[#68d28f]' : 'text-[#d1dce3] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-2.5 border-t border-white/15 pt-3">
            <Link
              href="/schools"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full rounded-md border border-white/30 px-4 py-3 text-center text-xs font-semibold text-white hover:bg-white/10"
            >
              Find your school portal →
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full rounded-md bg-[#17834b] px-4 py-3 text-center text-xs font-bold text-white hover:bg-[#126b3d]"
            >
              Set up your school
            </Link>
            <Link
              href="/admin/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full rounded-md px-4 py-2.5 text-center text-xs font-medium text-[#d1dce3] hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
