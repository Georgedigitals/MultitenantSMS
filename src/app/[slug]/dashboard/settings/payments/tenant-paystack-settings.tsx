'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TenantPaystackSettings({ slug, schoolName }: { slug: string; schoolName: string }) {
  const [secretKey, setSecretKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [pinSalesEnabled, setPinSalesEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
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
        setEnabled(data.enabled);
        setPinSalesEnabled(data.pinSalesEnabled);
        setMode(data.mode);
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
        body: JSON.stringify({ secretKey, enabled, pinSalesEnabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save gateway settings.');
      setConfigured(data.configured);
      setEnabled(data.enabled);
      setPinSalesEnabled(data.pinSalesEnabled);
      setMode(data.mode);
      setSecretKey('');
      setMessage('Paystack settings saved. This school’s enabled payments use its own account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save gateway settings.');
    } finally {
      setSaving(false);
    }
  }

  return <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
    <div><Link href={`/${slug}/dashboard/settings`} className="text-sm font-semibold text-emerald-800 hover:underline">← Back to school settings</Link><h1 className="mt-4 text-2xl font-bold text-slate-950">School fee Paystack</h1><p className="mt-2 text-sm text-slate-600">Connect {schoolName}’s own Paystack secret key. School-fee payments go directly to this school’s Paystack account. BMS does not take a platform fee from school fees.</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {loading ? <p className="text-sm text-slate-600">Loading payment settings…</p> : <form onSubmit={save} className="space-y-5">
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{configured ? <>Credential saved · {mode ? `${mode} mode` : 'mode unavailable'} · secret hidden</> : 'No Paystack secret key saved yet.'}</div>
        <label className="block text-sm font-semibold text-slate-800">Paystack secret key
          <input type="password" autoComplete="new-password" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} placeholder={configured ? 'Leave blank to keep the saved key' : 'sk_test_… or sk_live_…'} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-mono text-sm text-slate-950" />
        </label>
        <p className="-mt-3 text-xs text-slate-500">The key is encrypted before it is stored and is never returned to the browser. Enter the secret key from the school’s Paystack dashboard; do not use the BMS platform key.</p>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-1 h-4 w-4" />
          <span><strong className="block text-sm text-slate-900">Enable online school-fee payments</strong><span className="mt-1 block text-xs text-slate-600">Parents will be sent to this school’s Paystack checkout. Turn it off to use bank transfer and bursar verification only.</span></span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
          <input type="checkbox" checked={pinSalesEnabled} onChange={(event) => setPinSalesEnabled(event.target.checked)} className="mt-1 h-4 w-4" />
          <span><strong className="block text-sm text-slate-900">Enable online Result PIN sales</strong><span className="mt-1 block text-xs text-slate-600">Parents can buy a PIN only while your prepaid PIN stock is available. Payments go to this school’s Paystack account.</span></span>
        </label>
        <button type="submit" disabled={saving} className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{saving ? 'Saving securely…' : 'Save payment settings'}</button>
      </form>}
    </section>
    <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Separate platform payments:</strong> school subscriptions and PIN stock orders are paid to BMS through the platform Paystack account. Parent PIN resales are paid to this school&apos;s Paystack account.</aside>
  </main>;
}
