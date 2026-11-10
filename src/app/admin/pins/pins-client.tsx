'use client';

import React, { useState } from 'react';

interface PinBatchItem {
  id: string;
  batchNumber: string | null;
  maxUsesPerPin: number;
  pricePerPin: number;
  platformFeeTotal?: number;
  createdAt: string;
  tenant: { name: string; slug: string } | null;
  _count: { pins: number };
}

interface TenantSimple {
  id: string;
  name: string;
  slug: string;
}

interface PinsClientProps {
  initialBatches: PinBatchItem[];
  totalPins: number;
  pinUsages: number;
  totalPlatformRevenue?: number;
  tenants: TenantSimple[];
}

export function PinsClient({ initialBatches, totalPins, pinUsages, totalPlatformRevenue = 0, tenants }: PinsClientProps) {
  const [batches, setBatches] = useState<PinBatchItem[]>(initialBatches);
  const [totalCount, setTotalCount] = useState(totalPins);

  // Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(tenants[0]?.id || '');
  const [pinCount, setPinCount] = useState('50');
  const [maxUses, setMaxUses] = useState('5');
  const [price, setPrice] = useState('1000');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Export PIN Batch CSV
  const handleExportBatchCSV = async (batch: PinBatchItem) => {
    try {
      const res = await fetch(`/api/admin/pins/export?batchId=${batch.id}`);
      if (!res.ok) {
        alert('Failed to fetch batch serials for export.');
        return;
      }
      const data = await res.json();
      const pins = data.pins || [];

      const headers = ['Serial Number', 'PIN Code', 'Price (Naira)', 'Max Uses', 'School Name', 'Created At'];
      const rows = pins.map((p: any) => [
        `"${p.serialNumber}"`,
        `"${p.pinCode}"`,
        p.pricePaid || batch.pricePerPin,
        batch.maxUsesPerPin,
        `"${batch.tenant?.name || 'Global'}"`,
        `"${new Date(batch.createdAt).toLocaleString()}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${batch.batchNumber || batch.id}_serials.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error exporting PIN batch CSV');
    }
  };

  // Generate PIN Batch
  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) return;

    setGenerating(true);
    setError('');

    try {
      const res = await fetch('/api/admin/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenantId,
          count: Number(pinCount),
          maxUsesPerPin: Number(maxUses),
          pricePerPin: Number(price),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate PIN batch');

      setBatches([data.batch, ...batches]);
      setTotalCount((prev) => prev + (data.batch._count?.pins || 0));
      setShowGenerateModal(false);

      // Auto trigger CSV download for vendor printing
      if (data.pins && data.pins.length > 0) {
        const headers = ['Serial Number', 'PIN Code', 'Price (Naira)', 'Max Uses', 'School Name', 'Created At'];
        const rows = data.pins.map((p: any) => [
          `"${p.serialNumber}"`,
          `"${p.pinCode}"`,
          p.pricePaid,
          data.batch.maxUsesPerPin,
          `"${data.batch.tenant?.name || 'Global'}"`,
          `"${new Date(data.batch.createdAt).toLocaleString()}"`,
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${data.batch.batchNumber}_serials.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b adm-border-replace">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Scratch Card PIN Monetization Engine</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track PIN batch creation, usage metrics, serial numbers, and platform revenue collection across all tenants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled
            title="Schools must purchase PIN stock from their own Result PIN dashboard."
            className="px-4 py-2 bg-slate-700 text-slate-300 font-bold text-xs rounded-xl shadow-lg transition cursor-not-allowed flex items-center gap-1.5 opacity-70"
          >
            <span><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0V6H3a1 1 0 110-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2l4.456.967a1 1 0 01.54 1.706l-3.37 3.003.957 4.417a1 1 0 01-1.488 1.08L11 16.03l-3.741 2.343a1 1 0 01-1.488-1.08l.957-4.417-3.37-3.003a1 1 0 01.54-1.706l4.456-.967L9.033 2.744A1 1 0 0110 2z" clipRule="evenodd" /></svg></span>
            <span>School purchases only</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="adm-card-bg-replace border adm-border-replace rounded-2xl p-6">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Total PIN Batches
          </span>
          <span className="text-3xl font-extrabold text-white">{batches.length}</span>
          <span className="text-xs text-slate-500 block mt-1">Generated across all school tenants</span>
        </div>

        <div className="adm-card-bg-replace border adm-border-replace rounded-2xl p-6">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Total Individual Serials
          </span>
          <span className="text-3xl font-extrabold text-cyan-400">{totalCount.toLocaleString()}</span>
          <span className="text-xs text-slate-500 block mt-1">Unique scratch card PIN records</span>
        </div>

        <div className="adm-card-bg-replace border adm-border-replace rounded-2xl p-6">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Total Validated Usages
          </span>
          <span className="text-3xl font-extrabold text-emerald-400">{pinUsages.toLocaleString()}</span>
          <span className="text-xs text-slate-500 block mt-1">Result checking attempts recorded</span>
        </div>

        <div className="adm-card-bg-replace border adm-border-replace rounded-2xl p-6">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
            Platform PIN Revenue
          </span>
          <span className="text-3xl font-extrabold text-cyan-400">
            ₦{totalPlatformRevenue.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 block mt-1">Platform fee cut collected via Paystack</span>
        </div>
      </div>

      {/* PIN Batches Table */}
      <div className="adm-card-bg-replace border adm-border-replace rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b adm-border-replace bg-slate-950/40 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-white">Recent PIN Batches</h2>
            <p className="text-xs text-slate-400">Batches created for result-checker authentication.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 font-mono">
              <tr>
                <th className="px-6 py-3">Batch Reference</th>
                <th className="px-6 py-3">School Tenant</th>
                <th className="px-6 py-3">PIN Count</th>
                <th className="px-6 py-3">Price / PIN</th>
                <th className="px-6 py-3">Platform Fee Paid</th>
                <th className="px-6 py-3">Created At</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 text-xs font-mono">
                    No PIN batches generated yet. Click &quot;Generate PIN Batch&quot; above to issue scratch cards.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-800/40 transition-colors font-mono text-xs">
                    <td className="px-6 py-4 text-white font-bold">{batch.batchNumber || batch.id}</td>
                    <td className="px-6 py-4 text-cyan-400 font-sans">{batch.tenant?.name || 'Global'}</td>
                    <td className="px-6 py-4 text-emerald-400">{batch._count?.pins || 0} PINs</td>
                    <td className="px-6 py-4 text-slate-300">₦{Number(batch.pricePerPin || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-amber-400 font-bold">₦{Number(batch.platformFeeTotal || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-400">{new Date(batch.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-sans">
                      <button
                        onClick={() => handleExportBatchCSV(batch)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border adm-border-replace text-xs font-semibold cursor-pointer"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg> Export CSV
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate PIN Batch Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full adm-card-bg-replace border adm-border-replace rounded-3xl p-6 shadow-2xl text-white space-y-4">
            <div className="flex justify-between items-center border-b adm-border-replace pb-3">
              <h2 className="text-lg font-bold">Generate Scratch Card PIN Batch</h2>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">
                ×
              </button>
            </div>

            {error && <div className="p-3 bg-rose-950 border border-rose-800 text-rose-300 text-xs rounded-xl">{error}</div>}

            <form onSubmit={handleGenerateBatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Target School Tenant</label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-3 py-2 adm-surface-bg-replace border adm-border-replace rounded-xl text-xs text-white font-bold"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity of PINs</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={pinCount}
                    onChange={(e) => setPinCount(e.target.value)}
                    required
                    className="w-full px-3 py-2 adm-surface-bg-replace border adm-border-replace rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Max Uses Per PIN</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    required
                    className="w-full px-3 py-2 adm-surface-bg-replace border adm-border-replace rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Price Per PIN (₦)</label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full px-3 py-2 adm-surface-bg-replace border adm-border-replace rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t adm-border-replace">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {generating ? 'Generating...' : 'Issue Batch & Download CSV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
