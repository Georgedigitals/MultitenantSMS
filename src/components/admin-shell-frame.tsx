'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink, Plus, Search } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { ThemeToggle, useAdminTheme } from '@/components/admin-theme-provider';
import { AdminCommandPalette } from '@/components/admin-command-palette';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';

interface AdminShellFrameProps {
  adminName: string;
  adminEmail: string;
  platformName: string;
  logoUrl?: string;
  brandPrimaryColor?: string;
  brandAccentColor?: string;
  adminThemePreset?: 'ledger' | 'brand' | 'emerald' | 'custom';
  adminAccentColor?: string;
  children: React.ReactNode;
}

const ROUTE_TITLES: Array<{ match: string; label: string }> = [
  { match: '/admin/tenants', label: 'Schools & Tenants' },
  { match: '/admin/plans', label: 'Plan Tiers & Features' },
  { match: '/admin/website', label: 'Website Studio' },
  { match: '/admin/announcements', label: 'Broadcast Announcements' },
  { match: '/admin/leads', label: 'Leads & Inquiries' },
  { match: '/admin/finance', label: 'Platform Finance' },
  { match: '/admin/pins', label: 'Scratch Card PINs' },
  { match: '/admin/audit-logs', label: 'System Audit Logs' },
  { match: '/admin/settings', label: 'Platform Settings' },
  { match: '/admin', label: 'Platform Overview' },
];

export function AdminShellFrame({
  adminName,
  adminEmail,
  platformName,
  logoUrl,
  brandPrimaryColor,
  brandAccentColor,
  adminThemePreset = 'ledger',
  adminAccentColor,
  children,
}: AdminShellFrameProps) {
  const pathname = usePathname() || '/admin';
  const { theme } = useAdminTheme();
  const { t } = useLanguage();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isFullScreenEditor = pathname.startsWith('/admin/website/editor');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (isFullScreenEditor) {
    return <div className="min-h-screen flex flex-col font-sans">{children}</div>;
  }

  const currentSection =
    ROUTE_TITLES.find((r) =>
      r.match === '/admin' ? pathname === '/admin' : pathname.startsWith(r.match)
    )?.label || 'Platform Overview';

  // Resolve accent color from preset (while keeping dark mode crisp & legible)
  let resolvedAccent: string | undefined;
  let resolvedAccentFg = '#ffffff';
  if (adminThemePreset === 'brand') {
    resolvedAccent = brandAccentColor || brandPrimaryColor || '#17834b';
  } else if (adminThemePreset === 'emerald') {
    resolvedAccent = theme === 'dark' ? '#10b981' : '#17834b';
  } else if (adminThemePreset === 'custom' && adminAccentColor) {
    resolvedAccent = adminAccentColor;
  } else {
    // 'ledger' preset: high-contrast architectural ink in light mode, clean white/zinc in dark mode
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
    <div
      style={accentStyle}
      className="adm-shell min-h-screen flex flex-col md:flex-row font-sans"
    >
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        platformName={platformName}
        logoUrl={logoUrl}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header
          className="adm-header hidden md:flex border-b sticky top-0 z-30 h-14 px-6 items-center justify-between gap-4 backdrop-blur-sm"
          style={{ borderBottomColor: 'var(--adm-divider)' }}
        >
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Link
              href="/admin"
              className="adm-text-muted hover:adm-text-primary transition-colors truncate"
            >
              {platformName}
            </Link>
            <span className="adm-text-faint">/</span>
            <span className="font-semibold adm-text-primary truncate">
              {currentSection}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border adm-divider adm-surface adm-surface-hover adm-text-muted text-xs transition-colors cursor-pointer"
              title="Quick search (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('nav.search', 'Search...')}</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded adm-badge">Ctrl K</kbd>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border adm-divider adm-surface adm-surface-hover adm-text-secondary text-xs font-medium transition-colors"
            >
              <span>{t('nav.viewLiveSite', 'View Live Site')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <Link
              href="/admin/tenants"
              className="adm-btn-primary inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('nav.schools', 'Schools')}</span>
            </Link>

            <LanguageSwitcher variant="admin" />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-7 lg:p-9 max-w-screen-xl mx-auto w-full">
          {children}
        </main>

        <footer
          className="border-t py-4 px-6 text-center text-xs adm-text-muted"
          style={{ borderTopColor: 'var(--adm-divider)' }}
        >
          {platformName} · Platform administration
        </footer>
      </div>

      <AdminCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
