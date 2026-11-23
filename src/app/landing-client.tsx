'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
import { useLanguage } from '@/components/language-provider';
import { getPlanFeatureCopy } from '@/lib/plan-feature-copy';
import type {
  CmsBlock,
  CmsBlockType,
  CmsPageKey,
  PublicSiteCmsConfig,
} from '@/lib/public-site-cms-schema';

export interface PlanFeatureData {
  featureKey: string;
  enabledByDefault: boolean;
  feature: { name: string; description?: string | null };
}

export interface PlanData {
  id: string;
  name: string;
  studentCeiling: number;
  price: number;
  pinRequired: boolean;
  platformFeePercent: number;
  features: PlanFeatureData[];
}

interface LandingClientProps {
  plans: PlanData[];
  cmsConfig: PublicSiteCmsConfig;
  pageKey?: CmsPageKey;
  customBlocks?: CmsBlock[];
  editorMode?: boolean;
  previewViewport?: 'desktop' | 'tablet' | 'mobile';
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  onMoveBlock?: (blockId: string, direction: -1 | 1) => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onDropNewWidget?: (type: CmsBlockType, insertIndex?: number) => void;
  onUpdateBlockData?: (blockId: string, patch: Record<string, any>) => void;
}

function toVideoEmbedUrl(raw: string): { kind: 'iframe' | 'mp4' | 'none'; src: string } {
  const url = (raw || '').trim();
  if (!url) return { kind: 'none', src: '' };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { kind: 'mp4', src: url };
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  if (ytMatch) return { kind: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  if (/^https?:\/\//i.test(url)) return { kind: 'iframe', src: url };
  return { kind: 'none', src: '' };
}

function LeadFormWidget({
  heading,
  subtitle,
  buttonLabel,
  showSchoolField,
  showPhoneField,
  accentColor,
  sourcePage,
  editorMode,
  isMobilePreview,
}: {
  heading: string;
  subtitle?: string;
  buttonLabel?: string;
  showSchoolField?: boolean;
  showPhoneField?: boolean;
  accentColor: string;
  sourcePage: string;
  editorMode?: boolean;
  isMobilePreview?: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editorMode) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/platform/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, schoolName, message, sourcePage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit inquiry');
      setFeedback({ type: 'success', text: data.message || 'Inquiry submitted!' });
      setName('');
      setEmail('');
      setPhone('');
      setSchoolName('');
      setMessage('');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Submission failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-[#f4f2ec] border-y border-[#e6e4de]">
      <div
        className={`mx-auto max-w-4xl px-5 ${
          isMobilePreview ? 'py-12' : 'py-16 sm:px-8 sm:py-24'
        }`}
      >
        <div className="max-w-2xl">
          <h2
            className={`tenant-editorial-display font-normal leading-[1.04] tracking-[-0.025em] text-[#141518] ${
              isMobilePreview ? 'text-[32px]' : 'text-[36px] sm:text-[48px]'
            }`}
          >
            {heading || 'Book a live walkthrough'}
          </h2>
          {subtitle && <p className="mt-3 text-sm leading-6 text-[#5a5b60]">{subtitle}</p>}
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl bg-white border border-[#e6e4de] p-6 sm:p-8 space-y-4 shadow-[0_1px_3px_rgba(17,17,16,0.04)]"
        >
          {feedback && (
            <div
              className={`rounded-lg px-4 py-3 text-xs font-medium border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className={`grid gap-4 ${isMobilePreview ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            <div>
              <label className="block text-xs font-semibold text-[#141518] mb-1.5">Full name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mrs. Adebayo"
                className="w-full rounded-lg border border-[#d5d2ca] bg-white px-3.5 py-2.5 text-sm text-[#141518] focus:outline-none focus:border-[#141518]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#141518] mb-1.5">Email address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="principal@school.edu"
                className="w-full rounded-lg border border-[#d5d2ca] bg-white px-3.5 py-2.5 text-sm text-[#141518] focus:outline-none focus:border-[#141518]"
              />
            </div>
            {showSchoolField !== false && (
              <div>
                <label className="block text-xs font-semibold text-[#141518] mb-1.5">School name</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Greenfield Academy"
                  className="w-full rounded-lg border border-[#d5d2ca] bg-white px-3.5 py-2.5 text-sm text-[#141518] focus:outline-none focus:border-[#141518]"
                />
              </div>
            )}
            {showPhoneField !== false && (
              <div>
                <label className="block text-xs font-semibold text-[#141518] mb-1.5">Phone / WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-lg border border-[#d5d2ca] bg-white px-3.5 py-2.5 text-sm text-[#141518] focus:outline-none focus:border-[#141518]"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#141518] mb-1.5">How can we help? *</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us your approximate student population and what you'd like to see..."
              className="w-full rounded-lg border border-[#d5d2ca] bg-white px-3.5 py-2.5 text-sm text-[#141518] focus:outline-none focus:border-[#141518]"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              {submitting ? 'Sending...' : buttonLabel || 'Request Demo'} <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function ProductPreview({ platformName, accentColor }: { platformName: string; accentColor: string }) {
  const [activeView, setActiveView] = useState<'portal' | 'fees' | 'schools'>('portal');

  const tabs: Array<{ id: 'portal' | 'fees' | 'schools'; label: string }> = [
    { id: 'portal', label: 'Results & Reports' },
    { id: 'fees', label: 'Fee Ledger' },
    { id: 'schools', label: 'Multi-School Hub' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[620px]" data-ui="sample-product-preview">
      {/* Main Interactive App Stage (Warm Alabaster + Precision Chrome) */}
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#faf9f6] text-[#141518] shadow-[0_24px_64px_rgba(0,0,0,0.38)]">
        {/* Top Browser / App Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6e4de] bg-[#f2f0eb] px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#d4d1ca]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d4d1ca]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d4d1ca]" />
            <span className="ml-2 font-mono text-[10px] text-[#717278]">
              {activeView === 'schools' ? 'admin.yourdomain.com' : 'apex.yourdomain.com'}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-[#e6e4de]/70 p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                  activeView === tab.id
                    ? 'bg-white text-[#141518] shadow-xs'
                    : 'text-[#5a5b60] hover:text-[#141518]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Stage Content */}
        <div className="p-5 sm:p-6">
          {activeView === 'portal' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Verified Access Code
                  </span>
                  <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-[#141518]">
                    Academic Progress Report
                  </h3>
                  <p className="text-[11px] text-[#717278]">Grade 10 Honors · Term 2 · 2025/2026 Session</p>
                </div>
                <div className="rounded-xl border border-[#e6e4de] bg-white px-3.5 py-2 text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#717278]">Average</p>
                  <p className="text-[20px] font-bold tabular-nums text-[#141518]">91.4%</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#e6e4de] bg-white">
                <div className="grid grid-cols-[1.4fr_.6fr_.6fr_.5fr] border-b border-[#e6e4de] bg-[#f6f5f2] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#717278]">
                  <span>Subject</span>
                  <span className="text-right">Coursework</span>
                  <span className="text-right">Exam</span>
                  <span className="text-right">Grade</span>
                </div>
                {[
                  { subject: 'Mathematics', ca: 38, exam: 56, grade: 'A+' },
                  { subject: 'Physics', ca: 36, exam: 53, grade: 'A' },
                  { subject: 'World Literature', ca: 35, exam: 54, grade: 'A' },
                  { subject: 'Computer Science', ca: 37, exam: 51, grade: 'A' },
                ].map((row) => (
                  <div
                    key={row.subject}
                    className="grid grid-cols-[1.4fr_.6fr_.6fr_.5fr] items-center border-t border-[#efede9] px-3.5 py-2.5 text-[12px]"
                  >
                    <span className="font-medium text-[#141518]">{row.subject}</span>
                    <span className="text-right tabular-nums text-[#5a5b60]">{row.ca}</span>
                    <span className="text-right tabular-nums text-[#5a5b60]">{row.exam}</span>
                    <span className="text-right font-mono text-[11px] font-bold text-emerald-700">{row.grade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'fees' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#717278]">
                    Direct-to-School Settlement
                  </p>
                  <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#141518]">
                    Term Fee Collection Ledger
                  </h3>
                </div>
                <span
                  className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  88% Collected
                </span>
              </div>

              <div className="rounded-xl border border-[#e6e4de] bg-white p-4">
                <div className="flex items-center justify-between text-[11px] text-[#717278]">
                  <span>Settled directly to school bank account</span>
                  <span className="font-mono font-semibold text-[#141518]">412 / 468 students</span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#efede9]">
                  <div className="h-full rounded-full" style={{ width: '88%', backgroundColor: accentColor }} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#efede9] pt-3">
                  <div>
                    <p className="text-[10px] text-[#717278]">Online Gateways</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-[#141518]">Stripe · Paystack</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#717278]">Receipts</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-emerald-700">Auto-issued</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#717278]">Reconciliation</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-[#141518]">Instant</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div className="flex items-center justify-between rounded-lg border border-[#e6e4de] bg-white px-3 py-2.5">
                  <span className="font-medium text-[#141518]">Tuition — Grade 11</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Settled
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#e6e4de] bg-white px-3 py-2.5">
                  <span className="font-medium text-[#141518]">Campus Bus — Term 2</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Settled
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeView === 'schools' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#717278]">
                    {platformName} Control Plane
                  </p>
                  <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#141518]">
                    Isolated School Workspaces
                  </h3>
                </div>
                <span className="rounded-full border border-[#e6e4de] bg-white px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#141518]">
                  Multi-Tenant
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { name: 'Apex International Academy', slug: '/apex', students: '1,240', plan: 'Enterprise', status: 'Active' },
                  { name: 'Greenfield Grammar School', slug: '/greenfield', students: '680', plan: 'Growth', status: 'Active' },
                  { name: 'St. Jude Preparatory', slug: '/stjude', students: '310', plan: 'Starter', status: 'Trial' },
                ].map((school) => (
                  <div
                    key={school.slug}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#e6e4de] bg-white px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-[#141518]">{school.name}</p>
                      <p className="font-mono text-[10px] text-[#717278]">
                        {school.slug} · {school.students} students · {school.plan}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        school.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : 'bg-amber-500/15 text-amber-800'
                      }`}
                    >
                      {school.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FaqSection({
  heading,
  items,
}: {
  heading: string;
  items: Array<{ question: string; answer: string }>;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
      <h2 className="text-3xl font-bold tracking-[-0.03em] text-[#0a0a0a] sm:text-4xl">{heading}</h2>
      <div className="mt-8 divide-y divide-[#e4e2dd] border-y border-[#e4e2dd]">
        {items.map((item, idx) => {
          const open = openIdx === idx;
          return (
            <div key={idx} className="py-5">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : idx)}
                className="flex w-full items-center justify-between gap-4 text-left text-base font-semibold text-[#0a0a0a] cursor-pointer"
              >
                <span>{item.question}</span>
                <span className="text-xl font-normal text-[#66645e]">{open ? '−' : '+'}</span>
              </button>
              {open && <p className="mt-3 max-w-3xl text-sm leading-7 text-[#57554f]">{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LandingClient({
  plans,
  cmsConfig,
  pageKey = 'home',
  customBlocks,
  editorMode = false,
  previewViewport,
  selectedBlockId = null,
  onSelectBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onDropNewWidget,
  onUpdateBlockData,
}: LandingClientProps) {
  const { formatMoney, localization, t, tp } = useLanguage();
  const { brand } = cmsConfig;
  const [estimatedStudents, setEstimatedStudents] = useState(350);
  const [visitorCurrency, setVisitorCurrency] = useState<string>('');
  const [visitorRates, setVisitorRates] = useState<Record<string, { symbol: string; rate: number }>>({});

  const VISITOR_CURRENCIES = [
    { code: localization.currencyCode, symbol: localization.currencySymbol, label: localization.currencyCode },
    { code: 'USD', symbol: '$', label: 'USD' },
    { code: 'GBP', symbol: '£', label: 'GBP' },
    { code: 'EUR', symbol: '€', label: 'EUR' },
    { code: 'NGN', symbol: '₦', label: 'NGN' },
  ].filter((c, i, arr) => arr.findIndex((x) => x.code === c.code) === i);

  const handleSelectVisitorCurrency = async (code: string, symbol: string) => {
    if (code === localization.currencyCode) {
      setVisitorCurrency('');
      return;
    }
    setVisitorCurrency(code);
    if (visitorRates[code]) return;
    try {
      const base = localization.baseCurrencyCode || localization.currencyCode || 'NGN';
      const res = await fetch(`/api/platform/exchange-rates?from=${encodeURIComponent(base)}&to=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && typeof data.rate === 'number' && data.rate > 0) {
        setVisitorRates((prev) => ({ ...prev, [code]: { symbol, rate: data.rate } }));
      }
    } catch {
      // keep fallback
    }
  };

  const formatPlanPrice = (baseAmount: number, decimals = 0) => {
    if (visitorCurrency && visitorRates[visitorCurrency]) {
      const { symbol, rate } = visitorRates[visitorCurrency];
      const converted = baseAmount * rate;
      return `${symbol}${converted.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    }
    return formatMoney(baseAmount, decimals);
  };
  const blocks = customBlocks ?? cmsConfig.pages?.[pageKey] ?? cmsConfig.blocks ?? [];
  const visibleBlocks = blocks.filter((b) => {
    if (!b.visible) return false;
    if (previewViewport === 'mobile' && b.advanced?.hideMobile) return false;
    if (previewViewport === 'tablet' && b.advanced?.hideTablet) return false;
    if (previewViewport === 'desktop' && b.advanced?.hideDesktop) return false;
    return true;
  });
  const isMobilePreview = previewViewport === 'mobile';
  const isTabletPreview = previewViewport === 'tablet';

  const handleLinkClick = (e: React.MouseEvent) => {
    if (editorMode) e.preventDefault();
  };

  const getMaxWidthClass = (maxW?: string) => {
    switch (maxW) {
      case 'full':
        return 'w-full';
      case '5xl':
        return 'max-w-5xl mx-auto px-5 sm:px-8';
      case '3xl':
        return 'max-w-3xl mx-auto px-5 sm:px-8';
      case '7xl':
      default:
        return 'max-w-7xl mx-auto px-5 sm:px-8 lg:px-10';
    }
  };

  const renderBlock = (block: CmsBlock) => {
    const d = block.data || {};
    const s = block.style || {};
    const adv = block.advanced || {};
    const containerClass = getMaxWidthClass(adv.maxWidth);
    const alignClass =
      s.textAlign === 'center' ? 'text-center' : s.textAlign === 'right' ? 'text-right' : 'text-left';

    switch (block.type) {
      case 'heading': {
        const Tag = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(d.tag) ? d.tag : 'h2') as
          | 'h1'
          | 'h2'
          | 'h3'
          | 'h4'
          | 'h5'
          | 'h6';
        return (
          <div className={`${containerClass} ${alignClass}`}>
            <Tag
              contentEditable={Boolean(editorMode && onUpdateBlockData)}
              suppressContentEditableWarning
              onBlur={
                editorMode && onUpdateBlockData
                  ? (e) => {
                      const nextText = e.currentTarget.textContent || '';
                      if (nextText !== (d.text || '')) {
                        onUpdateBlockData(block.id, { text: nextText });
                      }
                    }
                  : undefined
              }
              className={`tracking-[-0.03em] leading-[1.12] ${
                editorMode && onUpdateBlockData ? 'focus:outline-dashed focus:outline-1 focus:outline-[#17834b]' : ''
              }`}
              style={{
                fontSize: s.fontSize ? `${s.fontSize}px` : '36px',
                fontWeight: s.fontWeight || '700',
                color: s.textColor || '#0a0a0a',
              }}
            >
              {d.text || 'Heading text'}
            </Tag>
          </div>
        );
      }

      case 'text':
        return (
          <div className={`${containerClass} ${alignClass}`}>
            <p
              contentEditable={Boolean(editorMode && onUpdateBlockData)}
              suppressContentEditableWarning
              onBlur={
                editorMode && onUpdateBlockData
                  ? (e) => {
                      const nextText = e.currentTarget.textContent || '';
                      if (nextText !== (d.content || '')) {
                        onUpdateBlockData(block.id, { content: nextText });
                      }
                    }
                  : undefined
              }
              className={`whitespace-pre-line leading-[1.7] ${
                editorMode && onUpdateBlockData ? 'focus:outline-dashed focus:outline-1 focus:outline-[#17834b]' : ''
              }`}
              style={{
                fontSize: s.fontSize ? `${s.fontSize}px` : '16px',
                fontWeight: s.fontWeight || '400',
                color: s.textColor || '#4f4d48',
              }}
            >
              {d.content || ''}
            </p>
          </div>
        );

      case 'image':
        return (
          <div className={containerClass}>
            {d.src ? (
              <figure className="space-y-2">
                <img
                  src={d.src}
                  alt={d.alt || ''}
                  className="w-full object-cover"
                  style={{
                    borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined,
                    aspectRatio: d.aspectRatio && d.aspectRatio !== 'auto' ? d.aspectRatio : undefined,
                  }}
                />
                {d.caption && (
                  <figcaption className={`text-xs text-[#66645e] ${alignClass}`}>{d.caption}</figcaption>
                )}
              </figure>
            ) : (
              <div
                className="w-full py-16 bg-[#f4f3f1] border border-dashed border-[#d4d1ca] text-center text-xs text-[#66645e]"
                style={{ borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined }}
              >
                Image Widget — paste an Image URL in the Content tab
              </div>
            )}
          </div>
        );

      case 'button': {
        const isOutline = d.variant === 'outline';
        const btnBg = isOutline ? 'transparent' : s.accentColor || brand.accentColor;
        const btnColor = isOutline ? s.accentColor || brand.accentColor : s.textColor || '#ffffff';
        const justifyClass =
          s.textAlign === 'center'
            ? 'justify-center'
            : s.textAlign === 'right'
            ? 'justify-end'
            : 'justify-start';
        return (
          <div className={`${containerClass} flex ${justifyClass}`}>
            <Link
              href={d.href || '/register'}
              onClick={handleLinkClick}
              className="inline-flex min-h-11 items-center justify-center px-6 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                backgroundColor: btnBg,
                color: btnColor,
                border: isOutline ? `1.5px solid ${s.accentColor || brand.accentColor}` : undefined,
                borderRadius: s.borderRadius !== undefined ? `${s.borderRadius}px` : '6px',
              }}
            >
              {d.label || 'Click here'}
            </Link>
          </div>
        );
      }

      case 'columns': {
        const cols = Number(d.columnCount) === 2 ? 2 : 3;
        const items: Array<{ title: string; body: string }> = Array.isArray(d.items) ? d.items : [];
        const colGridClass = isMobilePreview
          ? 'grid-cols-1'
          : isTabletPreview
          ? 'grid-cols-2'
          : cols === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : 'grid-cols-1 md:grid-cols-3';
        return (
          <div className={containerClass}>
            <div className={`grid gap-6 ${colGridClass}`}>
              {items.map((col, idx) => (
                <div
                  key={idx}
                  className="p-6 border border-[#e4e2dd] bg-white space-y-2"
                  style={{ borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined }}
                >
                  <h3 className="text-base font-bold text-[#0a0a0a]">{col.title}</h3>
                  <p className="text-sm leading-6 text-[#57554f]">{col.body}</p>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'spacer':
        return <div style={{ height: `${Number(d.height) || 48}px` }} aria-hidden="true" />;

      case 'divider':
        return (
          <div className={containerClass}>
            <hr
              style={{
                border: 0,
                borderTopWidth: `${Number(d.thickness) || 1}px`,
                borderTopStyle: 'solid',
                borderTopColor: s.borderColor || '#e4e2dd',
              }}
            />
          </div>
        );

      case 'hero': {
        const mediaMode =
          d.heroMediaMode ||
          (d.heroImageUrl ? 'image' : d.showProductPreview !== false ? 'preview' : 'none');
        const hasRightMedia =
          (mediaMode === 'image' && Boolean(d.heroImageUrl)) ||
          (mediaMode === 'image' && editorMode) ||
          mediaMode === 'preview';

        return (
          <section
            className="overflow-hidden text-white"
            style={{ backgroundColor: s.bgColor || brand.primaryColor }}
          >
            <div
              className={`mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 ${
                !hasRightMedia || isMobilePreview || isTabletPreview
                  ? 'grid-cols-1'
                  : 'sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:gap-10 lg:px-10'
              }`}
            >
              <div className={`relative z-10 ${hasRightMedia ? 'max-w-[560px]' : 'max-w-3xl'}`}>
                <h1
                  className={`tenant-editorial-display text-balance font-normal leading-[0.98] tracking-[-0.03em] ${
                    isMobilePreview ? 'text-[40px]' : 'text-[50px] sm:text-[68px]'
                  }`}
                >
                  {tp(d.headline || 'A clear view of your school,')}{' '}
                  {d.highlight && <span className="italic opacity-90">{tp(d.highlight)}</span>}
                </h1>
                <p className="mt-6 max-w-[470px] text-[15px] leading-7 text-white/80 sm:text-base">
                  {tp(d.subtitle || '')}
                </p>
                <div
                  className={`mt-8 flex flex-col gap-3 ${
                    isMobilePreview ? '' : 'sm:flex-row'
                  }`}
                >
                  {d.primaryCtaLabel && (
                    <Link
                      href={d.primaryCtaHref || '/register'}
                      onClick={handleLinkClick}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
                      style={{ backgroundColor: s.accentColor || brand.accentColor }}
                    >
                      {tp(d.primaryCtaLabel)} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                  {d.secondaryCtaLabel && (
                    <Link
                      href={d.secondaryCtaHref || '/services'}
                      onClick={handleLinkClick}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:bg-white/12"
                    >
                      {tp(d.secondaryCtaLabel)}
                    </Link>
                  )}
                </div>
                {Array.isArray(d.audienceTags) && d.audienceTags.length > 0 && (
                  <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/75">
                    {d.audienceTags.map((tag: string, i: number) => (
                      <span key={i}>{tp(tag)}</span>
                    ))}
                  </div>
                )}
              </div>

              {mediaMode === 'image' && (
                <div className="w-full">
                  {d.heroImageUrl ? (
                    <div
                      className="aspect-[4/3] w-full overflow-hidden bg-white/10"
                      style={{ borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined }}
                    >
                      <img
                        src={d.heroImageUrl}
                        alt={d.heroImageAlt || d.headline || brand.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : editorMode ? (
                    <div className="aspect-[4/3] w-full border border-dashed border-white/35 bg-white/5 flex flex-col items-center justify-center p-8 text-center">
                      <p className="text-sm font-semibold text-white">Hero Image Slot</p>
                      <p className="mt-1 text-xs text-white/65">
                        Upload or paste an image URL in the Content tab → Hero Media
                      </p>
                    </div>
                  ) : null}
                </div>
              )}

              {mediaMode === 'preview' && (
                <ProductPreview platformName={brand.name} accentColor={s.accentColor || brand.accentColor} />
              )}
            </div>
          </section>
        );
      }

      case 'capabilities': {
        const items = Array.isArray(d.items) ? d.items : [];
        return (
          <section className={`mx-auto max-w-7xl px-5 ${isMobilePreview ? 'py-12' : 'py-20 sm:px-8 sm:py-28 lg:px-10'}`}>
            <div
              className={`grid gap-6 border-b border-[#e4e2dd] pb-10 ${
                isMobilePreview ? 'grid-cols-1' : 'md:grid-cols-[.9fr_1.1fr] md:items-end'
              }`}
            >
              <h2
                className={`tenant-editorial-display max-w-[16ch] font-normal leading-[1.02] tracking-[-0.025em] text-[#0a0a0a] ${
                  isMobilePreview ? 'text-[34px]' : 'text-[38px] sm:text-[52px]'
                }`}
              >
                {tp(d.heading || 'Give every task a clear next step.')}
              </h2>
              <p
                className={`max-w-xl text-sm leading-7 text-[#57554f] ${
                  isMobilePreview ? '' : 'md:justify-self-end sm:text-base'
                }`}
              >
                {tp(d.subtitle || '')}
              </p>
            </div>
            <div className={`mt-6 grid gap-0 ${isMobilePreview ? 'grid-cols-1 divide-y divide-[#e4e2dd]' : 'md:grid-cols-2'}`}>
              {items.map((item: { title: string; description: string }, index: number) => (
                <article
                  key={index}
                  className={
                    isMobilePreview
                      ? 'py-5'
                      : `py-6 ${index % 2 === 1 ? 'md:pl-8 md:border-l md:border-[#e4e2dd]' : 'md:pr-8'} ${
                          index > 1 ? 'border-t border-[#e4e2dd]' : ''
                        }`
                  }
                >
                  <span className="mb-2 block font-mono text-[11px] font-semibold tracking-wider text-[#717278]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-[#141518]">{tp(item.title)}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-[#57554f]">{tp(item.description)}</p>
                </article>
              ))}
            </div>
          </section>
        );
      }

      case 'showcase': {
        const bullets = Array.isArray(d.bullets) ? d.bullets : [];
        return (
          <section className="bg-[#f4f3f1]">
            <div
              className={`mx-auto grid max-w-7xl items-center gap-10 px-5 ${
                isMobilePreview || isTabletPreview
                  ? 'grid-cols-1 py-12'
                  : 'py-16 sm:px-8 sm:py-20 lg:grid-cols-[.85fr_1.15fr] lg:gap-16 lg:px-10'
              }`}
            >
              <div>
                <h2
                  className={`tenant-editorial-display max-w-[14ch] font-normal leading-[1.02] tracking-[-0.025em] text-[#0a0a0a] ${
                    isMobilePreview ? 'text-[34px]' : 'text-[38px] sm:text-[50px]'
                  }`}
                >
                  {tp(d.heading || 'Know what needs attention.')}
                </h2>
                <p className="mt-5 max-w-lg text-sm leading-7 text-[#57554f] sm:text-base">{tp(d.body || '')}</p>
                {bullets.length > 0 && (
                  <ul className="mt-6 space-y-2.5 text-sm text-[#0a0a0a]">
                    {bullets.map((b: string, i: number) => (
                      <li key={i} className="flex items-center gap-2.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: brand.accentColor }}
                        />
                        <span>{tp(b)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {d.ctaLabel && (
                  <Link
                    href={d.ctaHref || '/services'}
                    onClick={handleLinkClick}
                    className="mt-7 inline-flex items-center gap-2 text-sm font-bold hover:opacity-80"
                    style={{ color: brand.accentColor }}
                  >
                    {tp(d.ctaLabel)} <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl border border-[#e6e4de] bg-white shadow-[0_8px_30px_rgba(17,17,16,0.06)]" data-ui="sample-workspace">
                <div className="flex items-center justify-between border-b border-[#e6e4de] px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-[#141518]">{brand.name}</p>
                    <p className="text-[11px] text-[#717278]">{tp('School administration overview')}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                    {tp('Current term')}
                  </span>
                </div>
                <div
                  className={`border-b border-[#e4e2dd] bg-[#f9f8f6] ${
                    isMobilePreview
                      ? 'grid grid-cols-1 divide-y divide-[#e4e2dd]'
                      : 'grid grid-cols-3 divide-x divide-[#e4e2dd]'
                  }`}
                >
                  <div className="p-4">
                    <p className="text-[11px] text-[#66645e]">{tp('Attendance')}</p>
                    <p className="mt-1 text-sm font-bold text-[#0a0a0a]">{tp('Class registers')}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] text-[#66645e]">{tp('Fees')}</p>
                    <p className="mt-1 text-sm font-bold text-[#0a0a0a]">{tp('Payment ledgers')}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] text-[#66645e]">{tp('Results')}</p>
                    <p className="mt-1 text-sm font-bold text-[#0a0a0a]">{tp('Term reports')}</p>
                  </div>
                </div>
                <div className="divide-y divide-[#efede9] px-4 py-3 text-xs">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="font-medium text-[#0a0a0a]">{tp('Class attendance registers')}</span>
                    <span className="font-semibold text-[#1f6b3a]">{tp('Ready')}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="font-medium text-[#0a0a0a]">{tp('Termly report cards')}</span>
                    <span className="font-semibold text-[#8f4f0e]">{tp('In review')}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      case 'roles': {
        const items = Array.isArray(d.items) ? d.items : [];
        return (
          <section className={`mx-auto max-w-7xl px-5 ${isMobilePreview ? 'py-12' : 'py-16 sm:px-8 sm:py-24 lg:px-10'}`}>
            <div
              className={`grid gap-6 ${
                isMobilePreview ? 'grid-cols-1' : 'gap-8 md:grid-cols-[.85fr_1.15fr] md:items-end'
              }`}
            >
              <h2
                className={`tenant-editorial-display max-w-[14ch] font-normal leading-[1.02] tracking-[-0.025em] text-[#0a0a0a] ${
                  isMobilePreview ? 'text-[34px]' : 'text-[38px] sm:text-[50px]'
                }`}
              >
                {tp(d.heading || 'A useful view for each role.')}
              </h2>
              <p
                className={`max-w-xl text-sm leading-7 text-[#57554f] ${
                  isMobilePreview ? '' : 'md:justify-self-end sm:text-base'
                }`}
              >
                {tp(d.subtitle || '')}
              </p>
            </div>
            <div className="mt-8 divide-y divide-[#e4e2dd] border-y border-[#e4e2dd]">
              {items.map((item: { role: string; description: string }, idx: number) => (
                <article
                  key={idx}
                  className={`grid gap-2 py-5 ${
                    isMobilePreview ? 'grid-cols-1' : 'gap-3 sm:grid-cols-[200px_1fr] sm:gap-8'
                  }`}
                >
                  <h3 className="text-sm font-bold text-[#0a0a0a]">{tp(item.role)}</h3>
                  <p className="max-w-3xl text-sm leading-6 text-[#57554f]">{tp(item.description)}</p>
                </article>
              ))}
            </div>
          </section>
        );
      }

      case 'plans':
        return (
          <section className="text-white" id="plans" style={{ backgroundColor: brand.primaryColor }}>
            <div className={`mx-auto max-w-7xl px-5 ${isMobilePreview ? 'py-12' : 'py-16 sm:px-8 sm:py-20 lg:px-10'}`}>
              <div
                className={`grid gap-5 ${
                  isMobilePreview ? 'grid-cols-1' : 'md:grid-cols-[1fr_auto] md:items-end'
                }`}
              >
                <div>
                  <h2
                    className={`tenant-editorial-display max-w-[16ch] font-normal leading-[1.02] tracking-[-0.025em] ${
                      isMobilePreview ? 'text-[34px]' : 'text-[38px] sm:text-[52px]'
                    }`}
                  >
                    {tp(d.heading || 'Choose what fits your school.')}
                  </h2>
                  {d.subtitle && <p className="mt-2 text-sm text-white/75">{tp(d.subtitle)}</p>}
                </div>
                {d.compareLabel && (
                  <Link
                    href={d.compareHref || '/pricing'}
                    onClick={handleLinkClick}
                    className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    {tp(d.compareLabel)} <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>

              {plans.length > 0 ? (
                <>
                  {/* Stripe-Style Interactive Student Estimator + Live Currency Switcher */}
                  {!editorMode && (
                    <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-xs sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1 max-w-md">
                        <div className="flex items-center justify-between text-xs text-white/85">
                          <span className="font-medium">Estimate by student enrollment</span>
                          <span className="rounded-md bg-white/12 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                            {estimatedStudents.toLocaleString()} students
                          </span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={Math.max(2000, ...plans.map((p) => p.studentCeiling))}
                          step={50}
                          value={estimatedStudents}
                          onChange={(e) => setEstimatedStudents(Number(e.target.value))}
                          aria-label="Estimated student count"
                          className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-[11px] font-medium text-white/65">Currency:</span>
                        {VISITOR_CURRENCIES.map((cur) => {
                          const active = (visitorCurrency || localization.currencyCode) === cur.code;
                          return (
                            <button
                              key={cur.code}
                              type="button"
                              onClick={() => void handleSelectVisitorCurrency(cur.code, cur.symbol)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                                active
                                  ? 'bg-white text-[#141518] shadow-xs'
                                  : 'border border-white/15 bg-white/5 text-white/80 hover:bg-white/15'
                              }`}
                            >
                              {cur.symbol} {cur.code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-7 grid gap-4 ${
                      isMobilePreview
                        ? 'grid-cols-1'
                        : isTabletPreview
                        ? 'grid-cols-2'
                        : 'md:grid-cols-2 xl:grid-cols-3'
                    }`}
                  >
                    {plans.slice(0, 3).map((plan, planIdx) => {
                      const enabledFeatures = plan.features.filter((feature) => feature.enabledByDefault);
                      const previewFeatures = enabledFeatures.slice(0, 4);
                      const remainingFeatures = Math.max(0, enabledFeatures.length - previewFeatures.length);
                      const recommendedPlan =
                        plans.slice(0, 3).find((p) => p.studentCeiling >= estimatedStudents) ||
                        plans.slice(0, 3)[plans.slice(0, 3).length - 1];
                      const isRecommended = !editorMode
                        ? recommendedPlan?.id === plan.id
                        : plans.length >= 2 && planIdx === 1;
                      const perStudent = estimatedStudents > 0 ? Number(plan.price) / Math.min(estimatedStudents, plan.studentCeiling || estimatedStudents) : 0;
                      return (
                        <article
                          key={plan.id}
                          className={`relative flex flex-col rounded-2xl border p-6 text-[#141518] transition-all sm:p-7 ${
                            isRecommended
                              ? 'border-white bg-white shadow-[0_20px_50px_rgba(0,0,0,0.28)] ring-2 ring-white/40'
                              : 'border-white/15 bg-[#faf9f6]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold tracking-[-0.02em]">{plan.name}</h3>
                              <p className="mt-1 text-xs text-[#66645e]">
                                {t('common.upToStudents', 'Up to {count} students').replace('{count}', plan.studentCeiling.toLocaleString())}
                              </p>
                            </div>
                            {isRecommended && (
                              <span
                                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                                style={{ backgroundColor: brand.accentColor }}
                              >
                                {editorMode ? 'Popular' : 'Best fit'}
                              </span>
                            )}
                          </div>
                          <p className="mt-5 text-3xl font-bold tracking-tight ws-tabular">
                            {formatPlanPrice(Number(plan.price), 0)}
                            <span className="ml-1.5 text-xs font-normal text-[#66645e]">
                              {t('common.perAcademicYear', 'per academic year')}
                            </span>
                          </p>
                          {!editorMode && perStudent > 0 && (
                            <p className="mt-1 font-mono text-[11px] text-[#717278]">
                              ≈ {formatPlanPrice(perStudent, 2)} / student / year
                            </p>
                          )}
                          <div className="mt-5 border-t border-[#e4e2dd] pt-4 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#717278]">
                              {t('common.includedTools', 'Included tools')}
                            </p>
                            <ul className="mt-3 space-y-2.5">
                              {previewFeatures.map((feature) => {
                                const copy = getPlanFeatureCopy(
                                  feature.featureKey,
                                  feature.feature.name,
                                  feature.feature.description
                                );
                                return (
                                  <li key={feature.featureKey} className="flex items-start gap-2">
                                    <span
                                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: brand.accentColor }}
                                    />
                                    <div>
                                      <p className="text-xs font-semibold text-[#141518]">{copy.name}</p>
                                      <p className="mt-0.5 text-[11px] leading-4 text-[#66645e]">{copy.description}</p>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            {remainingFeatures > 0 && (
                              <p className="mt-3 text-[11px] font-medium text-[#66645e]">
                                {t('common.plusMoreTools', 'Plus {count} more included tools.').replace('{count}', String(remainingFeatures))}
                              </p>
                            )}
                          </div>
                          <Link
                            href={`/register?planId=${encodeURIComponent(plan.id)}`}
                            onClick={handleLinkClick}
                            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: brand.accentColor }}
                          >
                            {t('common.choosePlan', 'Choose')} {plan.name} <span aria-hidden="true">→</span>
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-8 max-w-2xl border-l-4 border-white/40 bg-white/10 px-5 py-4 text-sm text-white/85">
                  Configure subscription tiers in Super Admin → Plan Tiers &amp; Features to display them here.
                </p>
              )}

              {d.footerNote && <p className="mt-5 text-xs text-white/75">{tp(d.footerNote)}</p>}
            </div>
          </section>
        );

      case 'faq':
        return (
          <FaqSection
            heading={d.heading || 'Frequently asked questions'}
            items={Array.isArray(d.items) ? d.items : []}
          />
        );

      case 'cta':
        return (
          <section
            className={`mx-auto grid max-w-7xl gap-6 px-5 ${
              isMobilePreview
                ? 'grid-cols-1 py-12'
                : 'py-16 sm:px-8 sm:py-20 md:grid-cols-[1fr_auto] md:items-center lg:px-10'
            }`}
          >
            <div>
              <h2
                className={`tenant-editorial-display max-w-[18ch] font-normal leading-[1.02] tracking-[-0.025em] text-[#0a0a0a] ${
                  isMobilePreview ? 'text-[34px]' : 'text-[38px] sm:text-[52px]'
                }`}
              >
                {tp(d.heading || 'Make the school day easier to keep on track.')}
              </h2>
              {d.subtitle && <p className="mt-3 max-w-xl text-sm leading-6 text-[#57554f]">{tp(d.subtitle)}</p>}
            </div>
            {d.buttonLabel && (
              <Link
                href={d.buttonHref || '/register'}
                onClick={handleLinkClick}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
                style={{ backgroundColor: brand.accentColor }}
              >
                {tp(d.buttonLabel)} <span aria-hidden="true">→</span>
              </Link>
            )}
          </section>
        );

      case 'testimonials': {
        const items: Array<{ quote: string; author: string; role: string }> = Array.isArray(d.items)
          ? d.items
          : [];
        return (
          <section className="bg-[#f4f3f1] border-y border-[#e4e2dd]">
            <div className={`mx-auto max-w-7xl px-5 ${isMobilePreview ? 'py-12' : 'py-16 sm:px-8 sm:py-20 lg:px-10'}`}>
              <div className="max-w-2xl">
                <h2
                  className={`tenant-editorial-display font-normal leading-[1.04] tracking-[-0.025em] text-[#0a0a0a] ${
                    isMobilePreview ? 'text-[32px]' : 'text-[36px] sm:text-[48px]'
                  }`}
                >
                  {d.heading || 'Trusted by school leaders'}
                </h2>
                {d.subtitle && <p className="mt-2.5 text-sm leading-6 text-[#57554f]">{d.subtitle}</p>}
              </div>
              <div
                className={`mt-10 grid gap-5 ${
                  isMobilePreview
                    ? 'grid-cols-1'
                    : isTabletPreview
                    ? 'grid-cols-2'
                    : 'md:grid-cols-3'
                }`}
              >
                {items.map((item, idx) => (
                  <blockquote
                    key={idx}
                    className="rounded-2xl bg-white border border-[#e6e4de] p-6 flex flex-col justify-between gap-5 shadow-[0_1px_3px_rgba(17,17,16,0.04)]"
                  >
                    <p className="text-sm leading-7 text-[#1a1917]">“{item.quote}”</p>
                    <footer className="pt-4 border-t border-[#efede9]">
                      <p className="text-xs font-semibold text-[#141518]">{item.author}</p>
                      <p className="text-[11px] text-[#717278] mt-0.5">{item.role}</p>
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </section>
        );
      }

      case 'stats': {
        const items: Array<{ value: string; label: string }> = Array.isArray(d.items) ? d.items : [];
        return (
          <section className="text-white" style={{ backgroundColor: brand.primaryColor }}>
            <div className={`mx-auto max-w-7xl px-5 ${isMobilePreview ? 'py-10' : 'py-14 sm:px-8 lg:px-10'}`}>
              {d.heading && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65 mb-6">
                  {d.heading}
                </p>
              )}
              <div
                className={`grid gap-6 ${
                  isMobilePreview
                    ? 'grid-cols-2'
                    : isTabletPreview
                    ? 'grid-cols-2'
                    : 'grid-cols-2 md:grid-cols-4'
                }`}
              >
                {items.map((item, idx) => (
                  <div key={idx} className="border-l border-white/20 pl-4">
                    <p className="tenant-editorial-display text-3xl sm:text-4xl font-normal tracking-tight text-white ws-tabular">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-white/75">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }

      case 'video': {
        const embed = toVideoEmbedUrl(d.videoUrl || '');
        return (
          <section className={`mx-auto max-w-5xl px-5 ${isMobilePreview ? 'py-12' : 'py-16 sm:px-8 sm:py-20'}`}>
            {(d.heading || d.subtitle) && (
              <div className="max-w-2xl mb-8">
                {d.heading && (
                  <h2
                    className={`tenant-editorial-display font-normal leading-[1.04] tracking-[-0.025em] text-[#0a0a0a] ${
                      isMobilePreview ? 'text-[32px]' : 'text-[36px] sm:text-[48px]'
                    }`}
                  >
                    {d.heading}
                  </h2>
                )}
                {d.subtitle && <p className="mt-2.5 text-sm leading-6 text-[#57554f]">{d.subtitle}</p>}
              </div>
            )}

            {embed.kind === 'iframe' ? (
              <div className="aspect-video w-full border border-[#e4e2dd] bg-black overflow-hidden">
                <iframe
                  src={embed.src}
                  title={d.heading || 'Video walkthrough'}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : embed.kind === 'mp4' ? (
              <video
                src={embed.src}
                controls
                className="w-full aspect-video border border-[#e4e2dd] bg-black"
              />
            ) : (
              <div className="aspect-video w-full border border-dashed border-[#d4d1ca] bg-[#f4f3f1] flex flex-col items-center justify-center p-6 text-center">
                <p className="text-sm font-semibold text-[#0a0a0a]">Video Walkthrough Placeholder</p>
                <p className="mt-1 text-xs text-[#66645e]">
                  {d.caption || 'Paste a YouTube, Vimeo, or MP4 URL in the Content tab.'}
                </p>
              </div>
            )}
          </section>
        );
      }

      case 'contact_form':
        return (
          <LeadFormWidget
            heading={d.heading || 'Book a live walkthrough'}
            subtitle={d.subtitle}
            buttonLabel={d.buttonLabel}
            showSchoolField={d.showSchoolField}
            showPhoneField={d.showPhoneField}
            accentColor={s.accentColor || brand.accentColor}
            sourcePage={pageKey === 'home' ? '/' : `/${pageKey}`}
            editorMode={editorMode}
            isMobilePreview={isMobilePreview}
          />
        );

      case 'logo_strip': {
        const items: Array<{ name: string; logoUrl?: string }> = Array.isArray(d.items) ? d.items : [];
        return (
          <section className="border-y border-[#e4e2dd] bg-white">
            <div className={`mx-auto max-w-7xl px-5 ${isMobilePreview ? 'py-8' : 'py-10 sm:px-8 lg:px-10'}`}>
              {d.heading && (
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#66645e] mb-6">
                  {d.heading}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                {items.map((item, idx) =>
                  item.logoUrl ? (
                    <img
                      key={idx}
                      src={item.logoUrl}
                      alt={item.name}
                      className="h-8 max-w-[130px] object-contain opacity-80 hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <span
                      key={idx}
                      className="text-sm font-semibold tracking-tight text-[#4f4d48]"
                    >
                      {item.name}
                    </span>
                  )
                )}
              </div>
            </div>
          </section>
        );
      }

      case 'custom_text': {
        const tone = d.backgroundTone || 'stone';
        const isBrand = tone === 'brand';
        const bgClass = isBrand ? 'text-white' : tone === 'stone' ? 'bg-[#f4f3f1] text-[#0a0a0a]' : 'bg-white text-[#0a0a0a]';
        return (
          <section
            className={bgClass}
            style={isBrand ? { backgroundColor: brand.primaryColor } : undefined}
          >
            <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20 space-y-5">
              <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{d.heading}</h2>
              <p className={`max-w-3xl text-base leading-7 whitespace-pre-line ${isBrand ? 'text-white/85' : 'text-[#57554f]'}`}>
                {d.body}
              </p>
              {d.buttonLabel && (
                <div className="pt-2">
                  <Link
                    href={d.buttonHref || '/about'}
                    onClick={handleLinkClick}
                    className="inline-flex min-h-11 items-center gap-2 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: brand.accentColor }}
                  >
                    {d.buttonLabel} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              )}
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f6] font-sans text-[#141518] antialiased">
      <PublicNavbar brand={brand} disableNavigation={editorMode} previewViewport={previewViewport} />

      <main
        className="flex-1"
        onDragOver={editorMode ? (e) => e.preventDefault() : undefined}
        onDrop={
          editorMode && onDropNewWidget
            ? (e) => {
                e.preventDefault();
                const widgetType = e.dataTransfer.getData('application/x-cms-widget') as CmsBlockType;
                if (widgetType) {
                  onDropNewWidget(widgetType);
                }
              }
            : undefined
        }
      >
        {editorMode && visibleBlocks.length === 0 && (
          <div className="max-w-3xl mx-auto my-16 p-12 border-2 border-dashed border-[#d4d1ca] bg-[#f4f3f1] text-center space-y-2">
            <p className="text-base font-bold text-[#0a0a0a]">Empty page canvas</p>
            <p className="text-xs text-[#66645e]">
              Click or drag any widget from the left panel to start building this page.
            </p>
          </div>
        )}
        {visibleBlocks.map((block, index) => {
          const isSelected = editorMode && selectedBlockId === block.id;
          const s = block.style || {};
          const adv = block.advanced || {};

          const visibilityClasses = [
            adv.hideDesktop ? 'lg:hidden' : '',
            adv.hideTablet ? 'md:hidden lg:block' : '',
            adv.hideMobile ? 'hidden sm:block' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const wrapperStyle: React.CSSProperties = {
            backgroundColor: s.bgColor || undefined,
            backgroundImage: s.bgImage
              ? `linear-gradient(rgba(0,0,0,${(s.bgOverlayOpacity ?? 45) / 100}), rgba(0,0,0,${(s.bgOverlayOpacity ?? 45) / 100})), url("${s.bgImage}")`
              : s.bgGradient || undefined,
            backgroundSize: s.bgImage ? 'cover' : undefined,
            backgroundPosition: s.bgImage ? 'center' : undefined,
            color: s.textColor || undefined,
            paddingTop: adv.paddingTop !== undefined ? `${adv.paddingTop}px` : undefined,
            paddingBottom: adv.paddingBottom !== undefined ? `${adv.paddingBottom}px` : undefined,
            paddingLeft: adv.paddingLeft !== undefined ? `${adv.paddingLeft}px` : undefined,
            paddingRight: adv.paddingRight !== undefined ? `${adv.paddingRight}px` : undefined,
            marginTop: adv.marginTop !== undefined ? `${adv.marginTop}px` : undefined,
            marginBottom: adv.marginBottom !== undefined ? `${adv.marginBottom}px` : undefined,
            borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
            borderStyle: s.borderWidth ? 'solid' : undefined,
            borderColor: s.borderWidth ? s.borderColor || '#e4e2dd' : undefined,
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined,
          };

          return (
            <div
              key={block.id}
              id={adv.cssId || undefined}
              style={wrapperStyle}
              onClick={editorMode && onSelectBlock ? () => onSelectBlock(block.id) : undefined}
              className={`${visibilityClasses} ${adv.cssClass || ''} ${
                editorMode
                  ? `group/el relative cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-inset ring-[#17834b]'
                        : 'hover:ring-2 hover:ring-inset hover:ring-[#17834b]/45'
                    }`
                  : ''
              }`}
            >
              {editorMode && (
                <div
                  className={`absolute top-0 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-[#17834b] text-white text-[10px] font-semibold px-2 py-1 rounded-b shadow transition-opacity ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover/el:opacity-100'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="px-1 uppercase tracking-wider">{block.type}</span>
                  {onMoveBlock && (
                    <>
                      <button
                        type="button"
                        onClick={() => onMoveBlock(block.id, -1)}
                        disabled={index === 0}
                        className="px-1 hover:bg-white/20 rounded disabled:opacity-40 cursor-pointer"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveBlock(block.id, 1)}
                        disabled={index === visibleBlocks.length - 1}
                        className="px-1 hover:bg-white/20 rounded disabled:opacity-40 cursor-pointer"
                        title="Move down"
                      >
                        ↓
                      </button>
                    </>
                  )}
                  {onDuplicateBlock && (
                    <button
                      type="button"
                      onClick={() => onDuplicateBlock(block.id)}
                      className="px-1 hover:bg-white/20 rounded cursor-pointer"
                      title="Duplicate widget"
                    >
                      ⧉
                    </button>
                  )}
                  {onDeleteBlock && (
                    <button
                      type="button"
                      onClick={() => onDeleteBlock(block.id)}
                      className="px-1 hover:bg-rose-500 rounded cursor-pointer"
                      title="Delete widget"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              {renderBlock(block)}
            </div>
          );
        })}
      </main>

      {/* Global Security & Enterprise Infrastructure Trust Band */}
      {!editorMode && (pageKey === 'home' || pageKey === 'pricing' || pageKey === 'services') && (
        <section className="border-t border-white/10 bg-[#111215] text-white">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-white/10 pb-8">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  Global infrastructure
                </p>
                <h2 className="tenant-editorial-display mt-2 text-3xl font-normal tracking-[-0.02em] text-white sm:text-4xl">
                  Built for international schools and networks.
                </h2>
              </div>
              <p className="max-w-md text-xs leading-6 text-zinc-400">
                Every school operates in its own isolated tenant boundary with encrypted payment credentials, role-based access, and instant data portability.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  code: '01',
                  title: 'Strict Tenant Isolation',
                  desc: 'Every school’s records, staff, and student data are scoped strictly to its verified tenant boundary.',
                },
                {
                  code: '02',
                  title: 'Global Multi-Gateway',
                  desc: 'Direct-to-school settlement via Stripe, Paystack, and Flutterwave with idempotent webhooks.',
                },
                {
                  code: '03',
                  title: 'Multi-Language & RTL',
                  desc: 'Instant interface localization across English, French, Spanish, Portuguese, and Arabic (RTL).',
                },
                {
                  code: '04',
                  title: 'Audit & Snapshots',
                  desc: 'Full administrative audit trails, automated backups, and one-click JSON/CSV data exports.',
                },
              ].map((pillar) => (
                <div key={pillar.code} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <span className="font-mono text-[11px] text-zinc-500">{pillar.code}</span>
                  <h3 className="mt-2 text-sm font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-zinc-400">{pillar.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <PublicFooter brand={brand} disableNavigation={editorMode} previewViewport={previewViewport} />
    </div>
  );
}
