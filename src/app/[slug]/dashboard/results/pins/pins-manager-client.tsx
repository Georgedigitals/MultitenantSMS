'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';

interface PinBatchItem {
  id: string;
  batchNumber: string;
  quantity: number;
  maxUsesPerPin: number;
  pricePerPin: number;
  platformFeeTotal: number;
  platformFeePercent?: number;
  paymentRef: string | null;
  status: string;
  createdAt: string;
  totalGenerated: number;
  usedPinsCount: number;
  unusedPinsCount: number;
  totalSessionsUsed: number;
}

interface StatsData {
  totalPinsGenerated: number;
  totalPinsUsed: number;
  totalPinsRemaining: number;
  currentSellingPrice: number;
  schoolName: string;
  onlinePinTotals?: { gross: number; platformFee: number; schoolNet: number; pendingSchoolPayout: number; settledSchoolPayout: number; schoolDirectSales?: number };
  platformFeePercent?: number;
}

interface OnlinePinPurchase {
  id: string;
  studentName: string;
  termName: string;
  paymentRef: string;
  amount: number;
  platformFee: number;
  schoolNet: number;
  payoutStatus: string;
  settlementId?: string | null;
  status: string;
  paidAt: string;
  source?: string;
}

interface PinBankTransfer {
  id: string;
  studentName: string;
  termName: string;
  paymentRef: string | null;
  amount: number;
  status: string;
  rejectionReason: string | null;
  senderName: string;
  bankName: string;
  proofUrl: string | null;
  reviewerName: string | null;
  paidAt: string;
}

export function PinsManagerClient({
  slug,
  schoolName,
  initialPinPrice,
  onPriceChange,
}: {
  slug: string;
  schoolName: string;
  initialPinPrice?: number;
  onPriceChange?: (price: number) => void;
}) {
  const { localization: { currencySymbol, locale } } = useLanguage();
  const [batches, setBatches] = useState<PinBatchItem[]>([]);
  const [onlinePurchases, setOnlinePurchases] = useState<OnlinePinPurchase[]>([]);
  const [bankTransferPurchases, setBankTransferPurchases] = useState<PinBankTransfer[]>([]);
  const [reviewingTransfer, setReviewingTransfer] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Universal Single Pricing State (Governs both Online and Physical Scratch Cards)
  const [universalPrice, setUniversalPrice] = useState<number>(initialPinPrice || 1000);
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceSavedNotice, setPriceSavedNotice] = useState(false);

  // Order Batch Modal State
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [quantity, setQuantity] = useState<number>(100);
  const [pricePerPin, setPricePerPin] = useState<number>(initialPinPrice || 1000);
  const [ordering, setOrdering] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Platform cut calculation follows the school's subscribed plan.
  const platformFeeRate = (stats?.platformFeePercent ?? 10) / 100;
  const platformFeePerPin = Math.round(pricePerPin * platformFeeRate * 100) / 100;
  const totalPlatformFee = Math.round(platformFeePerPin * quantity * 100) / 100;
  const projectedGross = pricePerPin * quantity;
  const schoolNetProfit = projectedGross - totalPlatformFee;

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenant/pins/batches?slug=${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch PIN batches');
      setBatches(data.batches || []);
      setOnlinePurchases(data.onlinePurchases || []);
      setBankTransferPurchases(data.bankTransferPurchases || []);
      setStats(data.stats || null);
      if (data.stats?.currentSellingPrice) {
        const remotePrice = Number(data.stats.currentSellingPrice);
        setUniversalPrice(remotePrice);
        setPricePerPin(remotePrice);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading PIN batches');
    } finally {
      setLoading(false);
    }
  };

  const reviewBankTransfer = async (id: string, action: 'approve' | 'reject') => {
    setReviewingTransfer(id);
    setError(null);
    try {
      const response = await fetch(`/api/tenant/pins/verifications?slug=${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not review this transfer.');
      setSuccessMsg(action === 'approve' ? 'Transfer approved. The student can now see the issued PIN in the portal.' : 'Transfer rejected.');
      await fetchBatches();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not review this transfer.');
    } finally {
      setReviewingTransfer(null);
    }
  };

  useEffect(() => {
    fetchBatches();

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success') {
        const ref = urlParams.get('ref');
        setSuccessMsg(
          ref
            ? `Payment verified! Scratch card batch generated successfully (Ref: ${ref}).`
            : 'Payment verified! Your Result PIN batch has been generated and is ready.'
        );
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [slug]);

  // Save Universal PIN Price across the school
  const handleSaveUniversalPrice = async () => {
    try {
      setSavingPrice(true);
      const res = await fetch(`/api/tenant/settings/pin-price?slug=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinPrice: universalPrice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update PIN price');

      setStats((prev) => (prev ? { ...prev, currentSellingPrice: universalPrice } : null));
      onPriceChange?.(universalPrice);
      setPriceSavedNotice(true);
      setSuccessMsg(`Official Result PIN price updated to ${currencySymbol}${universalPrice.toLocaleString()}`);
      setTimeout(() => setPriceSavedNotice(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Error saving price');
    } finally {
      setSavingPrice(false);
    }
  };

  // Handle Paystack Batch Payment Order
  const handleProceedToPaystack = async () => {
    try {
      setOrdering(true);
      setModalError(null);

      const res = await fetch(`/api/tenant/pins/batch/order?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, pricePerPin }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate Paystack checkout');

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      throw new Error('Paystack did not return a secure checkout link. Please retry.');
    } catch (err: any) {
      setModalError(err.message || 'Payment initialization failed');
    } finally {
      setOrdering(false);
    }
  };

  // Export CSV
  const handleExportCSV = async (batch: PinBatchItem) => {
    try {
      const res = await fetch(`/api/tenant/pins/batch/${batch.id}?slug=${slug}`);
      const data = await res.json();
      if (!res.ok || !data.batch) throw new Error('Failed to load batch pins');

      const pins = data.batch.pins || [];
      const headers = ['Serial Number', '12-Digit PIN Code', 'Resale Price (NGN)', 'Max Uses', 'Status', 'Uses Count', 'Created At'];
      const rows = pins.map((p: any) => [
        `"${p.serialNumber}"`,
        `"${p.pinCode}"`,
        p.pricePaid,
        batch.maxUsesPerPin,
        p.isUsed ? 'Activated' : 'Unused',
        p.usesCount,
        `"${new Date(p.createdAt).toLocaleDateString()}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${schoolName.replace(/\\s+/g, '_')}_${batch.batchNumber}_Scratch_Cards.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Error exporting CSV');
    }
  };

  return (
    <div className="space-y-6">
      {/* Unified Pricing & Batch Ordering Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
        {/* Header row with Title and Order Batch Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-lg">💳</span>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Result Checker PIN Monetization &amp; Batch Management</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  One unified control center for online portal purchases, bulk scratch card generation, and card sheet printing.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setModalError(null);
              setPricePerPin(universalPrice);
              setShowOrderModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Order Scratch Card Batch (Paystack)
          </button>
        </div>

        {/* Pricing & Dual Revenue Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Universal Price Input */}
          <div className="lg:col-span-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Official Result PIN Sale Price ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">{currencySymbol}</span>
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={universalPrice}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setUniversalPrice(val);
                    setPricePerPin(val);
                  }}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Applies to parent online purchases on the result checker portal and pre-fills the face value for physical scratch card batches.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveUniversalPrice}
                disabled={savingPrice || (stats?.currentSellingPrice !== undefined && universalPrice === stats.currentSellingPrice)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {savingPrice ? 'Saving...' : 'Update Official Price'}
              </button>
              {priceSavedNotice && (
                <span className="text-[11px] font-semibold text-emerald-600">✓ Price Saved</span>
              )}
            </div>

            <div className="pt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Anti-Sharing Usage Limit</span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[10px] font-bold text-slate-800">
                  5 Uses / Student
                </span>
              </div>
            </div>
          </div>

          {/* Dual Revenue Split Cards */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Online Portal Split */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                    Online Portal Purchases
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 font-semibold">
                    Instant PIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  When parents purchase directly via Paystack on the public Result Checker portal.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-800">
                <div className="p-2 rounded-lg bg-slate-800/80">
                  <span className="text-[9px] text-slate-400 block uppercase">Parent Pays</span>
                  <span className="text-xs font-bold text-white">{currencySymbol}{universalPrice.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/80">
                  <span className="text-[9px] text-slate-400 block uppercase">Platform paid upfront</span>
                  <span className="text-xs font-bold text-cyan-400">{currencySymbol}{(Math.round(universalPrice * platformFeeRate * 100) / 100).toLocaleString()}</span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800">
                  <span className="text-[9px] text-emerald-300 block uppercase font-semibold">School receives</span>
                  <span className="text-xs font-bold text-emerald-400">{currencySymbol}{universalPrice.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                The platform payout status below is updated after BMS records a bank payout to the school.
              </p>
            </div>

            {/* Physical Scratch Card Split */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                    Physical Scratch Cards
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 font-semibold">
                    Printed Cards
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  When school generates physical scratch card sheets to sell over the counter at the bursary.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-800">
                <div className="p-2 rounded-lg bg-slate-800/80">
                  <span className="text-[9px] text-slate-400 block uppercase">Student Pays</span>
                  <span className="text-xs font-bold text-white">{currencySymbol}{universalPrice.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/80">
                  <span className="text-[9px] text-slate-400 block uppercase">Platform paid at stock purchase</span>
                  <span className="text-xs font-bold text-cyan-400">{currencySymbol}{(Math.round(universalPrice * platformFeeRate * 100) / 100).toLocaleString()}</span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800">
                  <span className="text-[9px] text-emerald-300 block uppercase font-semibold">School Net</span>
                  <span className="text-xs font-bold text-emerald-400">{currencySymbol}{universalPrice.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                The school pays BMS&apos;s percentage when buying this PIN stock. Sale proceeds then belong to the school.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900 font-bold">✕</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Total PINs Created</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {loading ? '...' : (stats?.totalPinsGenerated || 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Across all batches</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 font-mono block">Available Stock</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {loading ? '...' : (stats?.totalPinsRemaining || 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Unused cards ready for students</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-mono block">Activated / Sold</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {loading ? '...' : (stats?.totalPinsUsed || 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Redeemed by students</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 font-mono block">Official Selling Price</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {currencySymbol}{universalPrice.toLocaleString()}
          </span>
          <span className="text-[11px] text-purple-600 font-semibold mt-1 block">5 Uses / Single Student Bound</span>
        </div>
      </div>

      {/* Batches Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Generated Scratch Card Batches</h2>
            <p className="text-xs text-slate-500">Each batch contains unique Serial Numbers and 12-digit PINs ready to be printed or distributed.</p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
            {batches.length} {batches.length === 1 ? 'Batch' : 'Batches'}
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs font-mono">Loading PIN batches...</div>
        ) : batches.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">🏷️</span>
            <p className="text-sm font-bold text-slate-800">No PIN batches generated yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Click &quot;Order PIN Batch&quot; above to select the quantity of scratch cards you want to sell to your students.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Date Ordered</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Price / Card</th>
                  <th className="py-3 px-4">Platform Fee Paid</th>
                  <th className="py-3 px-4">Stock Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {batch.batchNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(batch.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {batch.quantity} Cards
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {currencySymbol}{batch.pricePerPin.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-cyan-700">
                      {currencySymbol}{batch.platformFeeTotal.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, Math.round((batch.unusedPinsCount / (batch.quantity || 1)) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-slate-600">
                          {batch.unusedPinsCount} left
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/${slug}/dashboard/results/pins/batch/${batch.id}/print`}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors inline-flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print Cards
                        </Link>

                        <button
                          onClick={() => handleExportCSV(batch)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          Export CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ORDER BATCH MODAL */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Result PIN bank-transfer requests</h2>
          <p className="mt-1 text-xs text-slate-500">Confirm each transfer against the school bank statement before approval. Approval issues one PIN. These direct-to-school transfers are recorded as school collections; no platform fee is counted.</p>
        </div>
        {bankTransferPurchases.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">No bank-transfer PIN requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Student / term</th><th className="p-3">Sender / bank</th><th className="p-3">Transfer reference</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Review</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {bankTransferPurchases.map((item) => <tr key={item.id}>
                  <td className="p-3 text-slate-600">{new Date(item.paidAt).toLocaleDateString('en-GB')}</td>
                  <td className="p-3"><strong className="block text-slate-800">{item.studentName}</strong><span className="text-slate-500">{item.termName}</span></td>
                  <td className="p-3">{item.senderName}<span className="block text-slate-500">{item.bankName}</span></td>
                  <td className="p-3 font-mono text-slate-600">{item.paymentRef || '—'}{item.proofUrl && <a className="ml-2 text-blue-700 underline" href={item.proofUrl} target="_blank" rel="noreferrer">Receipt</a>}</td>
                  <td className="p-3 font-semibold">{currencySymbol}{item.amount.toLocaleString()}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 font-semibold ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : item.status === 'rejected' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900'}`}>{item.status}</span>{item.rejectionReason && <span className="mt-1 block max-w-48 text-[10px] text-rose-700">{item.rejectionReason}</span>}</td>
                  <td className="p-3">{item.status === 'pending' ? <div className="flex gap-1"><button disabled={reviewingTransfer === item.id} onClick={() => reviewBankTransfer(item.id, 'approve')} className="rounded-md bg-emerald-700 px-2 py-1.5 font-semibold text-white disabled:opacity-50">Approve</button><button disabled={reviewingTransfer === item.id} onClick={() => reviewBankTransfer(item.id, 'reject')} className="rounded-md border border-rose-200 px-2 py-1.5 font-semibold text-rose-800 disabled:opacity-50">Reject</button></div> : <span className="text-slate-500">{item.reviewerName || 'Reviewed'}</span>}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Online Result PIN Payments</h2>
          <p className="text-xs text-slate-500 mt-1">Online buyers pay your school through your Paystack account. The PIN is taken from stock you already paid BMS for, so there is no second platform deduction.</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span>Gross collected: <strong>{currencySymbol}{(stats?.onlinePinTotals?.gross || 0).toLocaleString()}</strong></span>
            <span>School allocation: <strong className="text-emerald-700">{currencySymbol}{(stats?.onlinePinTotals?.schoolNet || 0).toLocaleString()}</strong></span>
            <span>Paid directly to school from stock sales: <strong className="text-emerald-700">{currencySymbol}{(stats?.onlinePinTotals?.schoolDirectSales || 0).toLocaleString()}</strong></span>
            <span>Platform share on older direct sales: <strong className="text-blue-700">{currencySymbol}{(stats?.onlinePinTotals?.platformFee || 0).toLocaleString()}</strong></span>
          </div>
        </div>
        {onlinePurchases.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">No online PIN purchases have been recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr><th className="p-3">Payment date</th><th className="p-3">Student / term</th><th className="p-3">Reference</th><th className="p-3">Paid</th><th className="p-3">School share</th><th className="p-3">Platform fee</th><th className="p-3">Payout</th><th className="p-3">PIN status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {onlinePurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="p-3 text-slate-600">{new Date(purchase.paidAt).toLocaleDateString('en-GB')}</td>
                    <td className="p-3"><strong className="block text-slate-800">{purchase.studentName}</strong><span className="text-slate-500">{purchase.termName}</span></td>
                    <td className="p-3 font-mono text-slate-600">{purchase.paymentRef}</td>
                    <td className="p-3 font-semibold">{currencySymbol}{purchase.amount.toLocaleString()}</td>
                    <td className="p-3 font-semibold text-emerald-700">{currencySymbol}{purchase.schoolNet.toLocaleString()}</td>
                    <td className="p-3 font-semibold text-blue-700">{currencySymbol}{purchase.platformFee.toLocaleString()}</td>
                    <td className="p-3">{purchase.payoutStatus}</td>
                    <td className="p-3 capitalize">{purchase.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ORDER BATCH MODAL */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Generate Result Scratch Card Batch</h3>
                <p className="text-xs text-slate-500 mt-0.5">Specify quantity and your selling price to calculate the platform cut.</p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <div className="space-y-4">
              {/* Quantity Preset / Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Number of Scratch Cards to Generate
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[50, 100, 200, 500].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        quantity === q
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {q} Cards
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Custom quantity..."
                />
              </div>

              {/* Resale Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Price You Sell to Student (NGN)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">{currencySymbol}</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={pricePerPin}
                    onChange={(e) => setPricePerPin(Math.max(100, parseFloat(e.target.value) || 0))}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 1500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Students or parents will buy these physical scratch cards directly from your school bursary.
                </p>
              </div>

              {/* Realtime Revenue Split Card */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Platform Fee Rate</span>
                  <span className="font-bold text-cyan-400">{platformFeeRate * 100}% per PIN ({currencySymbol}{platformFeePerPin.toLocaleString()})</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Projected School Sales ({quantity} cards)</span>
                  <span className="font-bold text-white">{currencySymbol}{projectedGross.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">School Net Profit</span>
                  <span className="font-bold text-emerald-400">{currencySymbol}{schoolNetProfit.toLocaleString()}</span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Amount Due Platform Today:</span>
                  <span className="text-lg font-black text-cyan-400">{currencySymbol}{totalPlatformFee.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={ordering}
                onClick={handleProceedToPaystack}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {ordering ? (
                  'Connecting to Paystack...'
                ) : (
                  <>
                    <span>Pay {currencySymbol}{totalPlatformFee.toLocaleString()} via Paystack Gateway</span>
                    <span>→</span>
                  </>
                )}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
