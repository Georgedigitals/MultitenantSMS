'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Menu as MenuIcon,
  Paintbrush,
  Palette,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_NAV_LINKS,
  createDefaultBlock,
  getAllCmsPagesMeta,
  getDefaultFooterColumns,
  sanitizePageSlug,
  type CmsBlock,
  type CmsCustomPage,
  type CmsFooterColumn,
  type CmsMediaAsset,
  type CmsNavLink,
  type PublicSiteCmsConfig,
} from '@/lib/public-site-cms-schema';

interface WebsiteStudioClientProps {
  initialConfig: PublicSiteCmsConfig;
}

type StudioTab = 'pages' | 'menus' | 'brand' | 'media';

export function WebsiteStudioClient({ initialConfig }: WebsiteStudioClientProps) {
  const router = useRouter();
  const [config, setConfig] = useState<PublicSiteCmsConfig>(initialConfig);
  const [activeTab, setActiveTab] = useState<StudioTab>('pages');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add New Page state
  const [showNewPageForm, setShowNewPageForm] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [newPageTemplate, setNewPageTemplate] = useState<'blank' | 'landing' | 'faq'>('landing');

  const allPages = getAllCmsPagesMeta(config);
  const navLinks: CmsNavLink[] =
    Array.isArray(config.brand.navLinks) && config.brand.navLinks.length > 0
      ? config.brand.navLinks
      : DEFAULT_NAV_LINKS;
  const footerColumns: CmsFooterColumn[] =
    Array.isArray(config.brand.footerColumns) && config.brand.footerColumns.length > 0
      ? config.brand.footerColumns
      : getDefaultFooterColumns(config.brand.name);
  const mediaLibrary: CmsMediaAsset[] = config.mediaLibrary || [];

  const saveConfigToServer = async (nextConfig: PublicSiteCmsConfig, successMsg: string) => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: nextConfig }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save changes');
      setConfig(data.config);
      setStatus({ type: 'success', text: successMsg });
      router.refresh();
      return true;
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Save failed.' });
      return false;
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPageTitle.trim();
    const slug = sanitizePageSlug(newPageSlug || title);
    if (!title || !slug) {
      setStatus({ type: 'error', text: 'Enter a valid page title and URL slug.' });
      return;
    }
    if (allPages.some((p) => p.key === slug)) {
      setStatus({ type: 'error', text: `A page with slug "${slug}" already exists.` });
      return;
    }

    let starterBlocks: CmsBlock[] = [];
    if (newPageTemplate === 'landing') {
      starterBlocks = [
        {
          ...createDefaultBlock('hero', config.brand.name),
          data: {
            headline: title,
            highlight: '',
            subtitle: `Edit this page visually in the builder to customize ${title}.`,
            primaryCtaLabel: 'Get started',
            primaryCtaHref: '/register',
            secondaryCtaLabel: '',
            secondaryCtaHref: '',
            audienceTags: [],
            heroMediaMode: 'none',
            showProductPreview: false,
          },
        },
        createDefaultBlock('custom_text', config.brand.name),
        createDefaultBlock('cta', config.brand.name),
      ];
    } else if (newPageTemplate === 'faq') {
      starterBlocks = [
        createDefaultBlock('heading', config.brand.name),
        createDefaultBlock('faq', config.brand.name),
        createDefaultBlock('cta', config.brand.name),
      ];
    } else {
      starterBlocks = [
        {
          ...createDefaultBlock('heading', config.brand.name),
          data: { text: title, tag: 'h1' },
        },
        createDefaultBlock('text', config.brand.name),
      ];
    }

    const newPage: CmsCustomPage = {
      slug,
      title,
      description: `Custom page at /p/${slug}`,
      published: true,
      blocks: starterBlocks,
      updatedAt: new Date().toISOString(),
    };

    const nextConfig: PublicSiteCmsConfig = {
      ...config,
      customPages: [...(config.customPages || []), newPage],
    };

    const ok = await saveConfigToServer(nextConfig, `Created "${title}" (/p/${slug}).`);
    if (ok) {
      setNewPageTitle('');
      setNewPageSlug('');
      setShowNewPageForm(false);
    }
  };

  const handleToggleCustomPagePublish = async (slug: string) => {
    const nextConfig: PublicSiteCmsConfig = {
      ...config,
      customPages: (config.customPages || []).map((cp) =>
        cp.slug === slug ? { ...cp, published: !cp.published } : cp
      ),
    };
    await saveConfigToServer(nextConfig, 'Page visibility updated.');
  };

  const handleDeleteCustomPage = async (slug: string, title: string) => {
    if (!window.confirm(`Delete custom page "${title}" (/p/${slug})?`)) return;
    const nextConfig: PublicSiteCmsConfig = {
      ...config,
      customPages: (config.customPages || []).filter((cp) => cp.slug !== slug),
    };
    await saveConfigToServer(nextConfig, `Deleted "${title}".`);
  };

  const handleDuplicatePage = async (pageKey: string, title: string) => {
    const sourceBlocks: CmsBlock[] =
      pageKey in config.pages
        ? config.pages[pageKey as keyof typeof config.pages] || []
        : (config.customPages || []).find((cp) => cp.slug === pageKey)?.blocks || [];

    const baseSlug = sanitizePageSlug(`${pageKey}-copy`);
    let slug = baseSlug;
    let suffix = 2;
    while (allPages.some((p) => p.key === slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const clonedBlocks: CmsBlock[] = sourceBlocks.map((b, idx) => ({
      ...JSON.parse(JSON.stringify(b)),
      id: `${b.type}-${Date.now().toString(36)}-${idx}`,
    }));

    const newPage: CmsCustomPage = {
      slug,
      title: `${title} (Copy)`,
      description: `Duplicated from ${title}`,
      published: false,
      blocks: clonedBlocks,
      updatedAt: new Date().toISOString(),
    };

    const nextConfig: PublicSiteCmsConfig = {
      ...config,
      customPages: [...(config.customPages || []), newPage],
    };
    await saveConfigToServer(nextConfig, `Duplicated "${title}" as Draft (/p/${slug}).`);
  };

  const handleUploadImage = async (file: File, target: 'media' | 'logo' | 'favicon' = 'media') => {
    setUploading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'cms');
      const res = await fetch('/api/platform/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Upload failed');

      const newAsset: CmsMediaAsset = {
        id: `media-${Date.now().toString(36)}`,
        url: data.url,
        name: file.name,
        createdAt: new Date().toISOString(),
      };

      const nextBrand =
        target === 'logo'
          ? { ...config.brand, logoUrl: data.url }
          : target === 'favicon'
          ? { ...config.brand, faviconUrl: data.url }
          : config.brand;

      const nextConfig: PublicSiteCmsConfig = {
        ...config,
        brand: nextBrand,
        mediaLibrary: [newAsset, ...(config.mediaLibrary || [])],
      };

      const msg =
        target === 'logo'
          ? 'Platform logo uploaded and saved.'
          : target === 'favicon'
          ? 'Browser favicon uploaded and saved.'
          : 'Image added to Media Library.';
      await saveConfigToServer(nextConfig, msg);
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  const updateBrand = (patch: Partial<PublicSiteCmsConfig['brand']>) => {
    setConfig((prev) => ({ ...prev, brand: { ...prev.brand, ...patch } }));
  };

  const moveNavLink = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= navLinks.length) return;
    const next = [...navLinks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateBrand({ navLinks: next });
  };

  const inputClass = 'adm-input w-full border rounded-lg px-3 py-2 text-xs';

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b adm-divider">
        <div>
          <h1 className="text-2xl font-bold adm-text-primary tracking-tight">Website Studio</h1>
          <p className="text-sm adm-text-muted mt-1 max-w-2xl">
            Create pages, manage header &amp; footer menus, upload your platform logo &amp; media, and launch the full-screen visual page builder.
          </p>
        </div>

        <Link
          href="/admin/website/editor/home"
          className="adm-btn-primary h-10 px-4 rounded-lg text-xs font-bold inline-flex items-center gap-2 shrink-0"
        >
          <Paintbrush className="w-4 h-4" />
          <span>Open Visual Builder</span>
        </Link>
      </div>

      {/* Studio 4-Tab Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b adm-divider pb-3">
        {(
          [
            { id: 'pages', label: 'Pages', count: allPages.length, icon: FileText },
            { id: 'menus', label: 'Menus & Footer', icon: MenuIcon },
            { id: 'brand', label: 'Brand & Logo', icon: Palette },
            { id: 'media', label: 'Media Library', count: mediaLibrary.length, icon: ImageIcon },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                active
                  ? 'adm-btn-primary'
                  : 'adm-surface border adm-divider adm-text-secondary hover:adm-text-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {'count' in tab && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${active ? 'bg-white/20 text-white' : 'adm-badge'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {status && (
        <div
          className={`px-4 py-3 rounded-xl text-xs font-semibold border ${
            status.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
              : 'bg-rose-500/10 text-rose-600 border-rose-500/25'
          }`}
        >
          {status.text}
        </div>
      )}

      {/* ── TAB 1: PAGES (+ Add New Page) ─────────────────────────────────────── */}
      {activeTab === 'pages' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold adm-text-primary">
              All Public Pages ({allPages.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowNewPageForm((v) => !v)}
              className="adm-btn-primary h-9 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Page</span>
            </button>
          </div>

          {showNewPageForm && (
            <form
              onSubmit={handleCreatePage}
              className="adm-card border rounded-xl p-5 space-y-4"
            >
              <h3 className="text-sm font-bold adm-text-primary">Create a New Public Page</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold adm-text-secondary mb-1">
                    Page Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newPageTitle}
                    onChange={(e) => {
                      setNewPageTitle(e.target.value);
                      if (!newPageSlug) setNewPageSlug(sanitizePageSlug(e.target.value));
                    }}
                    placeholder="e.g. Partners, Privacy Policy, Demo"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold adm-text-secondary mb-1">
                    URL Slug (published at /p/slug)
                  </label>
                  <input
                    type="text"
                    required
                    value={newPageSlug}
                    onChange={(e) => setNewPageSlug(sanitizePageSlug(e.target.value))}
                    placeholder="e.g. partners"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold adm-text-secondary mb-1">
                    Starter Layout
                  </label>
                  <select
                    value={newPageTemplate}
                    onChange={(e) => setNewPageTemplate(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="landing">Landing Page (Hero + Story + CTA)</option>
                    <option value="faq">FAQ &amp; Help Page</option>
                    <option value="blank">Clean Text Page</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPageForm(false)}
                  className="h-9 px-3.5 rounded-lg border adm-divider adm-surface text-xs font-semibold adm-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="adm-btn-primary h-9 px-4 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Page'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allPages.map((page) => (
              <div
                key={page.key}
                className="adm-card border rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-base font-bold adm-text-primary truncate">{page.title}</h3>
                      {!page.isBuiltIn && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            page.published ? 'adm-status-active' : 'adm-status-neutral'
                          }`}
                        >
                          {page.published ? 'Published' : 'Draft'}
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono adm-surface border adm-divider adm-text-secondary shrink-0">
                      {page.route}
                    </span>
                  </div>
                  <p className="text-xs adm-text-muted">{page.description}</p>
                  <div className="flex items-center gap-1.5 text-[11px] adm-text-secondary">
                    <Layers className="w-3.5 h-3.5 adm-text-muted" />
                    <span>{page.blockCount} widgets</span>
                  </div>
                </div>

                <div className="pt-3 border-t adm-divider flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {page.published && (
                      <a
                        href={page.route}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold adm-text-secondary hover:adm-text-primary inline-flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDuplicatePage(page.key, page.title)}
                      disabled={saving}
                      className="text-xs font-semibold adm-text-secondary hover:adm-text-primary inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </button>
                    {!page.isBuiltIn && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleCustomPagePublish(page.key)}
                          className="text-xs font-semibold adm-text-secondary hover:adm-text-primary cursor-pointer"
                        >
                          {page.published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomPage(page.key, page.title)}
                          className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>

                  <Link
                    href={`/admin/website/editor/${page.key}`}
                    className="adm-btn-primary h-9 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    <span>Edit with Builder</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: MENUS & FOOTER ─────────────────────────────────────────────── */}
      {activeTab === 'menus' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Header Navigation Menu */}
            <div className="adm-card border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b adm-divider">
                <h2 className="text-sm font-bold adm-text-primary">Header Navigation Menu</h2>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const selected = allPages.find((p) => p.route === e.target.value);
                    if (selected) {
                      updateBrand({
                        navLinks: [...navLinks, { label: selected.title, href: selected.route }],
                      });
                    }
                    e.target.value = '';
                  }}
                  className="adm-input border rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
                >
                  <option value="">+ Add Page to Menu...</option>
                  {allPages.map((p) => (
                    <option key={p.key} value={p.route}>
                      {p.title} ({p.route})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                {navLinks.map((link, idx) => (
                  <div
                    key={idx}
                    className="adm-surface border adm-divider rounded-lg p-2.5 grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        const next = [...navLinks];
                        next[idx] = { ...next[idx], label: e.target.value };
                        updateBrand({ navLinks: next });
                      }}
                      placeholder="Menu label"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={link.href}
                      onChange={(e) => {
                        const next = [...navLinks];
                        next[idx] = { ...next[idx], href: e.target.value };
                        updateBrand({ navLinks: next });
                      }}
                      placeholder="/path"
                      className={inputClass}
                    />
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveNavLink(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 adm-text-muted hover:adm-text-primary disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveNavLink(idx, 1)}
                        disabled={idx === navLinks.length - 1}
                        className="p-1.5 adm-text-muted hover:adm-text-primary disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateBrand({ navLinks: navLinks.filter((_, i) => i !== idx) })
                        }
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t adm-divider grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold adm-text-secondary mb-1">
                    Header CTA Button Label
                  </label>
                  <input
                    type="text"
                    value={config.brand.headerCtaLabel ?? 'Set up your school'}
                    onChange={(e) => updateBrand({ headerCtaLabel: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold adm-text-secondary mb-1">
                    Header CTA URL
                  </label>
                  <input
                    type="text"
                    value={config.brand.headerCtaHref || '/register'}
                    onChange={(e) => updateBrand({ headerCtaHref: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs adm-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.brand.showSignInLink !== false}
                  onChange={(e) => updateBrand({ showSignInLink: e.target.checked })}
                />
                <span>Show “Sign in” link in public header</span>
              </label>
            </div>

            {/* Footer Columns Builder */}
            <div className="adm-card border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b adm-divider">
                <h2 className="text-sm font-bold adm-text-primary">Footer Columns &amp; Copyright</h2>
                {footerColumns.length < 4 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateBrand({
                        footerColumns: [
                          ...footerColumns,
                          { heading: 'Company', links: [{ label: 'About', href: '/about' }] },
                        ],
                      })
                    }
                    className="text-xs font-bold text-[#17834b] hover:underline cursor-pointer"
                  >
                    + Add Column
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {footerColumns.map((col, cIdx) => (
                  <div key={cIdx} className="adm-surface border adm-divider rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={col.heading}
                        onChange={(e) => {
                          const next = [...footerColumns];
                          next[cIdx] = { ...next[cIdx], heading: e.target.value };
                          updateBrand({ footerColumns: next });
                        }}
                        className={`${inputClass} font-bold`}
                        placeholder="Column heading"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateBrand({
                            footerColumns: footerColumns.filter((_, i) => i !== cIdx),
                          })
                        }
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {col.links.map((lnk, lIdx) => (
                      <div key={lIdx} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                        <input
                          type="text"
                          value={lnk.label}
                          onChange={(e) => {
                            const next = [...footerColumns];
                            const links = [...next[cIdx].links];
                            links[lIdx] = { ...links[lIdx], label: e.target.value };
                            next[cIdx] = { ...next[cIdx], links };
                            updateBrand({ footerColumns: next });
                          }}
                          className={inputClass}
                          placeholder="Label"
                        />
                        <input
                          type="text"
                          value={lnk.href}
                          onChange={(e) => {
                            const next = [...footerColumns];
                            const links = [...next[cIdx].links];
                            links[lIdx] = { ...links[lIdx], href: e.target.value };
                            next[cIdx] = { ...next[cIdx], links };
                            updateBrand({ footerColumns: next });
                          }}
                          className={inputClass}
                          placeholder="/path"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...footerColumns];
                            next[cIdx] = {
                              ...next[cIdx],
                              links: next[cIdx].links.filter((_, i) => i !== lIdx),
                            };
                            updateBrand({ footerColumns: next });
                          }}
                          className="px-2 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...footerColumns];
                        next[cIdx] = {
                          ...next[cIdx],
                          links: [...next[cIdx].links, { label: 'New link', href: '/' }],
                        };
                        updateBrand({ footerColumns: next });
                      }}
                      className="text-[11px] font-semibold text-[#17834b] hover:underline cursor-pointer"
                    >
                      + Add link
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 space-y-2.5">
                <div>
                  <label className="block text-xs font-semibold adm-text-secondary mb-1">
                    Footer Description
                  </label>
                  <textarea
                    rows={2}
                    value={config.brand.footerNote}
                    onChange={(e) => updateBrand({ footerNote: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold adm-text-secondary mb-1">
                    Copyright Text
                  </label>
                  <input
                    type="text"
                    value={config.brand.footerCopyright || ''}
                    placeholder={`© ${new Date().getFullYear()} ${config.brand.name}. All rights reserved.`}
                    onChange={(e) => updateBrand({ footerCopyright: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => saveConfigToServer(config, 'Header menu and footer saved live.')}
              disabled={saving}
              className="adm-btn-primary h-10 px-5 rounded-lg text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Menus & Footer'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 3: BRAND & PLATFORM LOGO ──────────────────────────────────────── */}
      {activeTab === 'brand' && (
        <div className="adm-card border rounded-xl p-6 space-y-6 max-w-3xl">
          <h2 className="text-base font-bold adm-text-primary border-b adm-divider pb-3">
            Platform Brand &amp; Logo
          </h2>

          {/* Platform Logo Upload */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-xl adm-surface border adm-divider">
            <div className="w-20 h-20 rounded-xl bg-white border adm-divider flex items-center justify-center overflow-hidden shrink-0">
              {config.brand.logoUrl ? (
                <img
                  src={config.brand.logoUrl}
                  alt={config.brand.name}
                  className="max-h-16 max-w-16 object-contain"
                />
              ) : (
                <span className="text-lg font-bold text-[#092b45]">
                  {config.brand.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-xs font-bold adm-text-primary">Platform Logo</p>
              <p className="text-[11px] adm-text-muted">
                PNG, WebP, or JPEG up to 5MB. Appears in the public navbar and footer.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label className="adm-btn-primary h-9 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : config.brand.logoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'logo');
                      e.target.value = '';
                    }}
                  />
                </label>
                {config.brand.logoUrl && (
                  <button
                    type="button"
                    onClick={() => updateBrand({ logoUrl: '' })}
                    className="h-9 px-3 rounded-lg border adm-divider text-xs font-semibold text-rose-500 cursor-pointer"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Browser Favicon Upload */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-xl adm-surface border adm-divider">
            <div className="w-16 h-16 rounded-xl bg-white border adm-divider flex items-center justify-center overflow-hidden shrink-0">
              {config.brand.faviconUrl ? (
                <img
                  src={config.brand.faviconUrl}
                  alt="Browser favicon"
                  className="w-10 h-10 object-contain"
                />
              ) : (
                <span className="text-xs font-bold text-[#66645e]">ICO</span>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-xs font-bold adm-text-primary">Browser Favicon (Site Icon)</p>
              <p className="text-[11px] adm-text-muted">
                Square PNG or WebP (e.g. 64×64 or 128×128). Appears in browser tabs and bookmarks.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label className="adm-btn-primary h-9 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : config.brand.faviconUrl ? 'Replace Favicon' : 'Upload Favicon'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'favicon');
                      e.target.value = '';
                    }}
                  />
                </label>
                {config.brand.faviconUrl && (
                  <button
                    type="button"
                    onClick={() => updateBrand({ faviconUrl: '' })}
                    className="h-9 px-3 rounded-lg border adm-divider text-xs font-semibold text-rose-500 cursor-pointer"
                  >
                    Remove Favicon
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold adm-text-secondary mb-1">
                Platform Name
              </label>
              <input
                type="text"
                maxLength={80}
                value={config.brand.name}
                onChange={(e) => updateBrand({ name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold adm-text-secondary mb-1">
                Platform Tagline
              </label>
              <input
                type="text"
                maxLength={160}
                value={config.brand.tagline}
                onChange={(e) => updateBrand({ tagline: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold adm-text-secondary mb-1">
                Primary Brand Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.brand.primaryColor}
                  onChange={(e) => updateBrand({ primaryColor: e.target.value })}
                  className="h-9 w-11 rounded border adm-divider cursor-pointer"
                />
                <input
                  type="text"
                  value={config.brand.primaryColor}
                  onChange={(e) => updateBrand({ primaryColor: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold adm-text-secondary mb-1">
                Accent Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.brand.accentColor}
                  onChange={(e) => updateBrand({ accentColor: e.target.value })}
                  className="h-9 w-11 rounded border adm-divider cursor-pointer"
                />
                <input
                  type="text"
                  value={config.brand.accentColor}
                  onChange={(e) => updateBrand({ accentColor: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Super Admin Dashboard Appearance */}
          <div className="pt-4 border-t adm-divider space-y-4">
            <div>
              <h3 className="text-sm font-bold adm-text-primary">Super Admin Dashboard Appearance</h3>
              <p className="text-xs adm-text-muted mt-0.5">
                Choose the accent color style for your Super Admin sidebar, active states, and primary action buttons.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {(
                [
                  {
                    id: 'ledger',
                    label: 'Achromatic Ledger',
                    desc: 'Crisp neutral ink',
                    swatch: '#141414',
                  },
                  {
                    id: 'brand',
                    label: 'Match Brand',
                    desc: 'Uses Accent Color',
                    swatch: config.brand.accentColor || config.brand.primaryColor || '#17834b',
                  },
                  {
                    id: 'emerald',
                    label: 'Emerald Classic',
                    desc: 'Classic green',
                    swatch: '#17834b',
                  },
                  {
                    id: 'custom',
                    label: 'Custom Color',
                    desc: 'Pick any hex',
                    swatch: config.brand.adminAccentColor || '#2563eb',
                  },
                ] as const
              ).map((preset) => {
                const selected = (config.brand.adminThemePreset || 'ledger') === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateBrand({ adminThemePreset: preset.id })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      selected
                        ? 'adm-accent-border adm-accent-subtle'
                        : 'adm-surface adm-divider hover:adm-surface-hover'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-md shrink-0 border border-black/10"
                      style={{ backgroundColor: preset.swatch }}
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold adm-text-primary truncate">{preset.label}</span>
                      <span className="block text-[10px] adm-text-muted truncate">{preset.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {config.brand.adminThemePreset === 'custom' && (
              <div className="max-w-xs">
                <label className="block text-xs font-semibold adm-text-secondary mb-1">
                  Custom Dashboard Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.brand.adminAccentColor || '#2563eb'}
                    onChange={(e) => updateBrand({ adminAccentColor: e.target.value })}
                    className="h-9 w-11 rounded border adm-divider cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.brand.adminAccentColor || '#2563eb'}
                    onChange={(e) => updateBrand({ adminAccentColor: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => saveConfigToServer(config, 'Platform brand & dashboard appearance saved live.')}
              disabled={saving}
              className="adm-btn-primary h-10 px-5 rounded-lg text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Brand Settings'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 4: REUSABLE MEDIA LIBRARY ─────────────────────────────────────── */}
      {activeTab === 'media' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold adm-text-primary">
                Media Library ({mediaLibrary.length})
              </h2>
              <p className="text-xs adm-text-muted">
                Upload images once and reuse them in any Hero, Image widget, or Logo.
              </p>
            </div>
            <label className="adm-btn-primary h-9 px-4 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadImage(file, 'media');
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {mediaLibrary.length === 0 ? (
            <div className="adm-card border border-dashed rounded-xl p-12 text-center space-y-2">
              <ImageIcon className="w-8 h-8 mx-auto adm-text-muted" />
              <p className="text-sm font-semibold adm-text-primary">No uploaded images yet</p>
              <p className="text-xs adm-text-muted">
                Upload your hero photos, platform logo, or feature screenshots here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {mediaLibrary.map((asset) => (
                <div key={asset.id} className="adm-card border rounded-xl overflow-hidden flex flex-col">
                  <div className="aspect-[4/3] bg-black/5 overflow-hidden">
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-semibold adm-text-primary truncate">{asset.name}</p>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(asset.url);
                          setCopiedUrl(asset.url);
                          setTimeout(() => setCopiedUrl(null), 2000);
                        }}
                        className="text-[11px] font-semibold text-[#17834b] inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedUrl === asset.url ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextConfig: PublicSiteCmsConfig = {
                            ...config,
                            mediaLibrary: mediaLibrary.filter((m) => m.id !== asset.id),
                          };
                          saveConfigToServer(nextConfig, 'Removed from Media Library.');
                        }}
                        className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
