'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ExternalLink,
  Globe,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Paintbrush,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';

interface SearchTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  planName: string;
  students: number;
  staff: number;
}

const ADMIN_COMMANDS = [
  { label: 'Platform Overview', href: '/admin', keywords: 'dashboard home kpi metrics', icon: LayoutDashboard },
  { label: 'Schools & Tenants', href: '/admin/tenants', keywords: 'schools tenants create impersonate', icon: Building2 },
  { label: 'Plan Tiers & Features', href: '/admin/plans', keywords: 'pricing subscription tiers features', icon: Sparkles },
  { label: 'Website Studio (CMS)', href: '/admin/website', keywords: 'cms pages menus logo favicon brand', icon: Globe },
  { label: 'Open Visual Page Builder', href: '/admin/website/editor/home', keywords: 'elementor editor builder design', icon: Paintbrush },
  { label: 'Broadcast Announcements', href: '/admin/announcements', keywords: 'banner notice alert broadcast', icon: Megaphone },
  { label: 'Leads & Inquiries Inbox', href: '/admin/leads', keywords: 'contact form demo leads crm', icon: Inbox },
  { label: 'Platform Finance', href: '/admin/finance', keywords: 'revenue money paystack payouts', icon: Wallet },
  { label: 'Scratch Card PINs', href: '/admin/pins', keywords: 'pins scratch card results', icon: KeyRound },
  { label: 'System Audit Logs', href: '/admin/audit-logs', keywords: 'security audit impersonation logs', icon: ShieldCheck },
  { label: 'Platform Settings', href: '/admin/settings', keywords: 'settings maintenance trial sms paystack', icon: Settings },
];

export function AdminCommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<SearchTenant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.tenants)) {
          setTenants(data.tenants);
        }
      } catch {
        // ignore transient search errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 140);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filteredCommands = ADMIN_COMMANDS.filter(
    (c) =>
      !q ||
      c.label.toLowerCase().includes(q) ||
      c.keywords.toLowerCase().includes(q) ||
      c.href.toLowerCase().includes(q)
  );

  const navigate = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 backdrop-blur-[2px] pt-[12vh] px-4"
      onClick={onClose}
    >
      <div
        className="adm-modal-panel w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 h-13 border-b adm-divider">
          <Search className="w-4 h-4 adm-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools, slugs, or jump to any admin section..."
            className="flex-1 bg-transparent text-sm adm-text-primary placeholder:adm-text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md adm-text-muted adm-surface-hover cursor-pointer"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {/* Schools */}
          <div>
            <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider adm-text-muted">
              <span>Schools &amp; Tenants</span>
              {loading && <span>Searching...</span>}
            </div>
            {tenants.length === 0 && !loading ? (
              <p className="px-3 py-2 text-xs adm-text-muted">No matching schools found.</p>
            ) : (
              <div className="space-y-0.5">
                {tenants.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg adm-surface-hover transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => navigate('/admin/tenants')}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 adm-text-accent shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold adm-text-primary truncate">
                          {t.name}
                        </span>
                        <span className="block text-[10px] font-mono adm-text-muted truncate">
                          /{t.slug} · {t.planName} · {t.students} students
                        </span>
                      </div>
                    </button>
                    <a
                      href={`/${t.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={onClose}
                      className="px-2 py-1 rounded-md border adm-divider text-[10px] font-semibold adm-text-secondary hover:adm-text-primary inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Site</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin Navigation & Actions */}
          {filteredCommands.length > 0 && (
            <div className="pt-2 border-t adm-divider">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider adm-text-muted">
                Quick Navigation
              </div>
              <div className="space-y-0.5">
                {filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.href}
                      type="button"
                      onClick={() => navigate(cmd.href)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left adm-surface-hover transition-colors cursor-pointer"
                    >
                      <Icon className="w-4 h-4 adm-text-muted shrink-0" />
                      <span className="text-xs font-medium adm-text-primary flex-1">{cmd.label}</span>
                      <span className="text-[10px] font-mono adm-text-faint">{cmd.href}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t adm-divider flex items-center justify-between text-[10px] adm-text-muted">
          <span>Press Esc to close</span>
          <span>Ctrl+K anywhere in Super Admin</span>
        </div>
      </div>
    </div>
  );
}
