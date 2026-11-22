'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';

interface AdminSidebarProps {
  adminName?: string;
  adminEmail?: string;
  platformName?: string;
  logoUrl?: string;
}

// ── SVG Icon Set ──────────────────────────────────────────────────────────────
const Icons = {
  overview: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2 4a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H4a2 2 0 01-2-2V4zM2 13a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H4a2 2 0 01-2-2v-3zM11 4a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V4zM11 13a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2v-3z" />
    </svg>
  ),
  tenants: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
    </svg>
  ),
  plans: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  finance: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
    </svg>
  ),
  pins: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
    </svg>
  ),
  announcements: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
  ),
};

const navItems = [
  { key: 'admin.overview', label: 'Platform Overview', href: '/admin', icon: Icons.overview },
  { key: 'admin.tenants', label: 'Schools & Tenants', href: '/admin/tenants', icon: Icons.tenants },
  { key: 'admin.plans', label: 'Plan Tiers & Features', href: '/admin/plans', icon: Icons.plans },
  { key: 'admin.website', label: 'Public Website CMS', href: '/admin/website', icon: Icons.website },
  { key: 'admin.announcements', label: 'Broadcasts', href: '/admin/announcements', icon: Icons.announcements },
  { key: 'admin.leads', label: 'Leads & Inquiries', href: '/admin/leads', icon: Icons.leads },
  { key: 'admin.finance', label: 'Platform Finance', href: '/admin/finance', icon: Icons.finance },
  { key: 'admin.pins', label: 'Scratch Card PINs', href: '/admin/pins', icon: Icons.pins },
  { key: 'admin.auditLogs', label: 'System Audit Logs', href: '/admin/audit-logs', icon: Icons.audit },
  { key: 'admin.settings', label: 'Platform Settings', href: '/admin/settings', icon: Icons.settings },
];

export function AdminSidebar({
  adminName = 'Platform Admin',
  adminEmail = 'admin@platform.com',
  platformName = 'School Platform',
  logoUrl = '',
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

  const brandBadge = platformName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3) || 'SP';

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const initials = adminName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const NavLink = ({
    item,
    onClick,
    showLabel = true,
  }: {
    item: (typeof navItems)[0];
    onClick?: () => void;
    showLabel?: boolean;
  }) => {
    const isActive =
      item.href === '/admin'
        ? pathname === '/admin'
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        href={item.href}
        onClick={onClick}
        title={!showLabel ? item.label : undefined}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group
          ${isActive
            ? 'adm-text-accent'
            : 'adm-text-secondary adm-surface-hover'
          }
          ${!showLabel ? 'justify-center' : ''}
        `}
        style={isActive ? { background: 'var(--adm-accent-subtle)' } : undefined}
      >
        <span className={`shrink-0 transition-colors ${isActive ? 'adm-text-accent' : 'adm-text-muted'}`}>
          {item.icon}
        </span>
        {showLabel && <span className="truncate leading-tight">{t(item.key, item.label)}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* ─── Desktop Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex adm-sidebar border-r flex-col justify-between transition-[width] duration-300 z-40 sticky top-0 h-screen shrink-0 ${
          collapsed ? 'w-[60px]' : 'w-56'
        }`}
      >
        {/* Brand header */}
        <div>
          <div className={`h-14 flex items-center border-b adm-divider ${collapsed ? 'justify-center px-3' : 'justify-between px-4'}`}>
            <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={platformName}
                  className="w-7 h-7 rounded-md object-contain bg-white border adm-divider p-0.5 shrink-0"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 select-none"
                  style={{
                    backgroundColor: 'var(--adm-accent)',
                    color: 'var(--adm-accent-fg, #ffffff)',
                  }}
                >
                  {brandBadge}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0">
                  <span className="font-bold text-sm adm-text-primary block leading-tight truncate">
                    {platformName}
                  </span>
                  <span className="text-[10px] font-medium adm-text-muted block uppercase tracking-widest truncate">
                    Super Admin
                  </span>
                </div>
              )}
            </Link>

            {!collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="w-6 h-6 rounded-md adm-surface adm-surface-hover adm-text-muted hover:adm-text-secondary flex items-center justify-center transition-colors shrink-0"
                title="Collapse sidebar"
              >
                {Icons.chevronLeft}
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className={`py-3 space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
            {collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="w-full flex items-center justify-center py-2 mb-2 rounded-lg adm-text-muted adm-surface-hover transition-colors"
                title="Expand sidebar"
              >
                {Icons.chevronRight}
              </button>
            )}
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} showLabel={!collapsed} />
            ))}
          </nav>
        </div>

        {/* User footer */}
        <div className="p-3 border-t adm-divider space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg adm-surface border adm-divider">
              <div className="w-7 h-7 rounded-full adm-accent-subtle border adm-accent-border adm-text-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold adm-text-primary block truncate leading-tight">{adminName}</span>
                <span className="text-[10px] adm-text-muted block truncate">{adminEmail}</span>
              </div>
            </div>
          )}
          <form action="/api/admin/auth/logout" method="POST">
            <button
              type="submit"
              title="Sign Out"
              className={`w-full py-2 px-3 rounded-lg text-xs font-medium adm-text-muted hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors flex items-center gap-2 ${
                collapsed ? 'justify-center' : 'justify-start'
              }`}
            >
              {Icons.logout}
              {!collapsed && <span>Sign Out</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* ─── Mobile Top Bar ───────────────────────────────────────────────────── */}
      <header className="md:hidden adm-header border-b sticky top-0 z-40 h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg adm-text-secondary adm-surface-hover transition-colors"
            aria-label="Open navigation"
          >
            {Icons.menu}
          </button>
          <Link href="/admin" className="flex items-center gap-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={platformName}
                className="w-6 h-6 rounded-md object-contain bg-white border adm-divider p-0.5 shrink-0"
              />
            ) : (
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[9px]"
                style={{
                  backgroundColor: 'var(--adm-accent)',
                  color: 'var(--adm-accent-fg, #ffffff)',
                }}
              >
                {brandBadge.slice(0, 2)}
              </div>
            )}
            <span className="font-bold text-sm adm-text-primary">{platformName}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--adm-accent)' }}
          />
          <span className="text-[10px] font-medium adm-text-accent">Super Admin</span>
        </div>
      </header>

      {/* ─── Mobile Drawer ────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex-1 max-w-[280px] w-full adm-sidebar border-r flex flex-col justify-between p-4 z-10">
            <div>
              <div className="flex items-center justify-between pb-4 mb-3 border-b adm-divider">
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={platformName}
                      className="w-7 h-7 rounded-md object-contain bg-white border adm-divider p-0.5 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[10px]"
                      style={{
                        backgroundColor: 'var(--adm-accent)',
                        color: 'var(--adm-accent-fg, #ffffff)',
                      }}
                    >
                      {brandBadge}
                    </div>
                  )}
                  <div>
                    <span className="font-bold text-sm adm-text-primary block leading-tight">{platformName}</span>
                    <span className="text-[10px] font-medium adm-text-muted uppercase tracking-widest block">Super Admin</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg adm-text-muted adm-surface-hover transition-colors"
                >
                  {Icons.close}
                </button>
              </div>
              <nav className="space-y-0.5">
                {navItems.map((item) => (
                  <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
                ))}
              </nav>
            </div>

            <div className="pt-4 border-t adm-divider space-y-2">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg adm-surface border adm-divider">
                <div className="w-7 h-7 rounded-full adm-accent-subtle border adm-accent-border adm-text-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold adm-text-primary block truncate">{adminName}</span>
                  <span className="text-[10px] adm-text-muted block truncate">{adminEmail}</span>
                </div>
              </div>
              <form action="/api/admin/auth/logout" method="POST">
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-lg text-xs font-medium adm-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-2"
                >
                  {Icons.logout}
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
