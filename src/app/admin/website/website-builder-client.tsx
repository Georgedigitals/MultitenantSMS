'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Grid2x2,
  Heading,
  Image as ImageIcon,
  Layers,
  Minus,
  Monitor,
  MousePointerClick,
  Palette,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Smartphone,
  Space,
  Tablet,
  Trash2,
  Type,
  Undo2,
  Wrench,
} from 'lucide-react';
import { LandingClient, type PlanData } from '@/app/landing-client';
import {
  CMS_BLOCK_CATALOG,
  DEFAULT_NAV_LINKS,
  createDefaultBlock,
  getAllCmsPagesMeta,
  getDefaultFooterColumns,
  isValidCmsPageKey,
  type CmsBlock,
  type CmsBlockAdvanced,
  type CmsBlockStyle,
  type CmsBlockType,
  type CmsFooterColumn,
  type CmsNavLink,
  type PublicSiteCmsConfig,
} from '@/lib/public-site-cms-schema';

interface WebsiteBuilderClientProps {
  initialConfig: PublicSiteCmsConfig;
  initialPageKey: string;
  plans: PlanData[];
}

type SidebarView = 'widgets' | 'inspector' | 'navigator' | 'brand';
type InspectorSubTab = 'content' | 'style' | 'advanced';
type ViewportMode = 'desktop' | 'tablet' | 'mobile';

function WidgetIcon({ type }: { type: CmsBlockType }) {
  const cls = 'w-4 h-4';
  switch (type) {
    case 'heading':
      return <Heading className={cls} />;
    case 'text':
      return <Type className={cls} />;
    case 'image':
      return <ImageIcon className={cls} />;
    case 'button':
      return <MousePointerClick className={cls} />;
    case 'columns':
      return <Columns3 className={cls} />;
    case 'spacer':
      return <Space className={cls} />;
    case 'divider':
      return <Minus className={cls} />;
    default:
      return <Layers className={cls} />;
  }
}

export function WebsiteBuilderClient({
  initialConfig,
  initialPageKey,
  plans,
}: WebsiteBuilderClientProps) {
  const router = useRouter();

  // History stack for Undo / Redo
  const [history, setHistory] = useState<PublicSiteCmsConfig[]>([initialConfig]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const config = history[historyIndex];

  const [pageKey, setPageKey] = useState<string>(initialPageKey);
  const [sidebarView, setSidebarView] = useState<SidebarView>('widgets');
  const [inspectorTab, setInspectorTab] = useState<InspectorSubTab>('content');
  const [siteSubTab, setSiteSubTab] = useState<'brand' | 'menu' | 'footer' | 'seo' | 'history'>('brand');
  const [revisions, setRevisions] = useState<
    Array<{ id: string; createdAt: string; author: string; summary: string }>
  >([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const getBlocksForKey = (cfg: PublicSiteCmsConfig, key: string): CmsBlock[] => {
    if (isValidCmsPageKey(key)) return cfg.pages[key] || [];
    return (cfg.customPages || []).find((cp) => cp.slug === key)?.blocks || [];
  };
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    getBlocksForKey(initialConfig, initialPageKey)?.[0]?.id || null
  );
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [widgetQuery, setWidgetQuery] = useState('');

  // Collapsible & Resizable Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const isResizingRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImageFileUpload = async (
    file: File,
    fieldKey: string,
    onSuccess: (url: string) => void
  ) => {
    setUploadingField(fieldKey);
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
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Image upload failed');
      }
      onSuccess(data.url);
      commitConfig((prev) => ({
        ...prev,
        mediaLibrary: [
          {
            id: `media-${Date.now().toString(36)}`,
            url: data.url,
            name: file.name,
            createdAt: new Date().toISOString(),
          },
          ...(prev.mediaLibrary || []),
        ],
      }));
      setStatus({ type: 'success', text: 'Image uploaded & saved to Media Library. Click Publish.' });
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Could not upload image.' });
    } finally {
      setUploadingField(null);
    }
  };

  const allPagesMeta = getAllCmsPagesMeta(config);
  const currentPageMeta = allPagesMeta.find((p) => p.key === pageKey) || allPagesMeta[0];
  const currentBlocks = getBlocksForKey(config, pageKey);
  const selectedBlock = currentBlocks.find((b) => b.id === selectedBlockId) || null;

  const commitConfig = (updater: (prev: PublicSiteCmsConfig) => PublicSiteCmsConfig) => {
    setHistory((prevHistory) => {
      const current = prevHistory[historyIndex];
      const next = updater(current);
      const sliced = prevHistory.slice(0, historyIndex + 1);
      const updated = [...sliced, next].slice(-30);
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const handleUndo = () => {
    if (canUndo) setHistoryIndex((i) => i - 1);
  };
  const handleRedo = () => {
    if (canRedo) setHistoryIndex((i) => i + 1);
  };

  const loadRevisions = async () => {
    setLoadingRevisions(true);
    try {
      const res = await fetch('/api/admin/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_revisions' }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.revisions)) {
        setRevisions(data.revisions);
      }
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleRestoreRevision = async (revisionId: string) => {
    if (!window.confirm('Restore this previous saved version of your website?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_revision', revisionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      setHistory([data.config]);
      setHistoryIndex(0);
      setStatus({ type: 'success', text: 'Restored saved revision.' });
      router.refresh();
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  // Load revisions whenever History sub-tab is opened
  useEffect(() => {
    if (sidebarView === 'brand' && siteSubTab === 'history') {
      loadRevisions();
    }
  }, [sidebarView, siteSubTab]);

  // Editor keyboard shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+D, Delete)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handlePublish();
        return;
      }
      if (isTyping) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedBlockId) {
        e.preventDefault();
        duplicateBlockById(selectedBlockId);
      } else if (e.key === 'Delete' && selectedBlockId) {
        e.preventDefault();
        deleteBlockById(selectedBlockId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Drag-resize sidebar handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const clamped = Math.max(280, Math.min(540, e.clientX));
      setSidebarWidth(clamped);
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = () => {
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const setCurrentBlocks = (updater: (blocks: CmsBlock[]) => CmsBlock[]) => {
    commitConfig((prev) => {
      if (isValidCmsPageKey(pageKey)) {
        const updated = updater(prev.pages[pageKey] || []);
        return {
          ...prev,
          pages: {
            ...prev.pages,
            [pageKey]: updated,
          },
          blocks: pageKey === 'home' ? updated : prev.pages.home,
        };
      }
      return {
        ...prev,
        customPages: (prev.customPages || []).map((cp) =>
          cp.slug === pageKey ? { ...cp, blocks: updater(cp.blocks || []) } : cp
        ),
      };
    });
  };

  const handleSwitchPage = (nextKey: string) => {
    setPageKey(nextKey);
    setSelectedBlockId(getBlocksForKey(config, nextKey)?.[0]?.id || null);
    setSidebarView('widgets');
    window.history.replaceState(null, '', `/admin/website/editor/${nextKey}`);
  };

  const updateBrand = (patch: Partial<PublicSiteCmsConfig['brand']>) => {
    commitConfig((prev) => ({
      ...prev,
      brand: { ...prev.brand, ...patch },
    }));
  };

  const updateBlockData = (blockId: string, patch: Record<string, any>) => {
    setCurrentBlocks((blocks) =>
      blocks.map((b) => (b.id === blockId ? { ...b, data: { ...b.data, ...patch } } : b))
    );
  };

  const updateBlockStyle = (blockId: string, patch: Partial<CmsBlockStyle>) => {
    setCurrentBlocks((blocks) =>
      blocks.map((b) => (b.id === blockId ? { ...b, style: { ...(b.style || {}), ...patch } } : b))
    );
  };

  const updateBlockAdvanced = (blockId: string, patch: Partial<CmsBlockAdvanced>) => {
    setCurrentBlocks((blocks) =>
      blocks.map((b) =>
        b.id === blockId ? { ...b, advanced: { ...(b.advanced || {}), ...patch } } : b
      )
    );
  };

  const moveBlockById = (blockId: string, direction: -1 | 1) => {
    setCurrentBlocks((blocks) => {
      const index = blocks.findIndex((b) => b.id === blockId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= blocks.length) return blocks;
      const next = [...blocks];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const toggleBlockVisibility = (blockId: string) => {
    setCurrentBlocks((blocks) =>
      blocks.map((b) => (b.id === blockId ? { ...b, visible: !b.visible } : b))
    );
  };

  const duplicateBlockById = (blockId: string) => {
    const source = currentBlocks.find((b) => b.id === blockId);
    if (!source) return;
    const clone: CmsBlock = {
      ...source,
      id: `${source.type}-${Date.now().toString(36)}`,
      data: JSON.parse(JSON.stringify(source.data || {})),
      style: source.style ? { ...source.style } : undefined,
      advanced: source.advanced ? { ...source.advanced } : undefined,
    };
    setCurrentBlocks((blocks) => {
      const idx = blocks.findIndex((b) => b.id === blockId);
      const next = [...blocks];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setSelectedBlockId(clone.id);
    setSidebarView('inspector');
    setInspectorTab('content');
  };

  const deleteBlockById = (blockId: string) => {
    setCurrentBlocks((blocks) => {
      const next = blocks.filter((b) => b.id !== blockId);
      if (selectedBlockId === blockId) {
        setSelectedBlockId(next[0]?.id || null);
      }
      return next;
    });
  };

  const addWidget = (type: CmsBlockType) => {
    const block = createDefaultBlock(type, config.brand.name);
    setCurrentBlocks((blocks) => [...blocks, block]);
    setSelectedBlockId(block.id);
    setSidebarView('inspector');
    setInspectorTab('content');
  };

  const handlePublish = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish');
      setHistory([data.config]);
      setHistoryIndex(0);
      setStatus({ type: 'success', text: `Published! ${currentPageMeta.title} is live.` });
      router.refresh();
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Could not publish website.' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Reset "${currentPageMeta.title}" back to its default layout?`)) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', pageKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset');
      setHistory([data.config]);
      setHistoryIndex(0);
      setSelectedBlockId(getBlocksForKey(data.config, pageKey)?.[0]?.id || null);
      setStatus({ type: 'success', text: `Reset ${currentPageMeta.title} to defaults.` });
      router.refresh();
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Reset failed.' });
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full bg-[#242830] border border-white/15 rounded-md px-2.5 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#17834b]';
  const labelClass = 'block text-[11px] font-medium text-white/70 mb-1';

  // ── CONTENT TAB RENDERER ────────────────────────────────────────────────────
  const renderContentControls = (block: CmsBlock) => {
    const d = block.data || {};
    switch (block.type) {
      case 'heading':
        return (
          <div className="space-y-3.5">
            <div>
              <label className={labelClass}>Title</label>
              <textarea
                rows={2}
                value={d.text || ''}
                onChange={(e) => updateBlockData(block.id, { text: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>HTML Tag</label>
              <select
                value={d.tag || 'h2'}
                onChange={(e) => updateBlockData(block.id, { tag: e.target.value })}
                className={fieldClass}
              >
                {['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-3.5">
            <div>
              <label className={labelClass}>Text Content</label>
              <textarea
                rows={6}
                value={d.content || ''}
                onChange={(e) => updateBlockData(block.id, { content: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-3.5">
            <div>
              <label className={labelClass}>Choose Image</label>
              <div className="rounded-lg border border-white/15 bg-[#242830] overflow-hidden">
                {d.src ? (
                  <img
                    src={d.src}
                    alt={d.alt || 'Preview'}
                    className="h-32 w-full object-cover bg-black/30"
                  />
                ) : (
                  <div className="h-24 flex items-center justify-center text-[11px] text-white/45">
                    No image selected
                  </div>
                )}
                <div className="p-2 flex items-center gap-2 border-t border-white/10">
                  <label className="flex-1 h-8 rounded bg-[#17834b] hover:bg-[#1b9656] text-white text-[11px] font-semibold flex items-center justify-center cursor-pointer">
                    <span>{uploadingField === `img-${block.id}` ? 'Uploading...' : d.src ? 'Replace Image' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingField === `img-${block.id}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageFileUpload(file, `img-${block.id}`, (url) =>
                            updateBlockData(block.id, { src: url })
                          );
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {d.src && (
                    <button
                      type="button"
                      onClick={() => updateBlockData(block.id, { src: '' })}
                      className="h-8 px-2.5 rounded bg-white/10 hover:bg-rose-500/20 text-[11px] text-white/80 hover:text-rose-300 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Or Image URL</label>
              <input
                type="text"
                value={d.src || ''}
                onChange={(e) => updateBlockData(block.id, { src: e.target.value })}
                placeholder="https://... or /uploads/photo.jpg"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Alt Text</label>
              <input
                type="text"
                value={d.alt || ''}
                onChange={(e) => updateBlockData(block.id, { alt: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Caption (optional)</label>
              <input
                type="text"
                value={d.caption || ''}
                onChange={(e) => updateBlockData(block.id, { caption: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Aspect Ratio</label>
              <select
                value={d.aspectRatio || '16/9'}
                onChange={(e) => updateBlockData(block.id, { aspectRatio: e.target.value })}
                className={fieldClass}
              >
                <option value="16/9">16:9 Widescreen</option>
                <option value="4/3">4:3 Standard</option>
                <option value="1/1">1:1 Square</option>
                <option value="auto">Original</option>
              </select>
            </div>
          </div>
        );

      case 'button':
        return (
          <div className="space-y-3.5">
            <div>
              <label className={labelClass}>Button Text</label>
              <input
                type="text"
                value={d.label || ''}
                onChange={(e) => updateBlockData(block.id, { label: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Link URL</label>
              <input
                type="text"
                value={d.href || ''}
                onChange={(e) => updateBlockData(block.id, { href: e.target.value })}
                placeholder="/register"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Button Variant</label>
              <select
                value={d.variant || 'solid'}
                onChange={(e) => updateBlockData(block.id, { variant: e.target.value })}
                className={fieldClass}
              >
                <option value="solid">Solid Fill</option>
                <option value="outline">Outline</option>
              </select>
            </div>
          </div>
        );

      case 'columns': {
        const items: Array<{ title: string; body: string }> = Array.isArray(d.items) ? d.items : [];
        return (
          <div className="space-y-3.5">
            <div>
              <label className={labelClass}>Columns per Row</label>
              <select
                value={Number(d.columnCount) === 2 ? '2' : '3'}
                onChange={(e) => updateBlockData(block.id, { columnCount: Number(e.target.value) })}
                className={fieldClass}
              >
                <option value="2">2 Columns</option>
                <option value="3">3 Columns</option>
              </select>
            </div>
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/70">Column Cards</span>
                <button
                  type="button"
                  onClick={() =>
                    updateBlockData(block.id, {
                      items: [...items, { title: 'New column', body: 'Column description.' }],
                    })
                  }
                  className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                >
                  + Add Column
                </button>
              </div>
              {items.map((col, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-md p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={col.title}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], title: e.target.value };
                        updateBlockData(block.id, { items: next });
                      }}
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      onClick={() => updateBlockData(block.id, { items: items.filter((_, i) => i !== idx) })}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={col.body}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], body: e.target.value };
                      updateBlockData(block.id, { items: next });
                    }}
                    className={fieldClass}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'spacer':
        return (
          <div>
            <label className={labelClass}>Height ({Number(d.height) || 48}px)</label>
            <input
              type="range"
              min={8}
              max={240}
              value={Number(d.height) || 48}
              onChange={(e) => updateBlockData(block.id, { height: Number(e.target.value) })}
              className="w-full accent-[#17834b]"
            />
          </div>
        );

      case 'divider':
        return (
          <div>
            <label className={labelClass}>Line Thickness ({Number(d.thickness) || 1}px)</label>
            <input
              type="range"
              min={1}
              max={8}
              value={Number(d.thickness) || 1}
              onChange={(e) => updateBlockData(block.id, { thickness: Number(e.target.value) })}
              className="w-full accent-[#17834b]"
            />
          </div>
        );

      case 'hero': {
        const mediaMode =
          d.heroMediaMode ||
          (d.heroImageUrl ? 'image' : d.showProductPreview !== false ? 'preview' : 'none');

        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Headline</label>
              <input
                type="text"
                value={d.headline || ''}
                onChange={(e) => updateBlockData(block.id, { headline: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Highlight Phrase</label>
              <input
                type="text"
                value={d.highlight || ''}
                onChange={(e) => updateBlockData(block.id, { highlight: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <textarea
                rows={3}
                value={d.subtitle || ''}
                onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Primary CTA</label>
                <input
                  type="text"
                  value={d.primaryCtaLabel || ''}
                  onChange={(e) => updateBlockData(block.id, { primaryCtaLabel: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Primary URL</label>
                <input
                  type="text"
                  value={d.primaryCtaHref || ''}
                  onChange={(e) => updateBlockData(block.id, { primaryCtaHref: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Secondary CTA</label>
                <input
                  type="text"
                  value={d.secondaryCtaLabel || ''}
                  onChange={(e) => updateBlockData(block.id, { secondaryCtaLabel: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Secondary URL</label>
                <input
                  type="text"
                  value={d.secondaryCtaHref || ''}
                  onChange={(e) => updateBlockData(block.id, { secondaryCtaHref: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>

            {/* Hero Media Picker (Just like Elementor!) */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <div>
                <label className={labelClass}>Hero Media Type</label>
                <select
                  value={mediaMode}
                  onChange={(e) =>
                    updateBlockData(block.id, {
                      heroMediaMode: e.target.value,
                      showProductPreview: e.target.value === 'preview',
                    })
                  }
                  className={fieldClass}
                >
                  <option value="image">Custom Hero Image</option>
                  <option value="preview">Interactive Workspace Preview</option>
                  <option value="none">No Right Media (Text Only)</option>
                </select>
              </div>

              {mediaMode === 'image' && (
                <div className="space-y-2.5">
                  <div className="rounded-lg border border-white/15 bg-[#242830] overflow-hidden">
                    {d.heroImageUrl ? (
                      <img
                        src={d.heroImageUrl}
                        alt={d.heroImageAlt || 'Hero image preview'}
                        className="h-32 w-full object-cover bg-black/30"
                      />
                    ) : (
                      <div className="h-24 flex items-center justify-center text-[11px] text-white/45">
                        No hero image chosen yet
                      </div>
                    )}
                    <div className="p-2 flex items-center gap-2 border-t border-white/10">
                      <label className="flex-1 h-8 rounded bg-[#17834b] hover:bg-[#1b9656] text-white text-[11px] font-semibold flex items-center justify-center cursor-pointer">
                        <span>
                          {uploadingField === `hero-${block.id}`
                            ? 'Uploading...'
                            : d.heroImageUrl
                            ? 'Replace Image'
                            : 'Upload Hero Image'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={uploadingField === `hero-${block.id}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleImageFileUpload(file, `hero-${block.id}`, (url) =>
                                updateBlockData(block.id, {
                                  heroMediaMode: 'image',
                                  heroImageUrl: url,
                                })
                              );
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {d.heroImageUrl && (
                        <button
                          type="button"
                          onClick={() => updateBlockData(block.id, { heroImageUrl: '' })}
                          className="h-8 px-2.5 rounded bg-white/10 hover:bg-rose-500/20 text-[11px] text-white/80 hover:text-rose-300 cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Or Hero Image URL</label>
                    <input
                      type="text"
                      value={d.heroImageUrl || ''}
                      onChange={(e) =>
                        updateBlockData(block.id, {
                          heroMediaMode: 'image',
                          heroImageUrl: e.target.value,
                        })
                      }
                      placeholder="https://... or /uploads/hero.jpg"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Hero Image Alt Text</label>
                    <input
                      type="text"
                      value={d.heroImageAlt || ''}
                      onChange={(e) => updateBlockData(block.id, { heroImageAlt: e.target.value })}
                      placeholder="Describe the hero image"
                      className={fieldClass}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'capabilities': {
        const items: Array<{ title: string; description: string }> = Array.isArray(d.items) ? d.items : [];
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Section Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <textarea
                rows={2}
                value={d.subtitle || ''}
                onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/70">Items</span>
                <button
                  type="button"
                  onClick={() =>
                    updateBlockData(block.id, {
                      items: [...items, { title: 'New capability', description: 'Describe this capability.' }],
                    })
                  }
                  className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                >
                  + Add Item
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-md p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], title: e.target.value };
                        updateBlockData(block.id, { items: next });
                      }}
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      onClick={() => updateBlockData(block.id, { items: items.filter((_, i) => i !== idx) })}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], description: e.target.value };
                      updateBlockData(block.id, { items: next });
                    }}
                    className={fieldClass}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'showcase': {
        const bullets: string[] = Array.isArray(d.bullets) ? d.bullets : [];
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Body</label>
              <textarea
                rows={3}
                value={d.body || ''}
                onChange={(e) => updateBlockData(block.id, { body: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Bullet Points (one per line)</label>
              <textarea
                rows={3}
                value={bullets.join('\n')}
                onChange={(e) =>
                  updateBlockData(block.id, {
                    bullets: e.target.value.split('\n').filter((line) => line.trim()),
                  })
                }
                className={fieldClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>CTA Label</label>
                <input
                  type="text"
                  value={d.ctaLabel || ''}
                  onChange={(e) => updateBlockData(block.id, { ctaLabel: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>CTA URL</label>
                <input
                  type="text"
                  value={d.ctaHref || ''}
                  onChange={(e) => updateBlockData(block.id, { ctaHref: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>
        );
      }

      case 'roles': {
        const items: Array<{ role: string; description: string }> = Array.isArray(d.items) ? d.items : [];
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <textarea
                rows={2}
                value={d.subtitle || ''}
                onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/70">Role Rows</span>
                <button
                  type="button"
                  onClick={() =>
                    updateBlockData(block.id, {
                      items: [...items, { role: 'New role', description: 'Explain this role.' }],
                    })
                  }
                  className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                >
                  + Add Role
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-md p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={item.role}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], role: e.target.value };
                        updateBlockData(block.id, { items: next });
                      }}
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      onClick={() => updateBlockData(block.id, { items: items.filter((_, i) => i !== idx) })}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], description: e.target.value };
                      updateBlockData(block.id, { items: next });
                    }}
                    className={fieldClass}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'plans':
        return (
          <div className="space-y-3">
            <p className="text-[11px] text-white/55">
              Plan cards sync live from Super Admin → Plan Tiers &amp; Features.
            </p>
            <div>
              <label className={labelClass}>Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <input
                type="text"
                value={d.subtitle || ''}
                onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Footer Note</label>
              <input
                type="text"
                value={d.footerNote || ''}
                onChange={(e) => updateBlockData(block.id, { footerNote: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        );

      case 'faq': {
        const items: Array<{ question: string; answer: string }> = Array.isArray(d.items) ? d.items : [];
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/70">Questions</span>
                <button
                  type="button"
                  onClick={() =>
                    updateBlockData(block.id, {
                      items: [...items, { question: 'New question?', answer: 'Clear answer here.' }],
                    })
                  }
                  className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                >
                  + Add Q&amp;A
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-md p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={item.question}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], question: e.target.value };
                        updateBlockData(block.id, { items: next });
                      }}
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      onClick={() => updateBlockData(block.id, { items: items.filter((_, i) => i !== idx) })}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={item.answer}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], answer: e.target.value };
                      updateBlockData(block.id, { items: next });
                    }}
                    className={fieldClass}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'cta':
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <textarea
                rows={2}
                value={d.subtitle || ''}
                onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Button Label</label>
                <input
                  type="text"
                  value={d.buttonLabel || ''}
                  onChange={(e) => updateBlockData(block.id, { buttonLabel: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Button URL</label>
                <input
                  type="text"
                  value={d.buttonHref || ''}
                  onChange={(e) => updateBlockData(block.id, { buttonHref: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>
        );

      case 'testimonials': {
        const items: Array<{ quote: string; author: string; role: string }> = Array.isArray(d.items)
          ? d.items
          : [];
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Section Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <textarea
                rows={2}
                value={d.subtitle || ''}
                onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/70">Quotes ({items.length})</span>
                <button
                  type="button"
                  onClick={() =>
                    updateBlockData(block.id, {
                      items: [
                        ...items,
                        { quote: 'A great platform for our school.', author: 'Principal Name', role: 'School Name' },
                      ],
                    })
                  }
                  className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                >
                  + Add Quote
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-md p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50">Testimonial {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => updateBlockData(block.id, { items: items.filter((_, i) => i !== idx) })}
                      className="p-1 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={item.quote}
                    placeholder="Quote"
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], quote: e.target.value };
                      updateBlockData(block.id, { items: next });
                    }}
                    className={fieldClass}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={item.author}
                      placeholder="Author"
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], author: e.target.value };
                        updateBlockData(block.id, { items: next });
                      }}
                      className={fieldClass}
                    />
                    <input
                      type="text"
                      value={item.role}
                      placeholder="Role / School"
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], role: e.target.value };
                        updateBlockData(block.id, { items: next });
                      }}
                      className={fieldClass}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'stats': {
        const items: Array<{ value: string; label: string }> = Array.isArray(d.items) ? d.items : [];
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Eyebrow Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/70">Metrics ({items.length})</span>
                <button
                  type="button"
                  onClick={() =>
                    updateBlockData(block.id, { items: [...items, { value: '100%', label: 'New metric' }] })
                  }
                  className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                >
                  + Add Metric
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1.4fr_auto] gap-1.5 items-center">
                  <input
                    type="text"
                    value={item.value}
                    placeholder="120+"
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], value: e.target.value };
                      updateBlockData(block.id, { items: next });
                    }}
                    className={fieldClass}
                  />
                  <input
                    type="text"
                    value={item.label}
                    placeholder="Active schools"
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], label: e.target.value };
                      updateBlockData(block.id, { items: next });
                    }}
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    onClick={() => updateBlockData(block.id, { items: items.filter((_, i) => i !== idx) })}
                    className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'video':
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <textarea
                rows={2}
                value={d.subtitle || ''}
                onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Video URL (YouTube, Vimeo, or MP4)</label>
              <input
                type="text"
                value={d.videoUrl || ''}
                placeholder="https://www.youtube.com/watch?v=..."
                onChange={(e) => updateBlockData(block.id, { videoUrl: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        );

      case 'contact_form':
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Form Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <textarea
                rows={2}
                value={d.subtitle || ''}
                onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Submit Button Label</label>
              <input
                type="text"
                value={d.buttonLabel || 'Request Demo'}
                onChange={(e) => updateBlockData(block.id, { buttonLabel: e.target.value })}
                className={fieldClass}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={d.showSchoolField !== false}
                onChange={(e) => updateBlockData(block.id, { showSchoolField: e.target.checked })}
              />
              <span>Show School Name field</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={d.showPhoneField !== false}
                onChange={(e) => updateBlockData(block.id, { showPhoneField: e.target.checked })}
              />
              <span>Show Phone / WhatsApp field</span>
            </label>
            <p className="text-[11px] text-white/50">
              Submissions automatically appear in Super Admin → Leads &amp; Inquiries.
            </p>
          </div>
        );

      case 'logo_strip': {
        const items: Array<{ name: string; logoUrl?: string }> = Array.isArray(d.items) ? d.items : [];
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/70">Schools ({items.length})</span>
                <button
                  type="button"
                  onClick={() =>
                    updateBlockData(block.id, { items: [...items, { name: 'Partner School', logoUrl: '' }] })
                  }
                  className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                >
                  + Add School
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-md p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={item.name}
                      placeholder="School name"
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], name: e.target.value };
                        updateBlockData(block.id, { items: next });
                      }}
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      onClick={() => updateBlockData(block.id, { items: items.filter((_, i) => i !== idx) })}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.logoUrl || ''}
                    placeholder="Optional logo URL"
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], logoUrl: e.target.value };
                      updateBlockData(block.id, { items: next });
                    }}
                    className={fieldClass}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'custom_text':
      default:
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Heading</label>
              <input
                type="text"
                value={d.heading || ''}
                onChange={(e) => updateBlockData(block.id, { heading: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Body</label>
              <textarea
                rows={4}
                value={d.body || ''}
                onChange={(e) => updateBlockData(block.id, { body: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Preset Surface</label>
              <select
                value={d.backgroundTone || 'stone'}
                onChange={(e) => updateBlockData(block.id, { backgroundTone: e.target.value })}
                className={fieldClass}
              >
                <option value="light">White</option>
                <option value="stone">Warm stone</option>
                <option value="brand">Brand primary color</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Button Label</label>
                <input
                  type="text"
                  value={d.buttonLabel || ''}
                  onChange={(e) => updateBlockData(block.id, { buttonLabel: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Button URL</label>
                <input
                  type="text"
                  value={d.buttonHref || ''}
                  onChange={(e) => updateBlockData(block.id, { buttonHref: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>
        );
    }
  };

  // ── STYLE TAB RENDERER (Elementor Style Controls) ───────────────────────────
  const renderStyleControls = (block: CmsBlock) => {
    const s = block.style || {};
    return (
      <div className="space-y-4">
        {/* Alignment */}
        <div>
          <label className={labelClass}>Alignment</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'left', icon: AlignLeft, label: 'Left' },
                { id: 'center', icon: AlignCenter, label: 'Center' },
                { id: 'right', icon: AlignRight, label: 'Right' },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = (s.textAlign || 'left') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateBlockStyle(block.id, { textAlign: opt.id })}
                  className={`h-8 rounded-md border flex items-center justify-center gap-1 text-xs cursor-pointer ${
                    active
                      ? 'bg-[#17834b] border-[#17834b] text-white'
                      : 'bg-[#242830] border-white/15 text-white/70 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Typography */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
          <div>
            <label className={labelClass}>Font Size (px)</label>
            <input
              type="number"
              min={12}
              max={96}
              value={s.fontSize ?? ''}
              placeholder="Auto"
              onChange={(e) =>
                updateBlockStyle(block.id, {
                  fontSize: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Font Weight</label>
            <select
              value={s.fontWeight || ''}
              onChange={(e) =>
                updateBlockStyle(block.id, {
                  fontWeight: (e.target.value || undefined) as CmsBlockStyle['fontWeight'],
                })
              }
              className={fieldClass}
            >
              <option value="">Default</option>
              <option value="400">400 Regular</option>
              <option value="500">500 Medium</option>
              <option value="600">600 Semibold</option>
              <option value="700">700 Bold</option>
              <option value="800">800 Extrabold</option>
            </select>
          </div>
        </div>

        {/* Colors */}
        <div className="space-y-2.5 pt-2 border-t border-white/10">
          {(
            [
              { key: 'bgColor', label: 'Background Color' },
              { key: 'textColor', label: 'Text Color' },
              { key: 'accentColor', label: 'Button / Accent Color' },
            ] as const
          ).map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-medium text-white/70">{c.label}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={s[c.key] || '#ffffff'}
                  onChange={(e) => updateBlockStyle(block.id, { [c.key]: e.target.value })}
                  className="h-7 w-8 rounded border border-white/20 bg-transparent cursor-pointer"
                />
                {s[c.key] && (
                  <button
                    type="button"
                    onClick={() => updateBlockStyle(block.id, { [c.key]: undefined })}
                    className="text-[10px] text-white/50 hover:text-white px-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Background Image & Gradient */}
        <div className="space-y-2.5 pt-2 border-t border-white/10">
          <div>
            <label className={labelClass}>Section Background Image URL</label>
            <input
              type="text"
              value={s.bgImage || ''}
              placeholder="https://... or /uploads/..."
              onChange={(e) => updateBlockStyle(block.id, { bgImage: e.target.value || undefined })}
              className={fieldClass}
            />
          </div>
          {s.bgImage && (
            <div>
              <label className={labelClass}>
                Image Dark Overlay ({s.bgOverlayOpacity ?? 45}%)
              </label>
              <input
                type="range"
                min={0}
                max={85}
                value={s.bgOverlayOpacity ?? 45}
                onChange={(e) => updateBlockStyle(block.id, { bgOverlayOpacity: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Or CSS Background Gradient</label>
            <input
              type="text"
              value={s.bgGradient || ''}
              placeholder="e.g. linear-gradient(135deg, #092b45, #143f5d)"
              onChange={(e) => updateBlockStyle(block.id, { bgGradient: e.target.value || undefined })}
              className={fieldClass}
            />
          </div>
        </div>

        {/* Border & Radius */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
          <div>
            <label className={labelClass}>Border Width (px)</label>
            <input
              type="number"
              min={0}
              max={12}
              value={s.borderWidth ?? 0}
              onChange={(e) => updateBlockStyle(block.id, { borderWidth: Number(e.target.value) })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Border Radius (px)</label>
            <input
              type="number"
              min={0}
              max={48}
              value={s.borderRadius ?? 0}
              onChange={(e) => updateBlockStyle(block.id, { borderRadius: Number(e.target.value) })}
              className={fieldClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Border Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={s.borderColor || '#e4e2dd'}
              onChange={(e) => updateBlockStyle(block.id, { borderColor: e.target.value })}
              className="h-8 w-10 rounded border border-white/20 bg-transparent cursor-pointer"
            />
            <input
              type="text"
              value={s.borderColor || ''}
              placeholder="#e4e2dd"
              onChange={(e) => updateBlockStyle(block.id, { borderColor: e.target.value })}
              className={fieldClass}
            />
          </div>
        </div>
      </div>
    );
  };

  // ── ADVANCED TAB RENDERER (Elementor Advanced Controls) ─────────────────────
  const renderAdvancedControls = (block: CmsBlock) => {
    const adv = block.advanced || {};
    return (
      <div className="space-y-4">
        {/* Padding Box */}
        <div>
          <label className={labelClass}>Padding (px)</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { key: 'paddingTop', placeholder: 'Top' },
                { key: 'paddingRight', placeholder: 'Right' },
                { key: 'paddingBottom', placeholder: 'Bottom' },
                { key: 'paddingLeft', placeholder: 'Left' },
              ] as const
            ).map((p) => (
              <div key={p.key}>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={adv[p.key] ?? ''}
                  placeholder={p.placeholder}
                  onChange={(e) =>
                    updateBlockAdvanced(block.id, {
                      [p.key]: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className={`${fieldClass} text-center px-1`}
                />
                <span className="block text-center text-[9px] text-white/45 mt-0.5">{p.placeholder}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Margin Box */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
          <div>
            <label className={labelClass}>Margin Top (px)</label>
            <input
              type="number"
              min={0}
              max={200}
              value={adv.marginTop ?? ''}
              placeholder="0"
              onChange={(e) =>
                updateBlockAdvanced(block.id, {
                  marginTop: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Margin Bottom (px)</label>
            <input
              type="number"
              min={0}
              max={200}
              value={adv.marginBottom ?? ''}
              placeholder="0"
              onChange={(e) =>
                updateBlockAdvanced(block.id, {
                  marginBottom: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              className={fieldClass}
            />
          </div>
        </div>

        {/* Container Width */}
        <div className="pt-2 border-t border-white/10">
          <label className={labelClass}>Content Width</label>
          <select
            value={adv.maxWidth || '7xl'}
            onChange={(e) =>
              updateBlockAdvanced(block.id, {
                maxWidth: e.target.value as CmsBlockAdvanced['maxWidth'],
              })
            }
            className={fieldClass}
          >
            <option value="full">Full Width (100%)</option>
            <option value="7xl">Boxed Wide (1280px)</option>
            <option value="5xl">Boxed Medium (1024px)</option>
            <option value="3xl">Boxed Narrow (768px)</option>
          </select>
        </div>

        {/* Responsive Visibility */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <span className="block text-[11px] font-medium text-white/70">Responsive Visibility</span>
          {(
            [
              { key: 'hideDesktop', label: 'Hide on Desktop' },
              { key: 'hideTablet', label: 'Hide on Tablet' },
              { key: 'hideMobile', label: 'Hide on Mobile' },
            ] as const
          ).map((r) => (
            <label key={r.key} className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
              <span>{r.label}</span>
              <input
                type="checkbox"
                checked={Boolean(adv[r.key])}
                onChange={(e) => updateBlockAdvanced(block.id, { [r.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>

        {/* Custom CSS ID & Class */}
        <div className="space-y-2.5 pt-2 border-t border-white/10">
          <div>
            <label className={labelClass}>CSS ID (anchor link)</label>
            <input
              type="text"
              value={adv.cssId || ''}
              onChange={(e) => updateBlockAdvanced(block.id, { cssId: e.target.value })}
              placeholder="e.g. features-section"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Custom CSS Classes</label>
            <input
              type="text"
              value={adv.cssClass || ''}
              onChange={(e) => updateBlockAdvanced(block.id, { cssClass: e.target.value })}
              placeholder="e.g. tracking-tight"
              className={fieldClass}
            />
          </div>
        </div>
      </div>
    );
  };

  const filteredWidgets = CMS_BLOCK_CATALOG.filter(
    (w) =>
      !widgetQuery.trim() ||
      w.label.toLowerCase().includes(widgetQuery.toLowerCase()) ||
      w.category.toLowerCase().includes(widgetQuery.toLowerCase())
  );

  const previewWidthClass =
    viewport === 'mobile' ? 'max-w-[390px]' : viewport === 'tablet' ? 'max-w-[768px]' : 'w-full';

  return (
    <div
      data-cms-editor="true"
      className="h-screen w-screen overflow-hidden flex flex-col bg-[#111315] text-white"
    >
      {/* Top Elementor Toolbar */}
      <header className="h-12 shrink-0 bg-[#181b20] border-b border-white/10 px-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/admin/website"
            className="h-8 px-2.5 rounded bg-white/10 hover:bg-white/15 text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pages</span>
          </Link>

          <select
            value={pageKey}
            onChange={(e) => handleSwitchPage(e.target.value)}
            aria-label="Select page to edit"
            className="h-8 px-2.5 rounded bg-[#242830] border border-white/15 text-xs font-semibold text-white focus:outline-none focus:border-[#17834b] cursor-pointer"
          >
            {allPagesMeta.map((p) => (
              <option key={p.key} value={p.key}>
                {p.title} ({p.route})
              </option>
            ))}
          </select>

          <div className="h-4 w-px bg-white/15 hidden sm:block" />

          {/* Undo / Redo */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo"
              className="h-8 w-8 rounded hover:bg-white/10 disabled:opacity-30 flex items-center justify-center cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo"
              className="h-8 w-8 rounded hover:bg-white/10 disabled:opacity-30 flex items-center justify-center cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center Responsive Mode */}
        <div className="hidden md:flex items-center bg-[#242830] border border-white/10 rounded p-0.5">
          {(
            [
              { id: 'desktop', icon: Monitor, label: 'Desktop' },
              { id: 'tablet', icon: Tablet, label: 'Tablet' },
              { id: 'mobile', icon: Smartphone, label: 'Mobile' },
            ] as const
          ).map((vp) => {
            const Icon = vp.icon;
            return (
              <button
                key={vp.id}
                type="button"
                onClick={() => setViewport(vp.id)}
                title={vp.label}
                className={`p-1.5 rounded cursor-pointer ${
                  viewport === vp.id ? 'bg-[#17834b] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>

        {/* Right Publish Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <span
              className={`hidden xl:inline-block text-[11px] font-semibold px-2.5 py-1 rounded ${
                status.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {status.text}
            </span>
          )}
          <a
            href={currentPageMeta.route}
            target="_blank"
            rel="noreferrer"
            className="h-8 px-2.5 rounded bg-white/10 hover:bg-white/15 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <span className="hidden sm:inline">Preview</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="h-8 px-2.5 rounded bg-white/10 hover:bg-white/15 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
            title="Reset page"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving}
            className="h-8 px-4 rounded bg-[#17834b] hover:bg-[#1b9656] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Publishing...' : 'Publish'}</span>
          </button>
        </div>
      </header>

      {/* Main Split Area: Resizable/Collapsible Left Panel + Full-Height Canvas */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Mobile Backdrop when sidebar is open on small screens */}
        {!sidebarCollapsed && (
          <div
            onClick={() => setSidebarCollapsed(true)}
            className="fixed inset-0 top-12 bg-black/50 z-30 md:hidden"
          />
        )}

        {/* Collapsible & Resizable Elementor Sidebar */}
        {!sidebarCollapsed && (
          <aside
            style={{ width: `${sidebarWidth}px` }}
            className="fixed md:relative inset-y-12 md:inset-y-0 left-0 z-40 max-w-[88vw] shrink-0 bg-[#1c2026] border-r border-white/10 flex flex-col min-h-0 select-none"
          >
            {/* Primary Sidebar Mode Bar */}
            <div className="grid grid-cols-4 border-b border-white/10 bg-[#181b20] shrink-0">
              {(
                [
                  { id: 'widgets', label: 'Widgets', icon: Grid2x2 },
                  { id: 'inspector', label: 'Edit', icon: Sliders },
                  { id: 'navigator', label: 'Layers', icon: Layers },
                  { id: 'brand', label: 'Site', icon: Palette },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = sidebarView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSidebarView(tab.id)}
                    className={`py-2.5 px-1 text-[11px] font-semibold flex flex-col items-center gap-1 border-b-2 transition-colors cursor-pointer ${
                      active
                        ? 'border-[#17834b] text-white bg-white/5'
                        : 'border-transparent text-white/55 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* VIEW 1: ELEMENTOR WIDGETS LIBRARY */}
            {sidebarView === 'widgets' && (
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={widgetQuery}
                    onChange={(e) => setWidgetQuery(e.target.value)}
                    placeholder="Search widgets..."
                    className={`${fieldClass} pl-8`}
                  />
                </div>

                {(['Basic', 'Layout', 'Platform'] as const).map((category) => {
                  const items = filteredWidgets.filter((w) => w.category === category);
                  if (items.length === 0) return null;
                  return (
                    <div key={category} className="space-y-2">
                      <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                        {category}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {items.map((w) => (
                          <button
                            key={w.type}
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/x-cms-widget', w.type);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={() => addWidget(w.type)}
                            className="p-3 rounded-lg bg-[#242830] hover:bg-[#2c313b] border border-white/10 hover:border-[#17834b] flex flex-col items-center text-center gap-1.5 transition-colors cursor-grab active:cursor-grabbing"
                            title={`${w.description} (Click or drag onto canvas)`}
                          >
                            <span className="text-[#68d28f]">
                              <WidgetIcon type={w.type} />
                            </span>
                            <span className="text-[11px] font-medium text-white leading-tight">
                              {w.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW 2: ELEMENTOR 3-TAB WIDGET INSPECTOR (Content | Style | Advanced) */}
            {sidebarView === 'inspector' && (
              <div className="flex-1 flex flex-col min-h-0">
                {selectedBlock ? (
                  <>
                    <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-[#181b20] shrink-0">
                      <span className="text-xs font-bold text-white truncate">
                        Edit {CMS_BLOCK_CATALOG.find((c) => c.type === selectedBlock.type)?.label || selectedBlock.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSidebarView('widgets')}
                        className="text-[11px] text-[#68d28f] hover:underline cursor-pointer"
                      >
                        + Widgets
                      </button>
                    </div>

                    {/* Content | Style | Advanced Tabs */}
                    <div className="grid grid-cols-3 border-b border-white/10 shrink-0">
                      {(
                        [
                          { id: 'content', label: 'Content', icon: Sliders },
                          { id: 'style', label: 'Style', icon: Palette },
                          { id: 'advanced', label: 'Advanced', icon: Wrench },
                        ] as const
                      ).map((sub) => {
                        const Icon = sub.icon;
                        const active = inspectorTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setInspectorTab(sub.id)}
                            className={`py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1 border-b-2 transition-colors cursor-pointer ${
                              active
                                ? 'border-[#17834b] text-white bg-white/5'
                                : 'border-transparent text-white/55 hover:text-white'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3.5 select-text">
                      {inspectorTab === 'content' && renderContentControls(selectedBlock)}
                      {inspectorTab === 'style' && renderStyleControls(selectedBlock)}
                      {inspectorTab === 'advanced' && renderAdvancedControls(selectedBlock)}
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center text-xs text-white/55 space-y-3">
                    <p>Click any widget on the canvas to edit its Content, Style, and Advanced settings.</p>
                    <button
                      type="button"
                      onClick={() => setSidebarView('widgets')}
                      className="px-3 py-1.5 rounded bg-[#17834b] text-white text-xs font-semibold cursor-pointer"
                    >
                      Browse Widgets
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: NAVIGATOR / LAYER TREE */}
            {sidebarView === 'navigator' && (
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Page Navigator ({currentBlocks.length})
                </p>
                {currentBlocks.map((block, index) => {
                  const isSelected = block.id === selectedBlockId;
                  const meta = CMS_BLOCK_CATALOG.find((c) => c.type === block.type);
                  return (
                    <div
                      key={block.id}
                      className={`rounded-md border p-2 flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-[#17834b] bg-[#17834b]/15'
                          : 'border-white/10 bg-[#242830]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBlockId(block.id);
                          setSidebarView('inspector');
                        }}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="block text-xs font-semibold text-white truncate">
                          {meta?.label || block.type}
                        </span>
                        <span className="block text-[10px] text-white/50 truncate">
                          {block.data?.heading || block.data?.headline || block.data?.text || block.id}
                        </span>
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveBlockById(block.id, -1)}
                          disabled={index === 0}
                          className="p-1 text-white/60 hover:text-white disabled:opacity-25 cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlockById(block.id, 1)}
                          disabled={index === currentBlocks.length - 1}
                          className="p-1 text-white/60 hover:text-white disabled:opacity-25 cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleBlockVisibility(block.id)}
                          className="p-1 text-white/60 hover:text-white cursor-pointer"
                          title={block.visible ? 'Hide' : 'Show'}
                        >
                          {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateBlockById(block.id)}
                          className="p-1 text-white/60 hover:text-white cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBlockById(block.id)}
                          className="p-1 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW 4: GLOBAL SITE SETTINGS (Brand | Menu | Footer | SEO | History) */}
            {sidebarView === 'brand' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-5 border-b border-white/10 shrink-0 bg-[#181b20]">
                  {(
                    [
                      { id: 'brand', label: 'Brand' },
                      { id: 'menu', label: 'Menu' },
                      { id: 'footer', label: 'Footer' },
                      { id: 'seo', label: 'SEO' },
                      { id: 'history', label: 'History' },
                    ] as const
                  ).map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSiteSubTab(sub.id)}
                      className={`py-2.5 text-[10px] font-semibold border-b-2 transition-colors cursor-pointer ${
                        siteSubTab === sub.id
                          ? 'border-[#17834b] text-white bg-white/5'
                          : 'border-transparent text-white/55 hover:text-white'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 select-text">
                  {/* SUB-TAB 1: BRAND */}
                  {siteSubTab === 'brand' && (
                    <>
                      <div>
                        <label className={labelClass}>Platform Name</label>
                        <input
                          type="text"
                          maxLength={80}
                          value={config.brand.name}
                          onChange={(e) => updateBrand({ name: e.target.value })}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Platform Tagline</label>
                        <input
                          type="text"
                          maxLength={160}
                          value={config.brand.tagline}
                          onChange={(e) => updateBrand({ tagline: e.target.value })}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Platform Logo</label>
                        <div className="rounded-lg border border-white/15 bg-[#242830] overflow-hidden mb-2">
                          {config.brand.logoUrl ? (
                            <div className="p-3 bg-black/25 flex items-center justify-center">
                              <img
                                src={config.brand.logoUrl}
                                alt={config.brand.name}
                                className="h-10 w-auto object-contain"
                              />
                            </div>
                          ) : (
                            <div className="py-3 text-center text-[11px] text-white/45">
                              Using monogram badge (no logo uploaded)
                            </div>
                          )}
                          <div className="p-2 flex items-center gap-2 border-t border-white/10">
                            <label className="flex-1 h-8 rounded bg-[#17834b] hover:bg-[#1b9656] text-white text-[11px] font-semibold flex items-center justify-center cursor-pointer">
                              <span>
                                {uploadingField === 'brand-logo'
                                  ? 'Uploading...'
                                  : config.brand.logoUrl
                                  ? 'Replace Logo'
                                  : 'Upload Logo'}
                              </span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                disabled={uploadingField === 'brand-logo'}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageFileUpload(file, 'brand-logo', (url) =>
                                      updateBrand({ logoUrl: url })
                                    );
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {config.brand.logoUrl && (
                              <button
                                type="button"
                                onClick={() => updateBrand({ logoUrl: '' })}
                                className="h-8 px-2.5 rounded bg-white/10 hover:bg-rose-500/20 text-[11px] text-white/80 hover:text-rose-300 cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={config.brand.logoUrl}
                          onChange={(e) => updateBrand({ logoUrl: e.target.value })}
                          placeholder="Or paste logo URL..."
                          className={fieldClass}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className={labelClass}>Primary Color</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={config.brand.primaryColor}
                              onChange={(e) => updateBrand({ primaryColor: e.target.value })}
                              className="h-8 w-9 rounded border border-white/20 bg-transparent cursor-pointer"
                            />
                            <input
                              type="text"
                              value={config.brand.primaryColor}
                              onChange={(e) => updateBrand({ primaryColor: e.target.value })}
                              className={fieldClass}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Accent Color</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={config.brand.accentColor}
                              onChange={(e) => updateBrand({ accentColor: e.target.value })}
                              className="h-8 w-9 rounded border border-white/20 bg-transparent cursor-pointer"
                            />
                            <input
                              type="text"
                              value={config.brand.accentColor}
                              onChange={(e) => updateBrand({ accentColor: e.target.value })}
                              className={fieldClass}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* SUB-TAB 2: HEADER MENU */}
                  {siteSubTab === 'menu' && (() => {
                    const navLinks: CmsNavLink[] =
                      Array.isArray(config.brand.navLinks) && config.brand.navLinks.length > 0
                        ? config.brand.navLinks
                        : DEFAULT_NAV_LINKS;
                    return (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-white/70">Navigation Links</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateBrand({
                                navLinks: [...navLinks, { label: 'New Link', href: '/about' }],
                              })
                            }
                            className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                          >
                            + Add Link
                          </button>
                        </div>

                        <div className="space-y-2">
                          {navLinks.map((link, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-md p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={link.label}
                                  placeholder="Label"
                                  onChange={(e) => {
                                    const next = [...navLinks];
                                    next[idx] = { ...next[idx], label: e.target.value };
                                    updateBrand({ navLinks: next });
                                  }}
                                  className={fieldClass}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBrand({ navLinks: navLinks.filter((_, i) => i !== idx) })
                                  }
                                  className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                                  title="Remove link"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={link.href}
                                placeholder="/pricing"
                                onChange={(e) => {
                                  const next = [...navLinks];
                                  next[idx] = { ...next[idx], href: e.target.value };
                                  updateBrand({ navLinks: next });
                                }}
                                className={fieldClass}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-white/10 space-y-2.5">
                          <div>
                            <label className={labelClass}>Header CTA Button Label</label>
                            <input
                              type="text"
                              value={config.brand.headerCtaLabel ?? 'Set up your school'}
                              onChange={(e) => updateBrand({ headerCtaLabel: e.target.value })}
                              className={fieldClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Header CTA Button URL</label>
                            <input
                              type="text"
                              value={config.brand.headerCtaHref || '/register'}
                              onChange={(e) => updateBrand({ headerCtaHref: e.target.value })}
                              className={fieldClass}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={config.brand.showSignInLink !== false}
                              onChange={(e) => updateBrand({ showSignInLink: e.target.checked })}
                            />
                            <span>Show “Sign in” link in header</span>
                          </label>
                        </div>
                      </div>
                    );
                  })()}

                  {/* SUB-TAB 3: FOOTER BUILDER */}
                  {siteSubTab === 'footer' && (() => {
                    const cols: CmsFooterColumn[] =
                      Array.isArray(config.brand.footerColumns) && config.brand.footerColumns.length > 0
                        ? config.brand.footerColumns
                        : getDefaultFooterColumns(config.brand.name);
                    return (
                      <div className="space-y-3.5">
                        <div>
                          <label className={labelClass}>Footer Description</label>
                          <textarea
                            rows={2}
                            value={config.brand.footerNote}
                            onChange={(e) => updateBrand({ footerNote: e.target.value })}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Copyright Line (optional)</label>
                          <input
                            type="text"
                            value={config.brand.footerCopyright || ''}
                            placeholder={`© ${new Date().getFullYear()} ${config.brand.name}. All rights reserved.`}
                            onChange={(e) => updateBrand({ footerCopyright: e.target.value })}
                            className={fieldClass}
                          />
                        </div>

                        <div className="pt-2 border-t border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-white/70">Footer Columns ({cols.length})</span>
                            {cols.length < 4 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateBrand({
                                    footerColumns: [
                                      ...cols,
                                      { heading: 'Links', links: [{ label: 'Home', href: '/' }] },
                                    ],
                                  })
                                }
                                className="text-[11px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                              >
                                + Add Column
                              </button>
                            )}
                          </div>

                          {cols.map((col, cIdx) => (
                            <div key={cIdx} className="bg-white/5 border border-white/10 rounded-md p-2.5 space-y-2">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={col.heading}
                                  placeholder="Column heading"
                                  onChange={(e) => {
                                    const next = [...cols];
                                    next[cIdx] = { ...next[cIdx], heading: e.target.value };
                                    updateBrand({ footerColumns: next });
                                  }}
                                  className={fieldClass}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBrand({ footerColumns: cols.filter((_, i) => i !== cIdx) })
                                  }
                                  className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                                  title="Delete column"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="space-y-1.5 pl-1">
                                {col.links.map((lnk, lIdx) => (
                                  <div key={lIdx} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                                    <input
                                      type="text"
                                      value={lnk.label}
                                      placeholder="Label"
                                      onChange={(e) => {
                                        const next = [...cols];
                                        const links = [...next[cIdx].links];
                                        links[lIdx] = { ...links[lIdx], label: e.target.value };
                                        next[cIdx] = { ...next[cIdx], links };
                                        updateBrand({ footerColumns: next });
                                      }}
                                      className={fieldClass}
                                    />
                                    <input
                                      type="text"
                                      value={lnk.href}
                                      placeholder="/path"
                                      onChange={(e) => {
                                        const next = [...cols];
                                        const links = [...next[cIdx].links];
                                        links[lIdx] = { ...links[lIdx], href: e.target.value };
                                        next[cIdx] = { ...next[cIdx], links };
                                        updateBrand({ footerColumns: next });
                                      }}
                                      className={fieldClass}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...cols];
                                        next[cIdx] = {
                                          ...next[cIdx],
                                          links: next[cIdx].links.filter((_, i) => i !== lIdx),
                                        };
                                        updateBrand({ footerColumns: next });
                                      }}
                                      className="px-1.5 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...cols];
                                    next[cIdx] = {
                                      ...next[cIdx],
                                      links: [...next[cIdx].links, { label: 'New link', href: '/' }],
                                    };
                                    updateBrand({ footerColumns: next });
                                  }}
                                  className="text-[10px] font-semibold text-[#68d28f] hover:underline cursor-pointer"
                                >
                                  + Add link
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* SUB-TAB 4: PER-PAGE SEO */}
                  {siteSubTab === 'seo' && (() => {
                    const currentSeo = (config.pageSeo || {})[pageKey] || {};
                    const updatePageSeo = (patch: { title?: string; description?: string; ogImage?: string }) => {
                      commitConfig((prev) => ({
                        ...prev,
                        pageSeo: {
                          ...(prev.pageSeo || {}),
                          [pageKey]: {
                            ...((prev.pageSeo || {})[pageKey] || {}),
                            ...patch,
                          },
                        },
                      }));
                    };
                    return (
                      <div className="space-y-3.5">
                        <p className="text-[11px] text-white/60">
                          SEO &amp; social sharing metadata for <strong className="text-white">{currentPageMeta.title}</strong> ({currentPageMeta.route}).
                        </p>
                        <div>
                          <label className={labelClass}>Meta Title</label>
                          <input
                            type="text"
                            maxLength={120}
                            value={currentSeo.title || ''}
                            placeholder={`${currentPageMeta.title} — ${config.brand.name}`}
                            onChange={(e) => updatePageSeo({ title: e.target.value })}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Meta Description</label>
                          <textarea
                            rows={3}
                            maxLength={260}
                            value={currentSeo.description || ''}
                            placeholder={config.brand.tagline}
                            onChange={(e) => updatePageSeo({ description: e.target.value })}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Social Share Image URL (OG Image)</label>
                          <input
                            type="text"
                            value={currentSeo.ogImage || ''}
                            placeholder="https://... or /uploads/..."
                            onChange={(e) => updatePageSeo({ ogImage: e.target.value })}
                            className={fieldClass}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* SUB-TAB 5: VERSION HISTORY / REVISIONS */}
                  {siteSubTab === 'history' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white/75">
                          Saved Revisions ({revisions.length})
                        </span>
                        <button
                          type="button"
                          onClick={loadRevisions}
                          className="text-[11px] text-[#68d28f] hover:underline cursor-pointer"
                        >
                          Refresh
                        </button>
                      </div>
                      {loadingRevisions ? (
                        <p className="text-xs text-white/50">Loading revision history...</p>
                      ) : revisions.length === 0 ? (
                        <p className="text-xs text-white/50">
                          Revisions are captured automatically each time you click Publish.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {revisions.map((rev) => (
                            <div
                              key={rev.id}
                              className="bg-white/5 border border-white/10 rounded-md p-2.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-white truncate">
                                  {rev.summary}
                                </span>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => handleRestoreRevision(rev.id)}
                                  className="px-2 py-0.5 rounded bg-[#17834b] hover:bg-[#1b9656] text-white text-[10px] font-semibold shrink-0 cursor-pointer"
                                >
                                  Restore
                                </button>
                              </div>
                              <p className="text-[10px] text-white/50">
                                {rev.author} · {new Date(rev.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Drag Handle to Resize Sidebar Width */}
            <div
              onMouseDown={startResizing}
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#17834b]/70 transition-colors z-30"
              title="Drag to resize editor panel"
            />
          </aside>
        )}

        {/* Edge Collapse / Expand Toggle Tab (Just like Elementor!) */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((c) => !c)}
          style={{ left: sidebarCollapsed ? 0 : `${sidebarWidth}px` }}
          className="fixed top-1/2 -translate-y-1/2 z-40 h-14 w-5 bg-[#181b20] hover:bg-[#17834b] border border-l-0 border-white/15 rounded-r-md flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          title={sidebarCollapsed ? 'Expand editor panel' : 'Collapse editor panel'}
          aria-label={sidebarCollapsed ? 'Expand editor panel' : 'Collapse editor panel'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Right Full-Height Live Interactive Canvas */}
        <main className="flex-1 overflow-y-auto bg-[#262b33] p-4 sm:p-6">
          <div
            className={`mx-auto transition-[max-width] duration-200 bg-white shadow-2xl overflow-hidden ${previewWidthClass}`}
          >
            <LandingClient
              plans={plans}
              cmsConfig={config}
              pageKey={isValidCmsPageKey(pageKey) ? pageKey : 'home'}
              customBlocks={isValidCmsPageKey(pageKey) ? undefined : currentBlocks}
              editorMode
              previewViewport={viewport}
              selectedBlockId={selectedBlockId}
              onSelectBlock={(id) => {
                setSelectedBlockId(id);
                setSidebarView('inspector');
              }}
              onMoveBlock={moveBlockById}
              onDuplicateBlock={duplicateBlockById}
              onDeleteBlock={deleteBlockById}
              onDropNewWidget={(type) => addWidget(type)}
              onUpdateBlockData={updateBlockData}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
