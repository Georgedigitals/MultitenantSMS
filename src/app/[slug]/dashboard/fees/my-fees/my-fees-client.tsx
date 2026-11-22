'use client';

import React, { useState } from 'react';
import { FeeBalanceResult } from '@/lib/fees';
import { useLanguage } from '@/components/language-provider';

interface MyFeesClientProps {
  slug: string;
  tenantName: string;
  studentName: string;
  activeTerm: { id: string; name: string; sessionLabel: string } | null;
  feeBalance: FeeBalanceResult | null;
}

export default function MyFeesClient({
  slug,
  tenantName,
  studentName,
  activeTerm,
  feeBalance,
}: MyFeesClientProps) {
  const { localization: { currencySymbol, locale } } = useLanguage();
  const [payAmount, setPayAmount] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  if (!activeTerm || !feeBalance) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-8 text-center">
        <h2 className="text-lg font-bold mb-2">No Fee Records Found</h2>
        <p className="text-sm">
          There are no active term fee records available for {studentName} at this time.
        </p>
      </div>
    );
  }

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payAmount);
    if (!amountNum || amountNum <= 0) return;

    setIsInitializing(true);

    try {
      const res = await fetch('/api/tenant/fees/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: feeBalance.studentId,
          termId: activeTerm.id,
          amount: amountNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to initialize payment');
        return;
      }

      // Redirect to simulated gateway checkout
      if (!data.authorizationUrl) throw new Error('Paystack did not return a secure checkout link. Please retry.');
      window.location.assign(data.authorizationUrl);
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-600 font-mono font-bold block mb-1">
            {activeTerm.sessionLabel} • {activeTerm.name}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            School Fee Breakdown for {studentName}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tenantName} • Itemized fees, discounts, and payment history.
          </p>
        </div>

        {feeBalance.balanceRemaining > 0 && (
          <button
            onClick={() => {
              setPayAmount(String(feeBalance.balanceRemaining));
              setShowPayModal(true);
            }}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors shadow-xs"
          >
            Pay Fees ({currencySymbol}{feeBalance.balanceRemaining.toLocaleString()})
          </button>
        )}
      </div>

      {/* Balance Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-mono font-bold block mb-1">
            Total Assigned
          </span>
          <span className="text-2xl font-extrabold text-slate-900">
            {currencySymbol}{feeBalance.totalAssigned.toLocaleString()}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-purple-200 bg-purple-50/20 p-6 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-purple-700 font-mono font-bold block mb-1">
            Discounts / Waivers
          </span>
          <span className="text-2xl font-extrabold text-purple-600">
            -{currencySymbol}{feeBalance.totalAdjustments.toLocaleString()}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-6 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-emerald-700 font-mono font-bold block mb-1">
            Total Paid
          </span>
          <span className="text-2xl font-extrabold text-emerald-600">
            {currencySymbol}{feeBalance.totalPaid.toLocaleString()}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-900 bg-slate-900 text-white p-6 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-mono font-bold block mb-1">
            Balance Due
          </span>
          <span className="text-2xl font-extrabold text-white">
            {currencySymbol}{feeBalance.balanceRemaining.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Itemized Fee Schedule */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <h3 className="font-bold text-slate-900 text-lg mb-4">Itemized Fee Schedule</h3>
        <div className="divide-y divide-slate-100">
          {feeBalance.feeItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No fee items assigned for this term.</p>
          ) : (
            feeBalance.feeItems.map((fi) => (
              <div key={fi.id} className="py-3 flex justify-between items-center text-sm">
                <div>
                  <span className="font-semibold text-slate-900 block">{fi.name}</span>
                  <span className="text-xs text-slate-500">
                    {fi.classLevelId ? 'Class-Level Fee' : 'General School Fee'}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-900">{currencySymbol}{fi.amount.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment History & Receipts */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <h3 className="font-bold text-slate-900 text-lg mb-4">Payment Receipts &amp; History</h3>
        <div className="space-y-3">
          {feeBalance.payments.length === 0 ? (
            <p className="text-xs text-slate-500">No payment transactions recorded yet.</p>
          ) : (
            feeBalance.payments.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm mb-0.5">
                    {currencySymbol}{p.amount.toLocaleString()} — {p.method.toUpperCase()}
                  </div>
                  <div className="text-slate-500 font-mono">
                    Ref: {p.paymentRef || 'Cash / Internal Receipt'} • Date:{' '}
                    {new Date(p.paidAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Confirmed ✓
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Pay School Fees</h3>
            <p className="text-xs text-slate-500 mb-4">
              Partial payments allowed. Outstanding balance is {currencySymbol}
              {feeBalance.balanceRemaining.toLocaleString()}.
            </p>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Payment Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={feeBalance.balanceRemaining}
                  placeholder={`Max: ${currencySymbol}${feeBalance.balanceRemaining}`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInitializing}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  {isInitializing ? 'Proceeding...' : 'Proceed to Checkout →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
