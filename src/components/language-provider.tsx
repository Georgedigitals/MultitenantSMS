'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import {
  DEFAULT_LOCALIZATION,
  formatMoney as formatMoneyUtil,
  type PlatformLocalizationConfig,
} from '@/lib/i18n/currency';
import {
  SUPPORTED_LANGUAGES,
  getLanguageDir,
  isSupportedLanguage,
  translate,
  translatePhrase,
  type SupportedLanguage,
} from '@/lib/i18n/dictionaries';

interface LanguageContextValue {
  lang: SupportedLanguage;
  dir: 'ltr' | 'rtl';
  setLang: (next: SupportedLanguage) => void;
  enabledLanguages: SupportedLanguage[];
  localization: PlatformLocalizationConfig;
  t: (key: string, fallback?: string) => string;
  tp: (text: string) => string;
  formatMoney: (amount: number, decimals?: number) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  dir: 'ltr',
  setLang: () => {},
  enabledLanguages: ['en', 'fr', 'es', 'pt', 'ar'],
  localization: DEFAULT_LOCALIZATION,
  t: (key, fallback) => translate('en', key, fallback),
  tp: (text) => text,
  formatMoney: (amount, decimals) => formatMoneyUtil(amount, { decimals }),
});

export function useLanguage() {
  return useContext(LanguageContext);
}

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'SVG',
  'KBD',
]);

function shouldTranslateText(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2 || s.length > 500) return false;
  // Must contain at least two letters
  if (!/[A-Za-z]{2,}/.test(s)) return false;
  // Skip URLs, emails, paths, hex codes, pure numeric/currency tokens
  if (/^https?:\/\//i.test(s)) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return false;
  if (/^\/[a-z0-9\-_/]+$/i.test(s)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return false;
  if (/^[\d\s,.\-+%₦$£€¥₹:/()]+$/.test(s)) return false;
  return true;
}

function loadClientCache(lang: SupportedLanguage): Record<string, string> {
  try {
    const raw = localStorage.getItem(`tr_cache_${lang}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveClientCache(lang: SupportedLanguage, cache: Record<string, string>) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > 1500) {
      const trimmed: Record<string, string> = {};
      for (const k of keys.slice(-1200)) trimmed[k] = cache[k];
      localStorage.setItem(`tr_cache_${lang}`, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(`tr_cache_${lang}`, JSON.stringify(cache));
    }
  } catch {
    // ignore quota errors
  }
}

export function LanguageProvider({
  initialLanguage = 'en',
  localization = DEFAULT_LOCALIZATION,
  children,
}: {
  initialLanguage?: string;
  localization?: PlatformLocalizationConfig;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/';
  const safeDefault: SupportedLanguage = isSupportedLanguage(initialLanguage)
    ? initialLanguage
    : isSupportedLanguage(localization.defaultLanguage)
    ? localization.defaultLanguage
    : 'en';

  const enabledLanguages: SupportedLanguage[] =
    localization.enabledLanguages?.filter(isSupportedLanguage) || ['en'];

  const [lang, setLangState] = useState<SupportedLanguage>(safeDefault);
  const originalTextMapRef = useRef<WeakMap<Text, string>>(new WeakMap());
  const translatedNodesRef = useRef<Set<Text>>(new Set());
  const isApplyingDomRef = useRef(false);

  useEffect(() => {
    try {
      const explicit = localStorage.getItem('platform_lang_explicit');
      const saved = localStorage.getItem('platform_lang');
      if (explicit === '1' && saved && isSupportedLanguage(saved) && enabledLanguages.includes(saved)) {
        setLangState(saved);
      } else if (isSupportedLanguage(localization.defaultLanguage)) {
        setLangState(localization.defaultLanguage);
      }
    } catch {
      // ignore storage errors
    }
  }, [localization.defaultLanguage]);

  useEffect(() => {
    const dir = getLanguageDir(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  // Automatic Page-Wide DOM Translation Engine (translates main content across Public, Super Admin & Tenant pages)
  useEffect(() => {
    // Never mutate text inside the full-screen Visual Page Builder editor
    if (pathname.startsWith('/admin/website/editor')) return;

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const collectTranslatableNodes = (): Array<{ node: Text; original: string }> => {
      const result: Array<{ node: Text; original: string }> = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('[data-no-translate="true"]')) return NodeFilter.FILTER_REJECT;
          if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let current = walker.nextNode();
      while (current) {
        const textNode = current as Text;
        const storedOriginal = originalTextMapRef.current.get(textNode);
        const rawText = storedOriginal !== undefined ? storedOriginal : textNode.nodeValue || '';
        if (shouldTranslateText(rawText)) {
          result.push({ node: textNode, original: rawText });
        }
        current = walker.nextNode();
      }
      return result;
    };

    const runTranslationPass = async () => {
      if (cancelled || isApplyingDomRef.current) return;

      // Restore ALL previously translated text nodes immediately when switched back to 'en'
      if (lang === 'en') {
        isApplyingDomRef.current = true;
        translatedNodesRef.current.forEach((node) => {
          const original = originalTextMapRef.current.get(node);
          if (original !== undefined && node.isConnected && node.nodeValue !== original) {
            node.nodeValue = original;
          }
        });
        translatedNodesRef.current.clear();
        isApplyingDomRef.current = false;
        return;
      }

      const nodes = collectTranslatableNodes();
      const cache = loadClientCache(lang);
      const pendingByText = new Map<string, Array<{ node: Text; original: string }>>();

      isApplyingDomRef.current = true;
      for (const entry of nodes) {
        const trimmed = entry.original.trim();
        if (!originalTextMapRef.current.has(entry.node)) {
          originalTextMapRef.current.set(entry.node, entry.original);
        }

        // 1. Instant local dictionary or cache hit
        const dictHit = translatePhrase(lang, trimmed);
        const resolved = dictHit !== trimmed ? dictHit : cache[trimmed];

        if (resolved) {
          const leading = entry.original.match(/^\s*/)?.[0] || '';
          const trailing = entry.original.match(/\s*$/)?.[0] || '';
          const nextVal = `${leading}${resolved}${trailing}`;
          if (entry.node.nodeValue !== nextVal) {
            entry.node.nodeValue = nextVal;
            translatedNodesRef.current.add(entry.node);
          }
        } else {
          const list = pendingByText.get(trimmed) || [];
          list.push(entry);
          pendingByText.set(trimmed, list);
        }
      }
      isApplyingDomRef.current = false;

      const missingTexts = Array.from(pendingByText.keys());
      if (missingTexts.length === 0 || cancelled) return;

      // Batch-fetch uncached strings in chunks of 45
      for (let i = 0; i < missingTexts.length; i += 45) {
        if (cancelled) return;
        const batch = missingTexts.slice(i, i + 45);
        try {
          const res = await fetch('/api/platform/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetLang: lang, texts: batch }),
          });
          if (!res.ok || cancelled) continue;
          const data = await res.json();
          const map: Record<string, string> = data?.translations || {};

          let updatedCache = false;
          isApplyingDomRef.current = true;
          for (const src of batch) {
            const dst = map[src];
            if (!dst) continue;
            cache[src] = dst;
            updatedCache = true;
            const targets = pendingByText.get(src) || [];
            for (const { node, original } of targets) {
              if (!node.isConnected) continue;
              const leading = original.match(/^\s*/)?.[0] || '';
              const trailing = original.match(/\s*$/)?.[0] || '';
              node.nodeValue = `${leading}${dst}${trailing}`;
              translatedNodesRef.current.add(node);
            }
          }
          isApplyingDomRef.current = false;
          if (updatedCache) saveClientCache(lang, cache);
        } catch {
          // ignore network errors gracefully
        }
      }
    };

    const schedulePass = (delay = 120) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void runTranslationPass();
      }, delay);
    };

    schedulePass(60);

    const observer = new MutationObserver(() => {
      if (isApplyingDomRef.current) return;
      if (lang !== 'en') {
        schedulePass(350);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [lang, pathname]);

  const setLang = (next: SupportedLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem('platform_lang', next);
      localStorage.setItem('platform_lang_explicit', '1');
      document.cookie = `platform_lang=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
  };

  const value: LanguageContextValue = {
    lang,
    dir: getLanguageDir(lang),
    setLang,
    enabledLanguages: enabledLanguages.length > 0 ? enabledLanguages : ['en'],
    localization,
    t: (key, fallback) => translate(lang, key, fallback),
    tp: (text) => translatePhrase(lang, text),
    formatMoney: (amount, decimals) =>
      formatMoneyUtil(amount, {
        baseCurrencyCode: localization.baseCurrencyCode,
        currencyCode: localization.currencyCode,
        currencySymbol: localization.currencySymbol,
        locale: localization.locale,
        exchangeRate: localization.exchangeRate,
        autoConvertCurrency: localization.autoConvertCurrency,
        decimals,
      }),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function LanguageSwitcher({
  variant = 'admin',
}: {
  variant?: 'admin' | 'public' | 'tenant';
}) {
  const { lang, setLang, enabledLanguages } = useLanguage();
  if (enabledLanguages.length <= 1) return null;

  const baseClass =
    variant === 'public'
      ? 'h-8 px-2 rounded border border-white/25 bg-white/10 text-white text-xs font-medium cursor-pointer focus:outline-none'
      : variant === 'tenant'
      ? 'h-8 px-2 rounded-md border border-[#e4e2dd] bg-white text-[#111110] text-xs font-medium cursor-pointer focus:outline-none'
      : 'h-8 px-2 rounded-lg border adm-divider adm-surface adm-text-secondary text-xs font-medium cursor-pointer focus:outline-none';

  return (
    <label
      data-no-translate="true"
      className="inline-flex items-center gap-1"
      title="Switch language"
    >
      <Globe className="w-3.5 h-3.5 opacity-75 shrink-0" aria-hidden="true" />
      <select
        value={lang}
        aria-label="Select language"
        onChange={(e) => {
          if (isSupportedLanguage(e.target.value)) setLang(e.target.value);
        }}
        className={baseClass}
      >
        {SUPPORTED_LANGUAGES.filter((l) => enabledLanguages.includes(l.code)).map((l) => (
          <option key={l.code} value={l.code} className="text-[#111110] bg-white">
            {l.code.toUpperCase()} · {l.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
