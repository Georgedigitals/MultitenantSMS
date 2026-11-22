'use client';

import React, { useState, useEffect } from 'react';
import { ReportCardDocument } from '@/components/report-card-document';
import { ReportCardData } from '@/lib/report-card';
import { useLanguage } from '@/components/language-provider';

interface SubjectEntry {
  id: string;
  totalScore: number;
  grade?: string;
  comment?: string;
  subject?: {
    id: string;
    name: string;
    code?: string;
  };
}

interface TermResult {
  termId: string;
  termName: string;
  sessionLabel: string;
  entries: SubjectEntry[];
  avg: string;
  count: number;
  isUnlocked: boolean;
  reportCard?: ReportCardData | null;
}

interface StudentResultData {
  student: {
    id: string;
    name: string;
  };
  currentClass: string;
  termResults: TermResult[];
  feeBalances: Array<{
    termId: string;
    termName: string;
    sessionLabel: string;
    assigned: number;
    paid: number;
    outstanding: number;
    pendingTransfer: { id: string; amount: number } | null;
  }>;
}

interface PortalResultsClientProps {
  slug: string;
  tenantName: string;
  primaryColor: string;
  isParent: boolean;
  pinRequired: boolean;
  pinPrice: number;
  pinOnlineEnabled: boolean;
  bankDetails: { bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null };
  studentsData: StudentResultData[];
  userEmail: string;
}

export default function PortalResultsClient({
  slug,
  tenantName,
  primaryColor,
  isParent,
  pinRequired,
  pinPrice,
  pinOnlineEnabled,
  bankDetails,
  studentsData,
  userEmail,
}: PortalResultsClientProps) {
  const { localization: { currencySymbol, locale } } = useLanguage();
  // Unlocked terms state map: key `${studentId}_${termId}` -> boolean
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const sd of studentsData) {
      for (const tr of sd.termResults) {
        if (tr.isUnlocked) {
          initial[`${sd.student.id}_${tr.termId}`] = true;
        }
      }
    }
    return initial;
  });

  // Report cards cache map: key `${studentId}_${termId}` -> ReportCardData
  const [reportCardsMap, setReportCardsMap] = useState<Record<string, ReportCardData | null>>(() => {
    const initial: Record<string, ReportCardData | null> = {};
    for (const sd of studentsData) {
      for (const tr of sd.termResults) {
        if (tr.reportCard) {
          initial[`${sd.student.id}_${tr.termId}`] = tr.reportCard;
        }
      }
    }
    return initial;
  });

  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [successMap, setSuccessMap] = useState<Record<string, string>>({});
  const [pinTransferMap, setPinTransferMap] = useState<Record<string, { status: string; resultPin?: { code: string; expiresAt: string } | null; generatedPin?: { pinCode: string; serialNumber: string } | null }>>({});
  const [transferFormKey, setTransferFormKey] = useState<string | null>(null);
  const [transferFields, setTransferFields] = useState({ senderName: '', bankName: '', transactionRef: '' });
  const [feeTransferKey, setFeeTransferKey] = useState<string | null>(null);
  const [feeTransferStatus, setFeeTransferStatus] = useState<Record<string, string>>({});
  const [feeTransferFields, setFeeTransferFields] = useState({ senderName: '', bankName: '', transactionRef: '' });

  useEffect(() => {
    fetch(`/api/tenant/pins/verifications?slug=${encodeURIComponent(slug)}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        const records = data?.verifications || [];
        const mapped: typeof pinTransferMap = {};
        for (const record of records) mapped[`${record.studentId}_${record.termId}`] = record;
        setPinTransferMap(mapped);
      })
      .catch(() => {});
  }, [slug]);

  // Fetch report cards for any unlocked terms that don't have it yet
  useEffect(() => {
    for (const sd of studentsData) {
      for (const tr of sd.termResults) {
        const key = `${sd.student.id}_${tr.termId}`;
        if (unlockedMap[key] && !reportCardsMap[key]) {
          fetch(
            `/api/tenant/results/report-card?slug=${slug}&studentId=${encodeURIComponent(
              sd.student.id
            )}&termId=${encodeURIComponent(tr.termId)}`
          )
            .then((res) => res.json())
            .then((data) => {
              if (data.reportCard) {
                setReportCardsMap((prev) => ({ ...prev, [key]: data.reportCard }));
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [unlockedMap, slug, studentsData]);

  const handleVerifyPin = async (studentId: string, termId: string, e: React.FormEvent) => {
    e.preventDefault();
    const key = `${studentId}_${termId}`;
    const code = (pinInputs[key] || '').trim();

    if (!code) {
      setErrorMap((prev) => ({ ...prev, [key]: 'Please enter a 12-digit PIN code.' }));
      return;
    }

    setLoadingMap((prev) => ({ ...prev, [key]: true }));
    setErrorMap((prev) => ({ ...prev, [key]: '' }));
    setSuccessMap((prev) => ({ ...prev, [key]: '' }));

    try {
      const res = await fetch(`/api/tenant/pins/verify?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          termId,
          pinCode: code,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.isUnlocked) {
        setErrorMap((prev) => ({ ...prev, [key]: data.error || data.reason || 'Invalid PIN code.' }));
      } else {
        setUnlockedMap((prev) => ({ ...prev, [key]: true }));
        setSuccessMap((prev) => ({ ...prev, [key]: 'PIN verified successfully! Result unlocked.' }));

        // Dynamically fetch full authentic Nigerian Report Card
        try {
          const rcRes = await fetch(
            `/api/tenant/results/report-card?slug=${slug}&studentId=${encodeURIComponent(
              studentId
            )}&termId=${encodeURIComponent(termId)}`
          );
          const rcData = await rcRes.json();
          if (rcData.reportCard) {
            setReportCardsMap((prev) => ({ ...prev, [key]: rcData.reportCard }));
          }
        } catch (fetchErr) {
          console.warn('[Fetch Report Card Error]', fetchErr);
        }
      }
    } catch (err: any) {
      setErrorMap((prev) => ({ ...prev, [key]: err.message || 'Network error' }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleBuyPin = async (studentId: string, termId: string) => {
    const key = `${studentId}_${termId}`;
    if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())) {
      setErrorMap((prev) => ({ ...prev, [key]: 'Add a valid email to your parent account before buying a Result PIN.' }));
      return;
    }
    setLoadingMap((prev) => ({ ...prev, [key]: true }));
    setErrorMap((prev) => ({ ...prev, [key]: '' }));

    try {
      const res = await fetch(`/api/tenant/pins/purchase?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          termId,
          customerEmail: userEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMap((prev) => ({ ...prev, [key]: data.error || 'Failed to initialize PIN purchase.' }));
      } else if (data.authorizationUrl) {
        window.location.assign(data.authorizationUrl);
      } else {
        throw new Error('Payment checkout could not be opened. Please try again.');
      }
    } catch (err: any) {
      setErrorMap((prev) => ({ ...prev, [key]: err.message || 'Payment error' }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const submitPinTransfer = async (studentId: string, termId: string) => {
    const key = `${studentId}_${termId}`;
    if (!transferFields.senderName.trim() || !transferFields.bankName.trim() || !transferFields.transactionRef.trim()) {
      setErrorMap((prev) => ({ ...prev, [key]: 'Enter the sender name, sending bank, and bank transaction reference.' }));
      return;
    }
    setLoadingMap((prev) => ({ ...prev, [key]: true }));
    setErrorMap((prev) => ({ ...prev, [key]: '' }));
    try {
      const response = await fetch(`/api/tenant/pins/verifications?slug=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, termId, ...transferFields }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit transfer details.');
      setPinTransferMap((previous) => ({ ...previous, [key]: { status: 'pending' } }));
      setTransferFormKey(null);
      setTransferFields({ senderName: '', bankName: '', transactionRef: '' });
      setSuccessMap((previous) => ({ ...previous, [key]: 'Transfer submitted. The PIN will appear here after the school confirms it in its bank account.' }));
    } catch (error) {
      setErrorMap((previous) => ({ ...previous, [key]: error instanceof Error ? error.message : 'Could not submit transfer details.' }));
    } finally {
      setLoadingMap((previous) => ({ ...previous, [key]: false }));
    }
  };

  const submitFeeTransfer = async (studentId: string, termId: string, amount: number) => {
    const key = `${studentId}_${termId}`;
    if (!feeTransferFields.senderName.trim() || !feeTransferFields.bankName.trim() || !feeTransferFields.transactionRef.trim()) {
      setFeeTransferStatus((previous) => ({ ...previous, [key]: 'Enter the sender name, sending bank, and bank transaction reference.' }));
      return;
    }
    setLoadingMap((previous) => ({ ...previous, [key]: true }));
    try {
      const response = await fetch(`/api/tenant/fees/verifications?slug=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, termId, amount, ...feeTransferFields }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit transfer details.');
      setFeeTransferStatus((previous) => ({ ...previous, [key]: 'Transfer submitted. The bursar will verify it against the school account.' }));
      setFeeTransferKey(null);
      setFeeTransferFields({ senderName: '', bankName: '', transactionRef: '' });
    } catch (error) {
      setFeeTransferStatus((previous) => ({ ...previous, [key]: error instanceof Error ? error.message : 'Could not submit transfer details.' }));
    } finally {
      setLoadingMap((previous) => ({ ...previous, [key]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Academic Results</h1>
        <p className="text-sm text-slate-500 mt-1">
          Published term report cards and subject scores for {tenantName}.
        </p>
      </div>

      {bankDetails.bankAccountNumber && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">School bank transfer details</h2>
          <p className="mt-1 text-xs text-slate-600">Use these details only after confirming the amount and payment reference with the school. A transfer is not marked as paid until the bursar verifies it.</p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div><span className="block text-[10px] font-semibold uppercase text-slate-500">Bank</span><span className="font-semibold text-slate-900">{bankDetails.bankName || '—'}</span></div>
            <div><span className="block text-[10px] font-semibold uppercase text-slate-500">Account number</span><span className="font-mono font-semibold text-slate-900">{bankDetails.bankAccountNumber}</span></div>
            <div><span className="block text-[10px] font-semibold uppercase text-slate-500">Account name</span><span className="font-semibold text-slate-900">{bankDetails.bankAccountName || tenantName}</span></div>
          </div>
        </section>
      )}

      {bankDetails.bankAccountNumber && studentsData.some((student) => student.feeBalances?.length) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">School fees and transfer reporting</h2>
          <p className="mt-1 text-xs text-slate-600">Balances are based on fees recorded by the school. Bank transfers stay pending until the bursar checks the bank statement.</p>
          <div className="mt-4 space-y-4">
            {studentsData.flatMap((student) => (student.feeBalances || []).map((fee) => {
              const key = `${student.student.id}_${fee.termId}`;
              const pending = Boolean(fee.pendingTransfer) || Boolean(feeTransferStatus[key]?.startsWith('Transfer submitted'));
              return <div key={key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold text-slate-900">{student.student.name} · {fee.sessionLabel} {fee.termName}</p><p className="mt-1 text-xs text-slate-600">Assigned {currencySymbol}{fee.assigned.toLocaleString()} · Paid {currencySymbol}{fee.paid.toLocaleString()} · Outstanding <strong>{currencySymbol}{fee.outstanding.toLocaleString()}</strong></p></div>
                  {pending ? <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900">Transfer pending review</span> : fee.outstanding > 0 ? <button type="button" onClick={() => setFeeTransferKey(feeTransferKey === key ? null : key)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">{feeTransferKey === key ? 'Cancel' : 'Report a bank transfer'}</button> : <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-900">Paid in full</span>}
                </div>
                {feeTransferKey === key && !pending && <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <input aria-label="Fee transfer sender name" placeholder="Name on transfer" value={feeTransferFields.senderName} onChange={(event) => setFeeTransferFields({ ...feeTransferFields, senderName: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900" />
                  <input aria-label="Fee transfer sending bank" placeholder="Your bank" value={feeTransferFields.bankName} onChange={(event) => setFeeTransferFields({ ...feeTransferFields, bankName: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900" />
                  <input aria-label="Fee transfer transaction reference" placeholder="Bank transaction reference" value={feeTransferFields.transactionRef} onChange={(event) => setFeeTransferFields({ ...feeTransferFields, transactionRef: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900" />
                  <button type="button" disabled={loadingMap[key]} onClick={() => submitFeeTransfer(student.student.id, fee.termId, fee.outstanding)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{loadingMap[key] ? 'Submitting…' : `Report ${currencySymbol}${fee.outstanding.toLocaleString()}`}</button>
                </div>}
                {feeTransferStatus[key] && <p className="mt-2 text-xs text-slate-700">{feeTransferStatus[key]}</p>}
              </div>;
            }))}
          </div>
        </section>
      )}

      {studentsData.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="font-bold text-slate-700">No Published Results Yet</p>
          <p className="text-sm text-slate-500 mt-1">Results will appear here after the school publishes each term's report.</p>
        </div>
      ) : (
        studentsData.map((sd) => (
          <div key={sd.student.id} className="space-y-4">
            {isParent && (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-lg shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {sd.student.name.charAt(0)}
                </div>
                <div>
                  <p className="font-black text-slate-900 text-base">{sd.student.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{sd.currentClass}</p>
                </div>
              </div>
            )}

            {sd.termResults.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
                <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-semibold text-slate-600 text-sm">No published results for {sd.student.name} yet.</p>
              </div>
            ) : (
              sd.termResults.map((tr) => {
                const key = `${sd.student.id}_${tr.termId}`;
                const isUnlocked = unlockedMap[key];
                const loading = loadingMap[key];
                const error = errorMap[key];
                const success = successMap[key];

                return (
                  <div key={tr.termId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-150">
                    {/* Term header */}
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                      <div>
                        <p className="font-black text-slate-900 text-sm">{tr.termName}</p>
                        <p className="text-xs text-slate-500">{tr.sessionLabel} • {sd.currentClass}</p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        {isUnlocked ? (
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Average</p>
                            <p
                              className="text-xl font-black"
                              style={{ color: parseFloat(tr.avg) >= 50 ? '#16a34a' : '#dc2626' }}
                            >
                              {tr.avg}%
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                            <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            PIN Required
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unlocked view: Authentic Nigerian Report Card Document */}
                    {isUnlocked ? (
                      <div className="p-4 sm:p-6 bg-slate-100/70 border-t border-slate-200 space-y-4 print:p-0 print:m-0 print:border-none print:bg-white print:space-y-0">
                        {reportCardsMap[key] ? (
                          <>
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs print:hidden">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold text-emerald-800">
                                  Official Terminal Performance Report Card
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print / Save Report Card (PDF)
                              </button>
                            </div>

                            <ReportCardDocument reportCard={reportCardsMap[key]!} />
                          </>
                        ) : (
                          <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                            <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                            <p className="text-xs font-semibold text-slate-600">Loading Official Report Card Document...</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Locked view: PIN input form */
                      <div className="p-6 bg-slate-50/50 space-y-4">
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-xs">
                          <svg className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          <div>
                            <p className="font-bold text-sm">Result PIN Lock Active</p>
                            <p className="mt-0.5 text-amber-800">
                              A valid 12-digit Result PIN is required to unlock and view {sd.student.name}'s detailed report card for {tr.termName}.
                            </p>
                          </div>
                        </div>

                        {error && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                            {error}
                          </div>
                        )}

                        {success && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                            {success}
                          </div>
                        )}

                        <form onSubmit={(e) => handleVerifyPin(sd.student.id, tr.termId, e)} className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                              Enter 12-Digit Result PIN Code
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={pinInputs[key] || ''}
                                onChange={(e) => setPinInputs({ ...pinInputs, [key]: e.target.value })}
                                placeholder="XXXX-XXXX-XXXX"
                                maxLength={14}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 font-mono tracking-widest text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-slate-900"
                              />
                              <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                              >
                                {loading ? 'Verifying...' : 'Unlock Result'}
                              </button>
                            </div>
                          </div>
                        </form>

                        {/* Buy PIN Online option */}
                        {pinPrice > 0 && pinOnlineEnabled && (
                          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold text-slate-700">Don't have a PIN?</p>
                              <p className="text-[11px] text-slate-500">Purchase a Result PIN instantly online for {currencySymbol}{pinPrice.toLocaleString()}.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleBuyPin(sd.student.id, tr.termId)}
                              disabled={loading}
                              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              Buy PIN Online ({currencySymbol}{pinPrice.toLocaleString()})
                            </button>
                          </div>
                        )}
                        {bankDetails.bankAccountNumber && (
                          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800">Pay by bank transfer</p>
                                <p className="text-[11px] text-slate-600">Send {currencySymbol}{pinPrice.toLocaleString()} to the school account above. The school must confirm the payment before a PIN is issued.</p>
                              </div>
                              {pinTransferMap[key] ? (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900">Transfer {pinTransferMap[key].status}</span>
                              ) : (
                                <button type="button" onClick={() => { setTransferFormKey(transferFormKey === key ? null : key); setErrorMap((previous) => ({ ...previous, [key]: '' })); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                                  {transferFormKey === key ? 'Cancel' : 'I have transferred'}
                                </button>
                              )}
                            </div>
                            {(pinTransferMap[key]?.generatedPin?.pinCode || pinTransferMap[key]?.resultPin?.code) && (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                                <span className="font-semibold">Your Result PIN: </span><code className="font-mono font-bold">{pinTransferMap[key].generatedPin?.pinCode || pinTransferMap[key].resultPin?.code}</code>
                              </div>
                            )}
                            {transferFormKey === key && !pinTransferMap[key] && (
                              <div className="grid gap-2 sm:grid-cols-3">
                                <input aria-label="Account sender name" placeholder="Name on transfer" value={transferFields.senderName} onChange={(event) => setTransferFields({ ...transferFields, senderName: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900" />
                                <input aria-label="Sending bank" placeholder="Your bank" value={transferFields.bankName} onChange={(event) => setTransferFields({ ...transferFields, bankName: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900" />
                                <input aria-label="Transfer reference" placeholder="Bank transaction reference" value={transferFields.transactionRef} onChange={(event) => setTransferFields({ ...transferFields, transactionRef: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900" />
                                <button type="button" disabled={loading} onClick={() => submitPinTransfer(sd.student.id, tr.termId)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 sm:col-span-3">{loading ? 'Submitting…' : 'Submit transfer for verification'}</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800">
        <strong>Note:</strong> Results displayed here are official records reviewed and published by {tenantName}. Contact the school administration if you experience any difficulties verifying your Result PIN.
      </div>
    </div>
  );
}
