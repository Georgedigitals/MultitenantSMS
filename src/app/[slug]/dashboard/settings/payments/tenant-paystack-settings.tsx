'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type TenantProvider = 'paystack' | 'flutterwave' | 'stripe';

const PAYSTACK_CURRENCIES = new Set(['NGN', 'GHS', 'ZAR', 'KES', 'XOF', 'USD']);

export default function TenantPaystackSettings({
  slug,
  schoolName,
}: {
  slug: string;
  schoolName: string;
}) {
  const [provider, setProvider] = useState<TenantProvider>('paystack');
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [pinSalesEnabled, setPinSalesEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const [platformCurrencyCode, setPlatformCurrencyCode] = useState('NGN');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/tenant/settings/payment-gateway?slug=${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load gateway settings.');
        setConfigured(data.configured);
        if (data.provider) setProvider(data.provider);
        setEnabled(data.enabled);
        setPinSalesEnabled(data.pinSalesEnabled);
        setMode(data.mode);
        setHasWebhookSecret(Boolean(data.hasWebhookSecret));
        if (data.platformCurrencyCode) setPlatformCurrencyCode(data.platformCurrencyCode);
      })
      .catch((err) => setError(err.message || 'Unable to load gateway settings.'))
      .finally(() => setLoading(false));
  }, [slug]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/tenant/settings/payment-gateway?slug=${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, secretKey, webhookSecret, enabled, pinSalesEnabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save gateway settings.');
      setConfigured(data.configured);
      setProvider(data.provider);
      setEnabled(data.enabled);
      setPinSalesEnabled(data.pinSalesEnabled);
      setMode(data.mode);
      setHasWebhookSecret(Boolean(data.hasWebhookSecret));
      setSecretKey('');
      setWebhookSecret('');
      setMessage('Payment gateway settings saved. Parent fee payments now go directly to this school’s account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save gateway settings.');
    } finally {
      setSaving(false);
    }
  }

  const currencyWarning =
    provider === 'paystack' && !PAYSTACK_CURRENCIES.has(platformCurrencyCode.toUpperCase());

  const keyPlaceholder =
    provider === 'stripe'
      ? 'sk_live_… or sk_test_…'
      : provider === 'flutterwave'
      ? 'FLWSECK-… or FLWSECK_TEST…'
      : 'sk_live_… or sk_test_…';

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div>
        <Link
          href={`/${slug}/dashboard/settings`}
          className="text-sm font-semibold text-[#0a0a0a] hover:underline"
        >
          ← Back to school settings
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-[#0a0a0a] tracking-tight">
          Direct-to-School Payment Gateway
        </h1>
        <p className="mt-2 text-sm text-[#66645e]">
          Connect {schoolName}&apos;s own Paystack, Flutterwave, or Stripe account. Tuition fees and other school charges go 100% directly to {schoolName}&apos;s bank account — no platform fee is deducted.
        </p>
      </div>

      <section className="rounded-xl border border-[#e4e2dd] bg-white p-5 sm:p-7">
        {loading ? (
          <p className="text-sm text-[#66645e]">Loading payment settings…</p>
        ) : (
          <form onSubmit={save} className="space-y-5">
            {error && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                {message}
              </p>
            )}

            <div className="rounded-lg border border-[#e4e2dd] bg-[#f4f3f1] p-4 text-xs text-[#4f4d48] flex flex-wrap items-center justify-between gap-2">
              <span>
                {configured ? (
                  <>
                    Active provider: <strong className="uppercase text-[#0a0a0a]">{provider}</strong> ·{' '}
                    {mode ? `${mode} mode` : 'mode unavailable'} · encrypted at rest
                  </>
                ) : (
                  'No payment gateway secret key saved yet.'
                )}
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-[#e4e2dd] text-[#0a0a0a]">
                Currency: {platformCurrencyCode}
              </span>
            </div>

            <label className="block text-sm font-semibold text-[#0a0a0a]">
              Payment Provider
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as TenantProvider)}
                className="mt-2 w-full rounded-lg border border-[#d4d1ca] bg-white px-3 py-2.5 text-sm text-[#0a0a0a]"
              >
                <option value="paystack">Paystack (NGN, GHS, KES, ZAR, XOF, USD)</option>
                <option value="flutterwave">Flutterwave (Pan-Africa + USD, GBP, EUR)</option>
                <option value="stripe">Stripe Global (135+ Currencies Worldwide)</option>
              </select>
            </label>

            {currencyWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Paystack does not support <strong>{platformCurrencyCode}</strong>. Select <strong>Stripe Global</strong> or <strong>Flutterwave</strong> so parents can complete checkout in {platformCurrencyCode}.
              </div>
            )}

            <label className="block text-sm font-semibold text-[#0a0a0a]">
              {provider === 'stripe'
                ? 'Stripe Secret Key'
                : provider === 'flutterwave'
                ? 'Flutterwave Secret Key'
                : 'Paystack Secret Key'}
              <input
                type="password"
                autoComplete="new-password"
                value={secretKey}
                onChange={(event) => setSecretKey(event.target.value)}
                placeholder={configured ? 'Leave blank to keep the saved key' : keyPlaceholder}
                className="mt-2 w-full rounded-lg border border-[#d4d1ca] px-3 py-2.5 font-mono text-sm text-[#0a0a0a]"
              />
            </label>
            <p className="-mt-3 text-xs text-[#66645e]">
              Encrypted with AES-256-GCM before storage and never returned to the browser.
            </p>

            {provider === 'stripe' && (
              <div>
                <label className="block text-sm font-semibold text-[#0a0a0a]">
                  Stripe Webhook Signing Secret {hasWebhookSecret ? '(Saved)' : '(Recommended)'}
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={webhookSecret}
                    onChange={(event) => setWebhookSecret(event.target.value)}
                    placeholder={hasWebhookSecret ? 'Leave blank to keep saved webhook secret' : 'whsec_…'}
                    className="mt-2 w-full rounded-lg border border-[#d4d1ca] px-3 py-2.5 font-mono text-sm text-[#0a0a0a]"
                  />
                </label>
                <p className="mt-1 text-xs text-[#66645e]">
                  In your Stripe dashboard, add webhook endpoint <code className="font-mono">/api/webhooks/stripe</code> for <code className="font-mono">checkout.session.completed</code>.
                </p>
              </div>
            )}

            <label className="flex items-start gap-3 rounded-lg border border-[#e4e2dd] p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <strong className="block text-sm text-[#0a0a0a]">Enable online school-fee payments</strong>
                <span className="mt-1 block text-xs text-[#66645e]">
                  Parents pay tuition and other school charges directly through {schoolName}&apos;s {provider} account. Turn off to use manual bank transfer verification only.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-[#e4e2dd] p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={pinSalesEnabled}
                onChange={(event) => setPinSalesEnabled(event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <strong className="block text-sm text-[#0a0a0a]">Enable online Result PIN sales</strong>
                <span className="mt-1 block text-xs text-[#66645e]">
                  Parents can purchase result PINs from your prepaid stock directly through {schoolName}&apos;s account.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#141414] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving securely…' : 'Save payment settings'}
            </button>
          </form>
        )}
      </section>

      <aside className="rounded-xl border border-[#e4e2dd] bg-[#f4f3f1] p-4 text-xs text-[#4f4d48]">
        <strong className="text-[#0a0a0a]">Separate platform billing:</strong> School subscriptions and platform PIN stock orders are billed by the platform owner. All student tuition, bus, uniform, and exam fees collected here go 100% directly to {schoolName}&apos;s account.
      </aside>
    </main>
  );
}
