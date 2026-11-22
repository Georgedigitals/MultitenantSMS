'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Globe,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

interface AdminSidebarProps {
  adminName?: string;
  adminEmail?: string;
  platformName?: string;
  logoUrl?: string;
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Operations',
    items: [
      { key: 'admin.overview', label: 'Platform Overview', href: '/admin', icon: <LayoutDashboard size={15} strokeWidth={1.9} /> },
      { key: 'admin.tenants', label: 'Schools & Tenants', href: '/admin/tenants', icon: <Building2 size={15} strokeWidth={1.9} /> },
      { key: 'admin.plans', label: 'Plan Tiers & Features', href: '/admin/plans', icon: <Layers size={15} strokeWidth={1.9} /> },
    ],
  },
  {
    title: 'Growth & Web',
    items: [
      { key: 'admin.website', label: 'Public Website CMS', href: '/admin/website', icon: <Globe size={15} strokeWidth={1.9} /> },
      { key: 'admin.announcements', label: 'Broadcasts', href: '/admin/announcements', icon: <Megaphone size={15} strokeWidth={1.9} /> },
      { key: 'admin.leads', label: 'Leads & Inquiries', href: '/admin/leads', icon: <Inbox size={15} strokeWidth={1.9} /> },
    ],
  },
  {
    title: 'Billing & Control',
    items: [
      { key: 'admin.finance', label: 'Platform Finance', href: '/admin/finance', icon: <CreditCard size={15} strokeWidth={1.9} /> },
      { key: 'admin.pins', label: 'Scratch Card PINs', href: '/admin/pins', icon: <KeyRound size={15} strokeWidth={1.9} /> },
      { key: 'admin.auditLogs', label: 'System Audit Logs', href: '/admin/audit-logs', icon: <ShieldCheck size={15} strokeWidth={1.9} /> },
      { key: 'admin.settings', label: 'Platform Settings', href: '/admin/settings', icon: <Settings size={15} strokeWidth={1.9} /> },
    ],
  },
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

  const brandBadge =
    platformName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'SP';

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
    item: NavItem;
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
        className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 group
          ${isActive ? 'font-semibold adm-text-primary' : 'font-medium adm-text-secondary adm-surface-hover'}
          ${!showLabel ? 'justify-center' : ''}
        `}
        style={isActive ? { background: 'var(--adm-accent-subtle)' } : undefined}
      >
        {isActive && showLabel && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full"
            style={{ backgroundColor: 'var(--adm-accent)' }}
          />
        )}
        <span
          className={`shrink-0 transition-colors ${
            isActive ? 'adm-text-accent' : 'adm-text-muted group-hover:adm-text-primary'
          }`}
        >
          {item.icon}
        </span>
        {showLabel && <span className="truncate leading-tight">{t(item.key, item.label)}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex adm-sidebar border-r flex-col justify-between transition-[width] duration-200 z-40 sticky top-0 h-screen shrink-0 ${
          collapsed ? 'w-[64px]' : 'w-[244px]'
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Header */}
          <div
            className={`h-14 flex items-center border-b adm-divider shrink-0 ${
              collapsed ? 'justify-center px-3' : 'justify-between px-4'
            }`}
          >
            <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={platformName}
                  className="w-7 h-7 rounded-lg object-contain bg-white border adm-divider p-0.5 shrink-0"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 select-none"
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
                  <span data-no-translate="true" className="font-semibold text-[13.5px] adm-text-primary block leading-tight truncate">
                    {platformName}
                  </span>
                  <span className="text-[10px] font-medium adm-text-muted block tracking-wide truncate">
                    Control Plane
                  </span>
                </div>
              )}
            </Link>

            {!collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="w-6 h-6 rounded-md adm-surface-hover adm-text-muted hover:adm-text-primary flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            )}
          </div>

          {/* Grouped Navigation */}
          <nav className={`flex-1 overflow-y-auto py-3.5 space-y-5 ${collapsed ? 'px-2' : 'px-3'}`}>
            {collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="w-full flex items-center justify-center py-2 rounded-lg adm-text-muted adm-surface-hover transition-colors cursor-pointer"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ChevronRight size={14} />
              </button>
            )}
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-0.5">
                {!collapsed && (
                  <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] adm-text-faint">
                    {group.title}
                  </p>
                )}
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} showLabel={!collapsed} />
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t adm-divider space-y-1.5 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg adm-surface border adm-divider">
              <div className="w-7 h-7 rounded-full adm-accent-subtle border adm-accent-border adm-text-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <span className="text-[12px] font-semibold adm-text-primary block truncate leading-tight">
                  {adminName}
                </span>
                <span className="text-[10.5px] adm-text-muted block truncate">{adminEmail}</span>
              </div>
            </div>
          )}
          <form action="/api/admin/auth/logout" method="POST">
            <button
              type="submit"
              title="Sign Out"
              className={`w-full py-2 px-2.5 rounded-lg text-[12px] font-medium adm-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-2 cursor-pointer ${
                collapsed ? 'justify-center' : 'justify-start'
              }`}
            >
              <LogOut size={14} />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden adm-header backdrop-blur-md border-b sticky top-0 z-40 h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg adm-text-secondary adm-surface-hover transition-colors cursor-pointer"
            aria-label="Open navigation"
          >
            <Menu size={18} />
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
                {brandBadge}
              </div>
            )}
            <span data-no-translate="true" className="font-semibold text-sm adm-text-primary">
              {platformName}
            </span>
          </Link>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full adm-surface border adm-divider adm-text-secondary">
          Super Admin
        </span>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <div className="relative flex-1 max-w-[280px] w-full adm-sidebar border-r flex flex-col justify-between p-4 z-10 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b adm-divider">
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={platformName}
                      className="w-7 h-7 rounded-lg object-contain bg-white border adm-divider p-0.5 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px]"
                      style={{
                        backgroundColor: 'var(--adm-accent)',
                        color: 'var(--adm-accent-fg, #ffffff)',
                      }}
                    >
                      {brandBadge}
                    </div>
                  )}
                  <div>
                    <span data-no-translate="true" className="font-semibold text-sm adm-text-primary block leading-tight">
                      {platformName}
                    </span>
                    <span className="text-[10px] font-medium adm-text-muted block">Control Plane</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg adm-text-muted adm-surface-hover transition-colors cursor-pointer"
                  aria-label="Close navigation"
                >
                  <X size={16} />
                </button>
              </div>
              <nav className="space-y-4">
                {navGroups.map((group) => (
                  <div key={group.title} className="space-y-0.5">
                    <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] adm-text-faint">
                      {group.title}
                    </p>
                    {group.items.map((item) => (
                      <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
                    ))}
                  </div>
                ))}
              </nav>
            </div>

            <div className="pt-4 mt-4 border-t adm-divider space-y-2">
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
                  className="w-full py-2 px-3 rounded-lg text-xs font-medium adm-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} />
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
