'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getDefaultFooterColumns,
  type CmsBrandConfig,
} from '@/lib/public-site-cms-schema';
import { useLanguage } from '@/components/language-provider';

interface PublicFooterProps {
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
  footerNote: 'School management for the people who keep each school day moving.',
};

export function PublicFooter({
  brand: initialBrand,
  disableNavigation = false,
  previewViewport,
}: PublicFooterProps) {
  const { t, tp } = useLanguage();
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

  const columns =
    Array.isArray(brand.footerColumns) && brand.footerColumns.length > 0
      ? brand.footerColumns
      : getDefaultFooterColumns(brand.name);

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

  const gridClass =
    previewViewport === 'mobile'
      ? 'grid-cols-1'
      : previewViewport === 'tablet'
      ? 'grid-cols-2'
      : 'grid-cols-1 md:grid-cols-4';

  return (
    <footer
      className="mt-auto border-t border-white/10 pt-16 pb-12 sm:pt-24 text-white/80"
      style={{ backgroundColor: brand.primaryColor }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Oversized Editorial Platform Wordmark */}
        <div className="pb-12 mb-12 border-b border-white/15">
          <Link
            href="/"
            onClick={handleNavClick}
            className="tenant-editorial-display block text-[44px] sm:text-[68px] lg:text-[88px] leading-[0.95] tracking-[-0.03em] text-white hover:opacity-90 transition-opacity break-words"
          >
            {brand.name}
          </Link>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
            {tp(brand.footerNote || 'School management for the people who keep each school day moving.')}
          </p>
        </div>

        <div className={`grid gap-8 border-b border-white/15 pb-12 ${gridClass}`}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt={brand.name} className="h-9 w-auto object-contain" />
              ) : (
                <div
                  className="grid h-9 w-9 place-items-center text-xs font-bold text-white"
                  style={{ backgroundColor: brand.accentColor }}
                >
                  {monogram}
                </div>
              )}
              <span className="text-base font-semibold tracking-tight text-white">{brand.name}</span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-white/65">
              {tp(brand.tagline || 'Multi-Tenant School Management Platform')}
            </p>
          </div>

          {columns.map((col, idx) => (
            <div key={idx}>
              <h4 className="mb-4 text-xs font-bold text-white">{tp(col.heading)}</h4>
              <ul className="space-y-2.5 text-xs text-white/75">
                {col.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    <Link
                      href={link.href}
                      onClick={handleNavClick}
                      className="transition-colors hover:text-white"
                    >
                      {tp(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center pt-8 text-xs text-white/60">
          <div>
            {brand.footerCopyright?.trim() ||
              `© ${new Date().getFullYear()} ${brand.name}. ${t('common.allRightsReserved', 'All rights reserved.')}`}
          </div>
        </div>
      </div>
    </footer>
  );
}
