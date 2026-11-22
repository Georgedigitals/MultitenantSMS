'use client';

import { useState, useEffect } from 'react';
import { ReportCardDocument } from '@/components/report-card-document';
import { useLanguage } from '@/components/language-provider';

interface TermOption {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface ResultCheckerClientProps {
  tenantSlug: string;
  tenantName: string;
  pinPrice: number;
  terms: TermOption[];
  initialStudentId: string;
  initialTermId: string;
  hasOnlinePayment?: boolean;
  hasPinStock?: boolean;
  bankDetails?: {
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  };
}

export default function ResultCheckerClient({
  tenantSlug,
  tenantName,
  pinPrice,
  terms,
  initialStudentId,
  initialTermId,
  hasOnlinePayment = true,
  hasPinStock = false,
  bankDetails,
}: ResultCheckerClientProps) {
  const { localization: { currencySymbol, locale } } = useLanguage();
  const [studentId, setStudentId] = useState(initialStudentId);
  const [termId, setTermId] = useState(initialTermId);
  const [pinCode, setPinCode] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockedReport, setUnlockedReport] = useState<any | null>(null);

  // Online PIN Issuance & Callback State
  const [issuedPinData, setIssuedPinData] = useState<{
    code: string;
    studentName?: string;
    termName?: string;
    pricePaid?: number;
    paymentRef?: string;
  } | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [bankCopied, setBankCopied] = useState(false);

  // School Fees Clearance Lock State
  const [feeBlockedData, setFeeBlockedData] = useState<{
    balanceRemaining: number;
    totalAssigned?: number;
    totalPaid?: number;
    feeBreakdown?: any[];
    bankDetails?: {
      bankName?: string | null;
      bankAccountNumber?: string | null;
      bankAccountName?: string | null;
    };
    hasOnlinePayment?: boolean;
  } | null>(null);

  // Transfer Receipt Form State
  const [transferAmount, setTransferAmount] = useState('');
  const [senderName, setSenderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofSuccess, setProofSuccess] = useState<string | null>(null);

  // Online Fee Clearance State
  const [feePaymentTab, setFeePaymentTab] = useState<'online' | 'transfer'>('online');
  const [feeOnlineEmail, setFeeOnlineEmail] = useState('');
  const [payingFeeOnline, setPayingFeeOnline] = useState(false);

  const [buyingPin, setBuyingPin] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  // Check URL on return from online checkout
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('payment') === 'success') {
        const pStudentId = params.get('studentId');
        const pTermId = params.get('termId');
        if (pStudentId) setStudentId(pStudentId);
        if (pTermId) setTermId(pTermId);
        setProofSuccess(
          '🎉 Online fee payment verified successfully! Your outstanding fee balance has been cleared. Enter your 12-digit PIN below to view the unlocked terminal report card.'
        );
      } else if (params.get('payment') === 'pin_success') {
        const pStudentId = params.get('studentId');
        const pTermId = params.get('termId');
        const pRef = params.get('ref');
        if (pStudentId) setStudentId(pStudentId);
        if (pTermId) setTermId(pTermId);

        if (pRef) {
          fetch(`/api/tenant/pins/purchase?ref=${encodeURIComponent(pRef)}`, {
            headers: { 'x-tenant-slug': tenantSlug },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.pin) {
                setIssuedPinData(data.pin);
                setPinCode(data.pin.code);
                setPurchaseSuccess(
                  `🎉 Result PIN purchased from the school’s stock and sent to your email! PIN Code: ${data.pin.code}`
                );
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [tenantSlug]);

  const handleVerifyOrRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnlockedReport(null);
    setFeeBlockedData(null);
    setLoading(true);

    try {
      // 1. Verify/Redeem PIN via API
      const res = await fetch('/api/tenant/pins/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': tenantSlug,
        },
        body: JSON.stringify({
          studentId: studentId.trim(),
          termId,
          pinCode: pinCode.trim() || undefined,
        }),
      });

      const data = await res.json();

      // Check if blocked by School Fees
      if (data.reason === 'fees_outstanding') {
        setFeeBlockedData({
          balanceRemaining: data.balanceRemaining || 0,
          totalAssigned: data.totalAssigned || 0,
          totalPaid: data.totalPaid || 0,
          feeBreakdown: data.feeBreakdown || [],
          bankDetails: data.bankDetails,
          hasOnlinePayment: data.hasOnlinePayment,
        });
        setTransferAmount(String(data.balanceRemaining || ''));
        setLoading(false);
        return;
      }

      if (!res.ok || !data.isUnlocked) {
        setError(data.error || data.reason || 'PIN check failed');
        setLoading(false);
        return;
      }

      // 2. Fetch compiled report card
      const queryParams = new URLSearchParams({
        slug: tenantSlug,
        studentId: studentId.trim(),
        termId,
      });
      if (pinCode.trim()) {
        queryParams.set('pinCode', pinCode.trim());
      }

      const reportRes = await fetch(`/api/tenant/results/report-card?${queryParams.toString()}`, {
        headers: {
          'x-tenant-slug': tenantSlug,
          ...(pinCode.trim() ? { 'x-pin-code': pinCode.trim() } : {}),
        },
      });

      const reportData = await reportRes.json();
      if (!reportRes.ok || reportData.error) {
        if (reportData.reason === 'fees_outstanding') {
          setFeeBlockedData({
            balanceRemaining: reportData.balanceRemaining || 0,
            bankDetails: reportData.bankDetails,
          });
          setTransferAmount(String(reportData.balanceRemaining || ''));
        } else {
          setError(reportData.error || 'Failed to load report card');
        }
      } else {
        setUnlockedReport(reportData);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Submit Bank Transfer Proof to Bursar
  const handleSubmitTransferProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !termId || !senderName.trim() || !bankName.trim() || !transferAmount) {
      setError('Please fill in all payment details');
      return;
    }

    try {
      setSubmittingProof(true);
      setError(null);
      let proofUrl = null;

      // Upload receipt file if provided
      if (proofFile) {
        const formData = new FormData();
        formData.append('file', proofFile);
        const uploadRes = await fetch('/api/tenant/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          proofUrl = uploadData.url;
        }
      }

      const res = await fetch(`/api/tenant/fees/verifications?slug=${tenantSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentId.trim(),
          termId,
          amount: parseFloat(transferAmount),
          senderName: senderName.trim(),
          bankName: bankName.trim(),
          transactionRef: transactionRef.trim() || undefined,
          proofUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit payment proof');

      setProofSuccess(
        'Payment receipt submitted successfully! The school bursar has been notified. Once approved, your result clearance will be unlocked immediately.'
      );
    } catch (err: any) {
      setError(err.message || 'Error submitting proof');
    } finally {
      setSubmittingProof(false);
    }
  };

  // Pay School Fees Online via Paystack
  const handlePayFeeOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !termId) {
      setError('Student ID and Term are required.');
      return;
    }
    if (!feeOnlineEmail.trim() || !feeOnlineEmail.includes('@')) {
      setError('Please provide a valid parent/customer email for receipt delivery.');
      return;
    }

    setPayingFeeOnline(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenant/fees/public-pay?slug=${tenantSlug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': tenantSlug,
        },
        body: JSON.stringify({
          studentId: studentId.trim(),
          termId,
          amount: feeBlockedData?.balanceRemaining || 0,
          customerEmail: feeOnlineEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize Paystack fee payment');
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Payment initialization error');
    } finally {
      setPayingFeeOnline(false);
    }
  };

  const handleBuyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !termId || !email.trim()) {
      setError('Student ID, Term, and Email are required to purchase a PIN.');
      return;
    }

    setBuyingPin(true);
    setError(null);
    setPurchaseSuccess(null);

    try {
      const res = await fetch('/api/tenant/pins/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': tenantSlug,
        },
        body: JSON.stringify({
          studentId: studentId.trim(),
          termId,
          customerEmail: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to initialize PIN purchase');
        return;
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setPurchaseSuccess(
        `PIN purchase initialized! Reference: ${data.paymentRef || data.data?.paymentRef}. Standard NGN ${data.pricePaid || data.data?.pricePaid} charged.`
      );
    } catch (err: any) {
      setError(err.message || 'Payment error');
    } finally {
      setBuyingPin(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. FEE CLEARANCE REQUIRED SCREEN */}
      {feeBlockedData ? (
        <div className="bg-white rounded-2xl shadow-md border border-amber-200/80 p-6 md:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="flex items-start gap-4 border-b border-amber-100 pb-5">
            <div className="p-3 rounded-2xl bg-amber-100 text-amber-800 text-2xl font-bold shrink-0">
              🔒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] uppercase tracking-wider">
                  Access Restricted
                </span>
                <span className="text-xs text-slate-400 font-mono">Reg ID: {studentId}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">School Fees Clearance Required</h2>
              <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                Even with a valid Result PIN, school policy requires that all term fees must be cleared before the terminal report card and grade broadsheet can be unlocked.
              </p>
            </div>
          </div>

          {/* Outstanding Balance Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                Outstanding Balance Due
              </span>
              <span className="text-3xl font-black text-amber-400 mt-0.5 block">
                {currencySymbol}{feeBlockedData.balanceRemaining.toLocaleString()}
              </span>
              <span className="text-xs text-slate-300 mt-0.5 block">
                Total Billed: {currencySymbol}{(feeBlockedData.totalAssigned || feeBlockedData.balanceRemaining).toLocaleString()} • Paid: {currencySymbol}{(feeBlockedData.totalPaid || 0).toLocaleString()}
              </span>
            </div>

            <button
              onClick={() => {
                setFeeBlockedData(null);
                setError(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer self-start sm:self-center"
            >
              ← Try Another PIN / ID
            </button>
          </div>

          {/* Payment Method Selector if School has Online Payment */}
          {feeBlockedData.hasOnlinePayment ? (
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setFeePaymentTab('online')}
                className={`flex-1 py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
                  feePaymentTab === 'online'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>⚡ Pay Online (Instant Result Unlock)</span>
              </button>
              <button
                type="button"
                onClick={() => setFeePaymentTab('transfer')}
                className={`flex-1 py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
                  feePaymentTab === 'transfer'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🏛️ Bank Transfer / Teller Upload</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
              <span className="font-bold">Notice:</span>
              <span>This institution collects school fees strictly via commercial bank transfer or cash payment at the bursary.</span>
            </div>
          )}

          {/* METHOD 1: PAYSTACK ONLINE FEE PAYMENT */}
          {feeBlockedData.hasOnlinePayment && feePaymentTab === 'online' && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Instant Online Fee Clearance via Paystack</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pay securely with ATM Card, USSD, or Bank Transfer. Once payment confirms, your result will unlock automatically without waiting for manual bursary approval.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handlePayFeeOnline} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Parent / Payer Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={feeOnlineEmail}
                    onChange={(e) => setFeeOnlineEmail(e.target.value)}
                    placeholder="e.g. parent@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Official Paystack e-receipt will be sent to this email address.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-mono">Amount Due for Full Clearance:</span>
                  <span className="text-lg font-black text-amber-400">{currencySymbol}{feeBlockedData.balanceRemaining.toLocaleString()}</span>
                </div>

                <button
                  type="submit"
                  disabled={payingFeeOnline}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {payingFeeOnline ? (
                    'Connecting to Paystack Gateway...'
                  ) : (
                    <>
                      <span>Pay {currencySymbol}{feeBlockedData.balanceRemaining.toLocaleString()} via Paystack &amp; Unlock Result</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* METHOD 2: COMMERCIAL BANK TRANSFER & PROOF UPLOAD */}
          {(!feeBlockedData.hasOnlinePayment || feePaymentTab === 'transfer') && (
            <div className="space-y-5">
              {/* School Bank Account Information */}
              <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-700 font-bold text-sm">🏛️ School Bank Transfer Details</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded bg-blue-200/60 text-blue-900">
                    Official Account
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Transfer your outstanding fees to the official school bank account below, then upload the transaction receipt below for rapid bursar verification.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bank Name</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                      {feeBlockedData.bankDetails?.bankName || 'Contact School Bursar'}
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Number</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-sm font-mono font-black text-blue-700">
                        {feeBlockedData.bankDetails?.bankAccountNumber || 'N/A'}
                      </span>
                      {feeBlockedData.bankDetails?.bankAccountNumber && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(feeBlockedData.bankDetails?.bankAccountNumber || '');
                            alert('Account number copied to clipboard!');
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Name</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                      {feeBlockedData.bankDetails?.bankAccountName || 'School Bursary Account'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parent Transfer Receipt Submission Form */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upload Bank Transfer Receipt for Bursar Approval</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Already made the transfer? Submit your transaction details and receipt screenshot below. The bursar will review and grant immediate clearance.
                  </p>
                </div>

            {proofSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <span>✓</span> Receipt Submitted Successfully!
                </div>
                <p>{proofSuccess}</p>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {!proofSuccess && (
              <form onSubmit={handleSubmitTransferProof} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Amount Paid (NGN) *
                    </label>
                    <input
                      type="number"
                      required
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="e.g. 45000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Sender Account Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g. Mr. John Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Bank Transferred From *
                    </label>
                    <input
                      type="text"
                      required
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. GTBank / Access / Zenith"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Transfer Ref / Session ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="e.g. 1000049281928"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Attach Bank Transfer Receipt / Screenshot
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">PNG, JPG or WebP up to 5MB.</p>
                </div>

                <button
                  type="submit"
                  disabled={submittingProof}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingProof ? 'Uploading Receipt & Notifying Bursar...' : 'Submit Receipt for Bursar Verification'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  ) : !unlockedReport ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Check Student Result</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter the student registration ID, select the term, and provide a 12-digit Result PIN code.
            </p>
          </div>

          {/* Issued PIN Success Celebration Card */}
          {issuedPinData && (
            <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  Online PIN Purchase Verified & Issued
                </span>
                <span className="text-[11px] font-mono text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                  Ref: {issuedPinData.paymentRef?.slice(-10)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                    Your 12-Digit Result PIN
                  </span>
                  <span className="font-mono text-2xl font-black text-emerald-800 tracking-wider">
                    {issuedPinData.code}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bound to student: <strong>{issuedPinData.studentName || studentId}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(issuedPinData.code);
                      setPinCopied(true);
                      setTimeout(() => setPinCopied(false), 2500);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all cursor-pointer flex items-center gap-1"
                  >
                    {pinCopied ? '✓ Copied!' : '📋 Copy PIN'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      setPinCode(issuedPinData.code);
                      handleVerifyOrRedeem(e);
                    }}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <span>{loading ? 'Checking...' : 'Unlock Result Now →'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-emerald-700 font-medium">
                ✉️ A purchase receipt and backup copy of this PIN have been dispatched to your email address.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          {purchaseSuccess && (
            <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
              {purchaseSuccess}
            </div>
          )}

          {proofSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
              <span>{proofSuccess}</span>
              <button type="button" onClick={() => setProofSuccess(null)} className="text-emerald-700 hover:text-emerald-950 font-bold ml-2">✕</button>
            </div>
          )}

          <form onSubmit={handleVerifyOrRedeem} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                School Admission Number *
              </label>
              <input
                type="text"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. APEX/2026/0001"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Academic Session & Term *
              </label>
              <select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm text-slate-900"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isCurrent ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                12-Digit Result PIN Code (Optional if already unlocked)
              </label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="e.g. 1234-5678-9012"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm tracking-widest font-mono text-slate-900"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying Result PIN...' : 'Check Result'}
              </button>
            </div>
          </form>

          {/* Result PIN Acquisition Card: Conditional Online Paystack vs Offline Scratch Card */}
          {hasOnlinePayment && hasPinStock ? (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="mb-4">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  Instant Online Purchase
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2">Don't have a Result PIN?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Buy one of the school&apos;s prepaid Result PINs through the school&apos;s Paystack checkout. Your assigned PIN will appear here and be emailed to you.
                </p>
              </div>

              <form onSubmit={handleBuyPin} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      School Admission Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. APEX/2026/0001"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">PIN will be bound specifically to this student.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Academic Term *
                    </label>
                    <select
                      value={termId}
                      onChange={(e) => setTermId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {terms.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.isCurrent ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Select the term to generate PIN for.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Parent / Guardian Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guardian@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Your 12-digit PIN code and receipt will be delivered instantly to this email address.
                  </p>
                </div>

                <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    Standard Fee: <strong className="text-slate-900 text-sm font-black">{currencySymbol}{pinPrice.toLocaleString()}</strong>
                  </div>

                  <button
                    type="submit"
                    disabled={buyingPin}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span>🔒</span>
                    <span>{buyingPin ? 'Connecting to Paystack...' : `Pay ${currencySymbol}${pinPrice.toLocaleString()} & Generate PIN`}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300">
                    Offline Physical Scratch Card
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    Standard Fee: <strong>{currencySymbol}{pinPrice.toLocaleString()}</strong>
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">How to Obtain a Result PIN (Scratch Card)</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Online card checkout is not enabled for this institution. Result PINs are issued as authentic physical scratch cards by the school bursary.
                  </p>
                </div>

                {/* School Bank Account Details */}
                <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Official School Bank Account (For Transfers):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Name</span>
                      <strong className="text-slate-900 text-xs font-bold">{bankDetails?.bankName || 'Contact School Bursar'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Number</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="font-mono text-slate-900 text-xs font-black">{bankDetails?.bankAccountNumber || 'N/A'}</strong>
                        {bankDetails?.bankAccountNumber && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(bankDetails.bankAccountNumber || '');
                              setBankCopied(true);
                              setTimeout(() => setBankCopied(false), 2000);
                            }}
                            className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                          >
                            {bankCopied ? '✓ Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Name</span>
                      <strong className="text-slate-900 text-xs font-bold">{bankDetails?.bankAccountName || tenantName}</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-amber-700">1.</span>
                    <span>Pay <strong>{currencySymbol}{pinPrice.toLocaleString()}</strong> per student at the school bursary or via direct bank transfer to the account above.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-amber-700">2.</span>
                    <span>Collect your official physical scratch card from the school bursary office.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-amber-700">3.</span>
                    <span>Gently scratch the silver panel on the back of the card to reveal your 12-digit PIN code, then enter it into the form above to view your report card.</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 print:space-y-0 print:p-0 print:m-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                Official Report Card Unlocked & Verified
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save Report Card (PDF)
              </button>

              <button
                type="button"
                onClick={() => setUnlockedReport(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                ← Check Another Result
              </button>
            </div>
          </div>

          {/* Authentic Nigerian Report Card Document */}
          <ReportCardDocument reportCard={unlockedReport.reportCard || unlockedReport} />
        </div>
      )}
    </div>
  );
}
