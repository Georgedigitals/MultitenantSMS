'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';

interface FeatureItem {
  key: string;
  name: string;
  description?: string | null;
  enabledByDefault?: boolean;
}

interface PlanItem {
  id: string;
  name: string;
  price: number;
  studentCeiling: number;
  pinRequired: boolean;
  platformFeePercent: number;
  features: FeatureItem[];
}

interface PaymentHistoryItem {
  id: string;
  action: string;
  actorName: string | null;
  details: {
    paymentRef?: string;
    provider?: string;
    amount?: number;
    planId?: string;
    activatedAt?: string;
  } | null;
  createdAt: string;
}

interface SubscriptionClientProps {
  slug: string;
  tenantId: string;
  tenantName: string;
  status: string;
  trialEndsAt: string | null;
  annualContractPrice?: number;
  subscriptionStartedAt?: string | null;
  subscriptionExpiresAt?: string | null;
  currentPlan: {
    id: string;
    name: string;
    price: number;
    studentCeiling: number;
    platformFeePercent: number;
    features: { key: string; name: string }[];
  };
  studentCount: number;
  allPlans: PlanItem[];
  paymentHistory: PaymentHistoryItem[];
  adminEmail: string;
  adminName: string;
}

export default function SubscriptionClient({
  slug,
  tenantId,
  tenantName,
  status,
  trialEndsAt,
  annualContractPrice,
  subscriptionStartedAt,
  subscriptionExpiresAt,
  currentPlan,
  studentCount,
  allPlans,
  paymentHistory,
  adminEmail,
  adminName,
}: SubscriptionClientProps) {
  const { localization: { currencySymbol } } = useLanguage();
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{ url: string; planName: string; amount: number; note: string } | null>(null);

  // Compute trial status
  const isTrial = status === 'trial';
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const now = new Date();
  const msLeft = trialEnd ? trialEnd.getTime() - now.getTime() : 0;
  const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const isTrialExpired = isTrial && daysRemaining === 0;

  // Annual contract locking & renewal window
  const contractPrice = annualContractPrice ?? currentPlan.price;
  const contractExpiry = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
  const contractMsLeft = contractExpiry ? contractExpiry.getTime() - now.getTime() : null;
  const contractDaysRemaining = contractMsLeft !== null ? Math.max(0, Math.ceil(contractMsLeft / (1000 * 60 * 60 * 24))) : null;
  const isContractExpired = contractDaysRemaining !== null && contractDaysRemaining === 0;
  const canRenew = isContractExpired || (contractDaysRemaining !== null && contractDaysRemaining <= 30);

  // Student capacity percentage
  const capacityPercent = currentPlan.studentCeiling > 0
    ? Math.min(100, Math.round((studentCount / currentPlan.studentCeiling) * 100))
    : 0;

  const handleUpgrade = async (plan: PlanItem) => {
    try {
      setUpgradingPlanId(plan.id);
      setErrorMsg(null);

      const res = await fetch('/api/platform/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: tenantName,
          slug,
          tenantId,
          adminName,
          adminEmail,
          planId: plan.id,
          amount: plan.price,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize payment gateway');
      }

      if (data.authorizationUrl) {
        setPendingCheckout({ url: data.authorizationUrl, planName: plan.name, amount: Number(data.amount), note: data.pricingNote || 'Full plan price' });
        setUpgradingPlanId(null);
      } else if (data.checkoutUrl) {
        throw new Error('The secure Paystack checkout link was not returned. Please retry.');
      } else {
        throw new Error('No checkout URL received from gateway');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment initialization failed. Please contact platform support.');
      setUpgradingPlanId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Subscription & Billing</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Manage your school&apos;s subscription tier, student capacity, and payment gateway activation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {pendingCheckout && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="upgrade-confirm-title">
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Review plan change</p>
            <h2 id="upgrade-confirm-title" className="mt-2 text-xl font-bold text-slate-900">Upgrade to {pendingCheckout.planName}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">{pendingCheckout.note}</p>
            <div className="mt-5 flex items-baseline justify-between border-y border-slate-200 py-4">
              <span className="text-sm font-medium text-slate-600">Pay today</span>
              <strong className="text-2xl text-slate-950">{currencySymbol}{pendingCheckout.amount.toLocaleString()}</strong>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Paystack will collect this amount. BMS changes your plan only after payment verification.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPendingCheckout(null)} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => window.location.assign(pendingCheckout.url)} className="rounded-lg bg-[#176b45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#125a3a]">Continue to Paystack</button>
            </div>
          </section>
        </div>
      )}

      {/* Current Status Overview Card */}
      <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Col 1: Current Tier */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Plan Tier</span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-black tracking-tight text-white">{currentPlan.name}</h2>
              <span className="text-xs font-bold text-blue-400">{currencySymbol}{contractPrice.toLocaleString()} / year</span>
            </div>
            {currentPlan.price !== contractPrice && (
              <p className="text-[11px] text-slate-400">
                Active Contract Price (Next Session Renewal: {currencySymbol}{currentPlan.price.toLocaleString()} / year)
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${status === 'active'
                    ? isContractExpired
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isTrialExpired
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
              >
                {status === 'active'
                  ? isContractExpired
                    ? 'Contract Due for Renewal'
                    : 'Active Annual Subscription'
                  : isTrialExpired
                    ? 'Trial Expired'
                    : '14-Day Free Trial'}
              </span>
            </div>
          </div>

          {/* Col 2: Trial or Renewal Status */}
          <div className="pt-4 md:pt-0 md:px-6 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Subscription Status</span>
            {isTrial ? (
              <div>
                <div className="text-xl font-black text-amber-300">
                  {daysRemaining} Day{daysRemaining === 1 ? '' : 's'} Remaining
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {trialEnd ? `Trial expires on ${trialEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Free trial active'}
                </p>
              </div>
            ) : (
              <div>
                <div className={`text-xl font-black ${isContractExpired ? 'text-amber-300' : 'text-emerald-400'}`}>
                  {contractDaysRemaining !== null ? `${contractDaysRemaining} Day${contractDaysRemaining === 1 ? '' : 's'} Remaining` : 'Annual Term Active'}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {contractExpiry
                    ? `Contract active until ${contractExpiry.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'Full institutional features enabled with priority support.'}
                </p>
              </div>
            )}
          </div>

          {/* Col 3: Student Capacity */}
          <div className="pt-4 md:pt-0 md:pl-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Student Capacity</span>
              <span className="text-xs font-bold text-white">
                {studentCount} / {currentPlan.studentCeiling > 0 ? currentPlan.studentCeiling : '∞'}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${capacityPercent > 90 ? 'bg-rose-500' : capacityPercent > 70 ? 'bg-amber-400' : 'bg-blue-500'
                  }`}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {capacityPercent}% of maximum student limit enrolled.
            </p>
          </div>
        </div>
      </div>

      {/* Available Plan Tiers Matrix (Configured by SuperAdmin) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Available Subscription Tiers</h2>
          <p className="text-xs text-slate-500 font-medium">
            Choose the best plan tier for your school size and operational requirements. Linked directly to official SuperAdmin platform rates.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">
            Upgrades to a higher paid plan within 30 days of your last paid activation charge only the price difference. After 30 days, the full term price applies. Trial plan activation is charged at the full selected plan price.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allPlans.map((plan) => {
            const isCurrent = plan.id === currentPlan.id || plan.name.toLowerCase() === currentPlan.name.toLowerCase();
            const isLowerPlan = !isCurrent && plan.price <= currentPlan.price;
            const isGrowth = plan.name.toLowerCase().includes('growth') || plan.name.toLowerCase().includes('standard');
            const isEnterprise = plan.name.toLowerCase().includes('enterprise');

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 border ${isCurrent
                    ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500 shadow-md'
                    : isGrowth
                      ? 'bg-white border-indigo-200 shadow-lg hover:shadow-xl'
                      : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
              >
                {/* Popular Badge */}
                {isGrowth && !isCurrent && (
                  <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                    Most Popular
                  </span>
                )}

                {isCurrent && (
                  <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-sm">
                    Current Plan
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Up to {plan.studentCeiling > 0 ? `${plan.studentCeiling.toLocaleString()} active students` : 'Unlimited students'}
                    </p>
                  </div>

                  <div className="py-2 border-y border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900">{currencySymbol}{plan.price.toLocaleString()}</span>
                      <span className="text-xs font-semibold text-slate-400">/ year</span>
                    </div>
                    {isCurrent && status === 'active' && (
                      <span className="text-[11px] font-medium text-emerald-700 block mt-0.5">
                        Your locked contract: {currencySymbol}{contractPrice.toLocaleString()} / year
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Platform Fee: {plan.platformFeePercent}% per scratch card PIN
                    </span>
                  </div>

                  {/* Included Features */}
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Included Modules:
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Student Directory & Academic Records</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Automated Report Cards & Result Scratch Cards</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>School Fees Billing & Financial Tracking</span>
                      </li>

                      {plan.features.map((feat) => (
                        <li key={feat.key} className="flex items-center gap-2 font-medium">
                          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{feat.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6">
                  {isCurrent && status === 'active' && !canRenew ? (
                    <button
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs cursor-default text-center"
                    >
                      Active Contract ({currencySymbol}{contractPrice.toLocaleString()} / yr)
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan)}
                      disabled={upgradingPlanId === plan.id || (!canRenew && isLowerPlan)}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 ${isCurrent
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : isEnterprise
                            ? 'bg-slate-900 hover:bg-slate-800 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                    >
                      {upgradingPlanId === plan.id ? (
                        <>
                          <svg className="animate-spin w-4 h-4 text-current" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Initializing Gateway...</span>
                        </>
                      ) : isCurrent && status === 'active' ? (
                        `Renew for Next Session (${currencySymbol}${plan.price.toLocaleString()})`
                      ) : isCurrent ? (
                        'Activate Subscription'
                      ) : (
                        isLowerPlan ? 'Lower plan unavailable' : `Upgrade to ${plan.name}`
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscription Payment & Audit History */}
      {paymentHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Subscription Billing History</h3>
            <span className="text-xs text-slate-500 font-semibold">{paymentHistory.length} Record(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Event</th>
                  <th className="py-2.5 px-4">Payment Reference</th>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Gateway</th>
                  <th className="py-2.5 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {item.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.details?.paymentRef || 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {currencySymbol}{Number(item.details?.amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 uppercase font-medium">
                      {item.details?.provider || 'Paystack'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
