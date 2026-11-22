'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CURRENCY_PRESETS } from '@/lib/i18n/currency';
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from '@/lib/i18n/dictionaries';
import { useLanguage } from '@/components/language-provider';

interface SuperAdminProfile {
  name: string;
  email: string;
}

interface SettingsClientProps {
  superAdmin: SuperAdminProfile;
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const SaveIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z" />
  </svg>
);
const InfoIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

// ── Reusable field components ──────────────────────────────────────────────────
function SettingSection({ title, accentColor, children }: { title: string; accentColor: string; children: React.ReactNode }) {
  return (
    <div className="adm-card border rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold adm-text-primary border-b adm-divider pb-2.5 flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${accentColor}`} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function SettingField({ label, hint, children, colSpan }: { label: string; hint?: string; children: React.ReactNode; colSpan?: boolean }) {
  return (
    <div className={`adm-surface border adm-divider rounded-xl p-4 space-y-2 ${colSpan ? 'md:col-span-2' : ''}`}>
      <label className="block text-xs font-semibold adm-text-primary">{label}</label>
      {children}
      {hint && <p className="text-[10px] adm-text-muted leading-relaxed">{hint}</p>}
    </div>
  );
}

function ToggleField({ label, hint, checked, onChange, benefitText }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; benefitText: string }) {
  return (
    <div className="adm-surface border adm-divider rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs font-semibold adm-text-primary">{label}</div>
          <p className="text-[10px] adm-text-muted mt-0.5">{hint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative w-10 h-5 rounded-full border transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            checked ? 'bg-indigo-500 border-indigo-400' : 'adm-badge border-[var(--adm-input-border)]'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[calc(100%-18px)]' : 'left-0.5'}`} />
        </button>
      </div>
      <div className={`text-[10px] font-mono px-2 py-1 rounded-md ${checked ? 'text-indigo-500 bg-indigo-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
        {benefitText}
      </div>
    </div>
  );
}

export function SettingsClient({ superAdmin }: SettingsClientProps) {
  const router = useRouter();
  const { setLang } = useLanguage();
  const [activeTab, setActiveTab] = useState<'general' | 'monetization' | 'gateways' | 'security'>('general');
  const [platformName, setPlatformName] = useState('School Platform');
  const [platformTagline, setPlatformTagline] = useState('Multi-Tenant School Management Platform');
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(true);
  const [defaultTrialDays, setDefaultTrialDays] = useState(14);
  const [baseCurrencyCode, setBaseCurrencyCode] = useState('NGN');
  const [defaultCurrencyCode, setDefaultCurrencyCode] = useState('NGN');
  const [defaultCurrencySymbol, setDefaultCurrencySymbol] = useState('₦');
  const [defaultLocale, setDefaultLocale] = useState('en-NG');
  const [currencyExchangeRate, setCurrencyExchangeRate] = useState<number>(1);
  const [autoConvertCurrency, setAutoConvertCurrency] = useState<boolean>(true);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>(['en', 'fr', 'es', 'pt', 'ar']);
  const [defaultTimezone, setDefaultTimezone] = useState('Africa/Lagos');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [defaultPinFeePercent, setDefaultPinFeePercent] = useState(5.0);
  const [defaultPinMaxUses, setDefaultPinMaxUses] = useState(5);
  const [activePaymentGateway, setActivePaymentGateway] = useState<'paystack' | 'flutterwave' | 'stripe'>('paystack');
  const [paystackPublicKey, setPaystackPublicKey] = useState('');
  const [paystackSecretKey, setPaystackSecretKey] = useState('');
  const [flutterwavePublicKey, setFlutterwavePublicKey] = useState('');
  const [flutterwaveSecretKey, setFlutterwaveSecretKey] = useState('');
  const [stripePublicKey, setStripePublicKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [smsGatewayProvider, setSmsGatewayProvider] = useState('termii');
  const [smsCostPerUnit, setSmsCostPerUnit] = useState(3.5);
  const [termiiApiKey, setTermiiApiKey] = useState('');
  const [adminName, setAdminName] = useState(superAdmin.name);
  const [adminEmail, setAdminEmail] = useState(superAdmin.email);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) return;
        if (data.platformName) setPlatformName(data.platformName);
        if (data.platformTagline !== undefined) setPlatformTagline(data.platformTagline);
        if (data.allowPublicRegistration !== undefined) setAllowPublicRegistration(Boolean(data.allowPublicRegistration));
        if (data.maintenanceMode !== undefined) setMaintenanceMode(Boolean(data.maintenanceMode));
        if (Number.isInteger(data.defaultTrialDays)) setDefaultTrialDays(data.defaultTrialDays);
        if (data.baseCurrencyCode) setBaseCurrencyCode(data.baseCurrencyCode);
        if (data.defaultCurrencyCode) setDefaultCurrencyCode(data.defaultCurrencyCode);
        if (data.defaultCurrencySymbol) setDefaultCurrencySymbol(data.defaultCurrencySymbol);
        if (data.defaultLocale) setDefaultLocale(data.defaultLocale);
        if (typeof data.currencyExchangeRate === 'number' && data.currencyExchangeRate > 0) {
          setCurrencyExchangeRate(data.currencyExchangeRate);
        }
        if (data.autoConvertCurrency !== undefined) {
          setAutoConvertCurrency(Boolean(data.autoConvertCurrency));
        }
        if (data.defaultLanguage) setDefaultLanguage(data.defaultLanguage);
        if (Array.isArray(data.enabledLanguages) && data.enabledLanguages.length > 0) {
          setEnabledLanguages(data.enabledLanguages);
        }
        if (data.defaultTimezone) setDefaultTimezone(data.defaultTimezone);
        if (typeof data.defaultPinFeePercent === 'number') setDefaultPinFeePercent(data.defaultPinFeePercent);
        if (typeof data.defaultPinMaxUses === 'number') setDefaultPinMaxUses(data.defaultPinMaxUses);
        if (data.activePaymentGateway) setActivePaymentGateway(data.activePaymentGateway);
        if (data.paystackPublicKey) setPaystackPublicKey(data.paystackPublicKey);
        if (data.paystackSecretKey) setPaystackSecretKey(data.paystackSecretKey);
        if (data.flutterwavePublicKey) setFlutterwavePublicKey(data.flutterwavePublicKey);
        if (data.flutterwaveSecretKey) setFlutterwaveSecretKey(data.flutterwaveSecretKey);
        if (data.stripePublicKey) setStripePublicKey(data.stripePublicKey);
        if (data.stripeSecretKey) setStripeSecretKey(data.stripeSecretKey);
        if (data.stripeWebhookSecret) setStripeWebhookSecret(data.stripeWebhookSecret);
        if (data.smsGatewayProvider) setSmsGatewayProvider(data.smsGatewayProvider);
        if (typeof data.smsCostPerUnit === 'number') setSmsCostPerUnit(data.smsCostPerUnit);
        if (data.termiiApiKey) setTermiiApiKey(data.termiiApiKey);
        if (data.adminName) setAdminName(data.adminName);
        if (data.adminEmail) setAdminEmail(data.adminEmail);
      })
      .catch(() => setSaveStatus({ type: 'error', text: 'Could not load saved platform settings.' }));
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      setSaveStatus({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setSaveStatus({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformName,
          platformTagline,
          allowPublicRegistration,
          defaultTrialDays,
          baseCurrencyCode,
          defaultCurrencyCode,
          defaultCurrencySymbol,
          defaultLocale,
          currencyExchangeRate,
          autoConvertCurrency,
          defaultLanguage,
          enabledLanguages,
          defaultTimezone,
          maintenanceMode,
          defaultPinFeePercent,
          defaultPinMaxUses,
          activePaymentGateway,
          paystackPublicKey,
          paystackSecretKey,
          flutterwavePublicKey,
          flutterwaveSecretKey,
          stripePublicKey,
          stripeSecretKey,
          stripeWebhookSecret,
          smsGatewayProvider,
          smsCostPerUnit,
          termiiApiKey,
          adminName,
          adminEmail,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update platform settings');
      setSaveStatus({ type: 'success', text: data.message || 'Global platform configuration updated successfully!' });
      if (isSupportedLanguage(defaultLanguage)) {
        setLang(defaultLanguage);
      }
      setNewPassword('');
      setConfirmPassword('');
      router.refresh();
    } catch (error) {
      setSaveStatus({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update platform settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  const TABS = [
    { id: 'general', label: 'Operations & Signups', desc: 'Maintenance mode & onboarding' },
    { id: 'monetization', label: 'Monetization & Payments', desc: 'PIN fee revenue & Paystack' },
    { id: 'gateways', label: 'SMS & Communications', desc: 'Parent alert gateways' },
    { id: 'security', label: 'Admin & Security', desc: 'Credentials & audit guards' },
  ] as const;

  const inputClass = 'adm-input w-full border rounded-lg px-3 py-2 text-xs font-mono';

  return (
    <div className="space-y-6">

      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b adm-divider">
        <div>
          <h1 className="text-2xl font-bold adm-text-primary tracking-tight">Global Platform Configuration</h1>
          <p className="text-sm adm-text-muted mt-1 max-w-xl leading-relaxed">
            Centralized controls for multi-tenant operations, revenue rules, infrastructure gateways, and security.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
          maintenanceMode
            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${maintenanceMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          {maintenanceMode ? 'Maintenance Mode Active' : 'System Operational'}
        </span>
      </div>

      {/* ── Info callout ──────────────────────────────────────────────────────── */}
      <div className="adm-surface border adm-divider rounded-2xl p-4 flex gap-3">
        <div className="text-indigo-500 shrink-0 mt-0.5"><InfoIcon /></div>
        <div>
          <h3 className="text-xs font-bold adm-text-primary mb-1">Why Platform Settings Matter</h3>
          <p className="text-[11px] adm-text-secondary leading-relaxed">
            These settings give you total control over the SaaS business engine without code deployments. Pause registrations, tune PIN revenue share, configure gateways, and secure your credentials.
          </p>
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b adm-divider pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-start cursor-pointer ${
              activeTab === tab.id
                ? 'adm-btn-primary'
                : 'adm-surface border adm-divider adm-text-secondary adm-surface-hover'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] font-normal mt-0.5 ${activeTab === tab.id ? 'opacity-80' : 'adm-text-muted'}`}>{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Save Status Banner ────────────────────────────────────────────────── */}
      {saveStatus && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          saveStatus.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
        }`}>
          <span>{saveStatus.text}</span>
          <button onClick={() => setSaveStatus(null)} className="ml-4 adm-text-muted hover:adm-text-primary">×</button>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* ── Tab: General ─────────────────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <SettingSection title="Platform Brand Identity (White-Label)" accentColor="bg-emerald-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingField
                  label="Platform Name"
                  hint="Displayed across the Super Admin sidebar, footer, and platform branding instead of a hardcoded vendor name."
                >
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="e.g. EduGrid, CampusOS, ScholarHub"
                    className={inputClass}
                  />
                </SettingField>
                <SettingField
                  label="Platform Tagline"
                  hint="Short description for metadata and platform branding."
                >
                  <input
                    type="text"
                    maxLength={160}
                    value={platformTagline}
                    onChange={(e) => setPlatformTagline(e.target.value)}
                    placeholder="Multi-Tenant School Management Platform"
                    className={inputClass}
                  />
                </SettingField>
              </div>
            </SettingSection>

            <SettingSection title="School Self-Registration & Onboarding Controls" accentColor="bg-indigo-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleField
                label="Public School Registration"
                hint="Allow new schools to register independently via /register"
                checked={allowPublicRegistration}
                onChange={setAllowPublicRegistration}
                benefitText="Turn OFF to freeze new signups during internal reviews or manual onboarding only."
              />
              <ToggleField
                label="Global System Maintenance Mode"
                hint="Display friendly maintenance banner to non-admin users"
                checked={maintenanceMode}
                onChange={setMaintenanceMode}
                benefitText="Safely perform system migrations without corrupting live student score submissions."
              />
              <SettingField label="Default School Trial Duration (Days)" hint="Trial period for new schools. The trial ends automatically; the school must pay to continue using its workspace.">
                <input type="number" min="1" max="90" value={defaultTrialDays} onChange={(e) => setDefaultTrialDays(Number(e.target.value))} className={inputClass} />
              </SettingField>
              <SettingField label="Default Timezone" hint="IANA timezone used for platform schedules and logs (e.g. Africa/Lagos, America/New_York, Europe/London).">
                <input type="text" value={defaultTimezone} onChange={(e) => setDefaultTimezone(e.target.value)} className={inputClass} />
              </SettingField>
            </div>
          </SettingSection>

          <SettingSection title="Global Localization — Currency, Country & Multi-Language" accentColor="bg-emerald-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingField
                label="Quick Currency & Country Preset"
                hint="Select any country/currency to auto-fill ISO code, symbol, and number locale for foreign deployments."
              >
                <select
                  value={CURRENCY_PRESETS.some((c) => c.code === defaultCurrencyCode) ? defaultCurrencyCode : ''}
                  onChange={async (e) => {
                    const preset = CURRENCY_PRESETS.find((c) => c.code === e.target.value);
                    if (preset) {
                      setDefaultCurrencyCode(preset.code);
                      setDefaultCurrencySymbol(preset.symbol);
                      setDefaultLocale(preset.locale);
                      if (preset.code === baseCurrencyCode) {
                        setCurrencyExchangeRate(1);
                      } else if (autoConvertCurrency) {
                        setFetchingRate(true);
                        try {
                          const r = await fetch(
                            `/api/platform/exchange-rates?from=${encodeURIComponent(baseCurrencyCode)}&to=${encodeURIComponent(preset.code)}`
                          );
                          const d = await r.json();
                          if (r.ok && typeof d.rate === 'number' && d.rate > 0) {
                            setCurrencyExchangeRate(d.rate);
                          }
                        } finally {
                          setFetchingRate(false);
                        }
                      }
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">Custom Currency</option>
                  {CURRENCY_PRESETS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </SettingField>

              <SettingField
                label="ISO Currency Code & Symbol"
                hint="Applies to public pricing plans, Super Admin revenue, and invoices."
              >
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={defaultCurrencyCode}
                    onChange={(e) => setDefaultCurrencyCode(e.target.value.toUpperCase())}
                    placeholder="USD"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={defaultCurrencySymbol}
                    onChange={(e) => setDefaultCurrencySymbol(e.target.value)}
                    placeholder="$"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={defaultLocale}
                    onChange={(e) => setDefaultLocale(e.target.value)}
                    placeholder="en-US"
                    className={inputClass}
                  />
                </div>
              </SettingField>

              <SettingField
                label="Currency Converter (Base Currency & Exchange Rate)"
                hint="Automatically converts stored amounts (e.g. 450,000 NGN → £229 or $290) across pricing, dashboards, and checkout. Set Base = Display for 1:1 native pricing."
                colSpan
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] adm-text-muted uppercase tracking-wider mb-1">
                        Base Stored Currency
                      </label>
                      <select
                        value={baseCurrencyCode}
                        onChange={(e) => setBaseCurrencyCode(e.target.value)}
                        className={inputClass}
                      >
                        {CURRENCY_PRESETS.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} ({c.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] adm-text-muted uppercase tracking-wider mb-1">
                        Rate (1 {baseCurrencyCode} = ? {defaultCurrencyCode})
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        min="0.000001"
                        value={currencyExchangeRate}
                        onChange={(e) => setCurrencyExchangeRate(Number(e.target.value) || 1)}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={fetchingRate}
                        onClick={async () => {
                          setFetchingRate(true);
                          try {
                            const r = await fetch(
                              `/api/platform/exchange-rates?from=${encodeURIComponent(baseCurrencyCode)}&to=${encodeURIComponent(defaultCurrencyCode)}`
                            );
                            const d = await r.json();
                            if (r.ok && typeof d.rate === 'number' && d.rate > 0) {
                              setCurrencyExchangeRate(d.rate);
                            }
                          } finally {
                            setFetchingRate(false);
                          }
                        }}
                        className="adm-btn-primary w-full h-[34px] rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {fetchingRate ? 'Fetching rate...' : 'Fetch Live Rate'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <label className="inline-flex items-center gap-2 cursor-pointer adm-text-secondary">
                      <input
                        type="checkbox"
                        checked={autoConvertCurrency}
                        onChange={(e) => setAutoConvertCurrency(e.target.checked)}
                      />
                      <span>Auto-convert amounts using exchange rate</span>
                    </label>
                    <span className="font-mono text-[11px] adm-text-primary">
                      Preview: 450,000 {baseCurrencyCode} →{' '}
                      <strong>
                        {defaultCurrencySymbol}
                        {(autoConvertCurrency && baseCurrencyCode !== defaultCurrencyCode
                          ? 450000 * currencyExchangeRate
                          : 450000
                        ).toLocaleString(defaultLocale, { maximumFractionDigits: 2 })}
                      </strong>
                    </span>
                  </div>
                </div>
              </SettingField>

              <SettingField
                label="Default Platform Language"
                hint="Primary language shown to first-time visitors and school admins (Arabic automatically enables RTL layout)."
              >
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  className={inputClass}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label} — {lang.nativeLabel}
                    </option>
                  ))}
                </select>
              </SettingField>

              <SettingField
                label="Enabled Languages in Language Switcher"
                hint="Choose which languages visitors and admins can switch between."
              >
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const checked = enabledLanguages.includes(lang.code);
                    return (
                      <label
                        key={lang.code}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer ${
                          checked ? 'adm-accent-border adm-accent-subtle adm-text-primary' : 'adm-divider adm-text-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEnabledLanguages((prev) => Array.from(new Set([...prev, lang.code])));
                            } else if (enabledLanguages.length > 1) {
                              setEnabledLanguages((prev) => prev.filter((c) => c !== lang.code));
                            }
                          }}
                        />
                        <span>{lang.nativeLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </SettingField>
            </div>
          </SettingSection>
          </div>
        )}

        {/* ── Tab: Monetization ────────────────────────────────────────────────── */}
        {activeTab === 'monetization' && (
          <SettingSection title="SaaS Revenue & Scratch Card Monetization Engine" accentColor="bg-emerald-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingField label="Platform Revenue Share Fee (%)" hint="Commission percentage retained on scratch card PIN sales.">
                <input type="number" step="0.5" min="0" max="50" value={defaultPinFeePercent} onChange={(e) => setDefaultPinFeePercent(Number(e.target.value))} className={`${inputClass} text-emerald-500`} />
                <p className="text-[10px] text-emerald-500 font-mono">Generates passive recurring revenue from school result checker PIN purchases.</p>
              </SettingField>
              <SettingField label="Max Verification Usage Ceiling per PIN" hint="Max times a single PIN can be checked before expiry.">
                <input type="number" min="1" max="20" value={defaultPinMaxUses} onChange={(e) => setDefaultPinMaxUses(Number(e.target.value))} className={`${inputClass} text-sky-500`} />
                <p className="text-[10px] text-sky-500 font-mono">Prevents PIN sharing while ensuring fair usage.</p>
              </SettingField>
              <SettingField label="Active Platform Payment Gateway" colSpan hint="Automatically routes school subscription checkouts with idempotent settlement and minor-unit conversion for any currency.">
                <div className="space-y-3">
                  <select
                    value={activePaymentGateway}
                    onChange={(e) => setActivePaymentGateway(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="paystack">Paystack (NGN, GHS, KES, ZAR, XOF, USD)</option>
                    <option value="flutterwave">Flutterwave (Pan-Africa + USD, GBP, EUR)</option>
                    <option value="stripe">Stripe Global (135+ Currencies Worldwide — US/UK/EU/Global)</option>
                  </select>
                  {activePaymentGateway === 'paystack' &&
                    !['NGN', 'GHS', 'ZAR', 'KES', 'XOF', 'USD'].includes(defaultCurrencyCode.toUpperCase()) && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-600 font-medium">
                        Warning: Paystack does not support <strong>{defaultCurrencyCode}</strong>. Switch your Active Gateway to <strong>Stripe Global</strong> or <strong>Flutterwave</strong> so checkouts succeed.
                      </div>
                    )}
                </div>
              </SettingField>

              <SettingField label="Paystack Credentials" colSpan>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">Public Key</label>
                    <input
                      type="text"
                      name="paystack_public_key"
                      autoComplete="off"
                      placeholder="pk_test_... or pk_live_..."
                      value={paystackPublicKey}
                      onChange={(e) => setPaystackPublicKey(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">Secret Key</label>
                    <input
                      type="password"
                      name="paystack_secret_key"
                      autoComplete="new-password"
                      placeholder="sk_test_... or sk_live_..."
                      value={paystackSecretKey}
                      onChange={(e) => setPaystackSecretKey(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </SettingField>

              <SettingField label="Flutterwave Credentials" colSpan>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">Public Key</label>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="FLWPUBK-..."
                      value={flutterwavePublicKey}
                      onChange={(e) => setFlutterwavePublicKey(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">Secret Key</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="FLWSECK-..."
                      value={flutterwaveSecretKey}
                      onChange={(e) => setFlutterwaveSecretKey(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </SettingField>

              <SettingField label="Stripe Global Credentials (135+ Currencies)" colSpan>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">Publishable Key</label>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="pk_live_... or pk_test_..."
                      value={stripePublicKey}
                      onChange={(e) => setStripePublicKey(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">Secret Key</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="sk_live_... or sk_test_..."
                      value={stripeSecretKey}
                      onChange={(e) => setStripeSecretKey(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">Webhook Secret</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="whsec_..."
                      value={stripeWebhookSecret}
                      onChange={(e) => setStripeWebhookSecret(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="text-[10px] adm-text-muted pt-1">
                  Point your Stripe webhook endpoint to <code className="font-mono">/api/webhooks/stripe</code> (event: <code className="font-mono">checkout.session.completed</code>).
                </p>
              </SettingField>
            </div>
          </SettingSection>
        )}

        {/* ── Tab: SMS & Gateways ───────────────────────────────────────────────── */}
        {activeTab === 'gateways' && (
          <SettingSection title="Parent Alert SMS & WhatsApp Delivery Nodes" accentColor="bg-amber-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingField label="Primary SMS Gateway Provider" hint="Routes automated parent notifications for fee receipts and exam results.">
                <select value={smsGatewayProvider} onChange={(e) => setSmsGatewayProvider(e.target.value)} className={inputClass}>
                  <option value="termii">Termii SMS API (Recommended for Nigeria)</option>
                  <option value="africastalking">Africa&apos;s Talking API</option>
                  <option value="twilio">Twilio Programmable SMS</option>
                  <option value="mock">Mock Simulator (Local Development)</option>
                </select>
              </SettingField>
              <SettingField label={`Platform SMS Base Unit Rate (${defaultCurrencySymbol})`} hint="Base cost charged per dispatched SMS broadcast page.">
                <input type="number" step="0.1" value={smsCostPerUnit} onChange={(e) => setSmsCostPerUnit(Number(e.target.value))} className={`${inputClass} text-amber-500`} />
              </SettingField>
              <SettingField label="Termii SMS API Master Credentials" hint="Master key for dispatching SMS broadcasts to parents across all school tenants." colSpan>
                <input
                  type="password"
                  name="termii_master_api_key"
                  autoComplete="new-password"
                  placeholder="Enter Termii API Key (e.g. TL_...)"
                  value={termiiApiKey}
                  onChange={(e) => setTermiiApiKey(e.target.value)}
                  className={inputClass}
                />
              </SettingField>
            </div>
          </SettingSection>
        )}

        {/* ── Tab: Security ─────────────────────────────────────────────────────── */}
        {activeTab === 'security' && (
          <SettingSection title="Super Admin Account & Security Boundaries" accentColor="bg-rose-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingField label="Super Admin Display Name">
                <input type="text" name="sa_display_name" autoComplete="off" value={adminName} onChange={(e) => setAdminName(e.target.value)} required className={inputClass} />
              </SettingField>
              <SettingField label="Super Admin Primary Email">
                <input type="email" name="sa_primary_email" autoComplete="off" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required className={inputClass} />
              </SettingField>
              <SettingField label="Change Master Password" colSpan>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">New Password</label>
                    <input type="password" name="sa_new_password" autoComplete="new-password" placeholder="Leave blank to keep current" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[10px] adm-text-muted uppercase tracking-widest mb-1">Confirm New Password</label>
                    <input type="password" name="sa_confirm_password" autoComplete="new-password" placeholder="Leave blank to keep current" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
                  </div>
                </div>
              </SettingField>
              <div className="adm-surface border adm-divider rounded-xl p-4 space-y-2 md:col-span-2">
                <h4 className="text-xs font-bold text-amber-500 flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Audited Super Admin Guards
                </h4>
                <div className="space-y-1.5 text-[11px] font-mono">
                  {[
                    { label: 'Mandatory Impersonation Audit Reason', value: 'Strictly Enforced', color: 'text-emerald-500' },
                    { label: 'Top Non-Dismissible Impersonation Banner', value: 'Active Across All Subdomains', color: 'text-emerald-500' },
                    { label: 'Cookie Isolation Domain', value: 'bms_sa_session / bms_sa_impersonate', color: 'adm-text-primary' },
                  ].map((g) => (
                    <div key={g.label} className={`flex justify-between py-1.5 border-b adm-divider last:border-0 adm-text-secondary`}>
                      <span>{g.label}</span>
                      <strong className={g.color}>{g.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SettingSection>
        )}

        {/* ── Save Button ────────────────────────────────────────────────────────── */}
        <div className="flex justify-end pt-4 border-t adm-divider">
          <button
            type="submit"
            disabled={saving}
            className="adm-btn-primary inline-flex items-center gap-2 px-6 py-2.5 font-semibold rounded-lg text-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <SaveIcon />
            {saving ? 'Saving Configuration…' : 'Save Global Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
