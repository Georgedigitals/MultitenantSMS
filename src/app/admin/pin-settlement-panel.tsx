'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/components/language-provider';

type TenantDue = { id: string; name: string; slug: string; pinCount: number; gross: number; platformFee: number; schoolNetDue: number };
type PinDue = { id: string; studentName: string; termName: string; amount: number; platformFee: number; schoolNet: number; paymentRef: string; purchasedAt: string };
type Settlement = { id: string; tenantName: string; tenantSlug: string; pinCount: number; gross: number; platformFee: number; schoolNet: number; payoutReference: string; settledAt: string };

export default function PinSettlementPanel() {
  const { formatMoney, localization } = useLanguage();
  const fmt = (amount: number) => formatMoney(amount, 2);
  const [tenants, setTenants] = useState<TenantDue[]>([]);
  const [pins, setPins] = useState<PinDue[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payoutReference, setPayoutReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSummary = useCallback(async () => {
    const response = await fetch('/api/admin/pin-settlements');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load PIN payout records.');
    setTenants(data.outstanding || []);
    setSettlements(data.settlements || []);
    setTenantId((current) => current && data.outstanding.some((item: TenantDue) => item.id === current) ? current : data.outstanding[0]?.id || '');
  }, []);

  useEffect(() => {
    loadSummary().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [loadSummary]);

  useEffect(() => {
    if (!tenantId) { setPins([]); setSelectedIds([]); return; }
    fetch(`/api/admin/pin-settlements?tenantId=${encodeURIComponent(tenantId)}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load PIN sales.'); return data; })
      .then((data) => { setPins(data.pendingPins || []); setSelectedIds([]); })
      .catch((err) => setError(err.message || 'Could not load PIN sales.'));
  }, [tenantId]);

  const selected = pins.filter((pin) => selectedIds.includes(pin.id));
  const totalDue = selected.reduce((sum, pin) => sum + pin.schoolNet, 0);

  async function recordPayout(event: React.FormEvent) {
    event.preventDefault();
    if (!tenantId || !selectedIds.length || payoutReference.trim().length < 4) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/pin-settlements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, pinIds: selectedIds, payoutReference }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not record the payout.');
      setMessage(`Recorded ${data.pinCount} PIN payout items. School amount: ${fmt(data.schoolNet)}; platform fee retained: ${fmt(data.platformFee)}.`);
      setPins((current) => current.filter((pin) => !selectedIds.includes(pin.id)));
      setSelectedIds([]);
      setPayoutReference('');
      await loadSummary();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not record the payout.'); }
    finally { setSaving(false); }
  }

  return <section className="rounded-xl adm-card border overflow-hidden">
    <div className="border-b adm-divider p-5">
      <h2 className="text-sm font-bold adm-text-primary">Result PIN school payouts</h2>
      <p className="mt-1 max-w-3xl text-xs adm-text-muted">Online PIN purchases processed through the platform payment gateway are settled to the platform account. The configured plan fee is retained by the platform; the school net is payable to the school. Send the payout from your payment gateway or bank first, then record its reference here. This form records a completed payout; it does not move money.</p>
    </div>
    <div className="space-y-4 p-5">
      {error && <p role="alert" className="adm-status-error rounded-lg border border-[#e8c3bd] p-3 text-sm">{error}</p>}
      {message && <p role="status" className="adm-status-active rounded-lg border adm-accent-border p-3 text-sm">{message}</p>}
      {loading ? <p className="text-sm adm-text-muted">Loading payout ledger…</p> : tenants.length === 0 ? <p className="rounded-xl border adm-divider p-5 text-sm adm-text-muted">No unpaid school allocation from platform PIN purchases.</p> : <>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="text-xs font-semibold adm-text-muted">School
            <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="adm-input mt-1 block w-full rounded-md border px-3 py-2 text-sm adm-text-primary">
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} — due {fmt(tenant.schoolNetDue)} ({tenant.pinCount} PINs)</option>)}
            </select>
          </label>
          <div className="text-xs adm-text-muted">Selected payout: <strong className="adm-text-primary">{fmt(totalDue)}</strong> ({selectedIds.length} PINs)</div>
        </div>
        <div className="max-h-72 overflow-auto rounded-xl border adm-divider">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 adm-surface"><tr><th className="p-2"><input aria-label="Select all visible unpaid PINs" type="checkbox" checked={pins.length > 0 && selectedIds.length === pins.length} onChange={(event) => setSelectedIds(event.target.checked ? pins.map((pin) => pin.id) : [])} /></th><th className="p-2">Student / term</th><th className="p-2">Payment ref</th><th className="p-2">Gross</th><th className="p-2">Platform fee</th><th className="p-2">School net</th></tr></thead>
            <tbody>{pins.map((pin) => <tr key={pin.id} className="border-t adm-divider"><td className="p-2"><input type="checkbox" checked={selectedIds.includes(pin.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, pin.id] : current.filter((id) => id !== pin.id))} /></td><td className="p-2"><strong className="block adm-text-primary">{pin.studentName}</strong><span className="adm-text-muted">{pin.termName}</span></td><td className="p-2 adm-text-muted">{pin.paymentRef}</td><td className="p-2">{fmt(pin.amount)}</td><td className="p-2 adm-text-warning">{fmt(pin.platformFee)}</td><td className="p-2 font-semibold adm-text-accent">{fmt(pin.schoolNet)}</td></tr>)}</tbody>
          </table>
        </div>
        <form onSubmit={recordPayout} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} minLength={4} maxLength={120} required placeholder="Bank / gateway payout transfer reference" className="rounded-lg border adm-divider bg-transparent px-3 py-2 text-sm adm-text-primary" />
          <button disabled={saving || !selectedIds.length} className="rounded-md bg-[#17834b] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#126b3d] disabled:opacity-50">{saving ? 'Recording…' : 'Record completed payout'}</button>
        </form>
        {pins.length === 500 && <p className="text-xs text-amber-800">Showing the oldest 500 unpaid PINs. Record this selection, then load the next group.</p>}
      </>}
      {settlements.length > 0 && <div className="pt-3"><h3 className="mb-2 text-[13px] font-semibold adm-text-secondary">Recent payouts</h3><div className="max-h-48 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Date</th><th className="p-2">School</th><th className="p-2">Payout ref</th><th className="p-2">PINs</th><th className="p-2">School net</th></tr></thead><tbody>{settlements.map((item) => <tr key={item.id} className="border-t adm-divider"><td className="p-2">{new Date(item.settledAt).toLocaleDateString(localization.locale)}</td><td className="p-2">{item.tenantName}</td><td className="p-2">{item.payoutReference}</td><td className="p-2">{item.pinCount}</td><td className="p-2 font-semibold">{fmt(item.schoolNet)}</td></tr>)}</tbody></table></div></div>}
    </div>
  </section>;
}
