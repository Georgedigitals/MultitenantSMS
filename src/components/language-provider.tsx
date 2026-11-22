'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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

export function LanguageProvider({
  initialLanguage = 'en',
  localization = DEFAULT_LOCALIZATION,
  children,
}: {
  initialLanguage?: string;
  localization?: PlatformLocalizationConfig;
  children: React.ReactNode;
}) {
  const safeDefault: SupportedLanguage = isSupportedLanguage(initialLanguage)
    ? initialLanguage
    : isSupportedLanguage(localization.defaultLanguage)
    ? localization.defaultLanguage
    : 'en';

  const enabledLanguages: SupportedLanguage[] = (
    localization.enabledLanguages?.filter(isSupportedLanguage) || ['en']
  );

  const [lang, setLangState] = useState<SupportedLanguage>(safeDefault);

  useEffect(() => {
    try {
      // Only override server default if user explicitly chose a language on this origin
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
    formatMoney: (amount, decimals = 0) =>
      formatMoneyUtil(amount, {
        currencyCode: localization.currencyCode,
        currencySymbol: localization.currencySymbol,
        locale: localization.locale,
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
    <label className="inline-flex items-center gap-1" title="Switch language">
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
