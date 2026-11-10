'use client';

import React, { useState } from 'react';
import { KeyRound, Copy, Check, AlertCircle, X, ShieldAlert } from 'lucide-react';

interface ResetStudentPinModalProps {
  slug: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string | null;
}

export function ResetStudentPinModal({
  slug,
  studentId,
  studentName,
  admissionNumber,
}: ResetStudentPinModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    temporaryPin: string;
    username: string;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOpen = () => {
    setError(null);
    setResult(null);
    setCopied(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (!loading) {
      setIsOpen(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tenant/students/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, studentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset student PIN');
      }

      setResult({
        temporaryPin: data.temporaryPin,
        username: data.username,
        message: data.message,
      });
    } catch (err: any) {
      setError(err?.message || 'An error occurred while resetting the PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.temporaryPin) {
      navigator.clipboard.writeText(result.temporaryPin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        type="button"
        title={`Reset login PIN for ${studentName}`}
        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-200"
      >
        <KeyRound className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Reset Student PIN</h3>
                  <p className="text-2xs text-slate-500">Classroom & Exam Hall Credential Recovery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!result ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                    <p className="font-bold text-slate-900">{studentName}</p>
                    <p className="text-2xs text-slate-500">
                      Admission Number: <span className="font-mono font-semibold">{admissionNumber || 'Auto-generated'}</span>
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    This will immediately generate a fresh <strong>6-digit numeric PIN</strong> and update the student&apos;s login. Previous passwords will be invalidated.
                  </p>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-2xs flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Ideal for emergency situations when a student forgets their password in the computer lab or during CBT examinations.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <p className="text-2xs font-bold uppercase tracking-wider text-emerald-800">
                      New Temporary Login PIN
                    </p>
                    <div className="text-3xl font-black font-mono tracking-widest text-emerald-950 py-1">
                      {result.temporaryPin}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-bold shadow-2xs hover:bg-emerald-100 transition"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy 6-Digit PIN</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p>
                      <strong>Username:</strong> <span className="font-mono text-slate-900">{result.username}</span>
                    </p>
                    <p className="text-2xs text-slate-500 leading-relaxed">
                      Give this PIN to {studentName}. They can sign in immediately to take CBT tests or view results, and can choose a private password under <em>Profile &amp; Security</em>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              {!result ? (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition disabled:opacity-50"
                  >
                    {loading ? 'Generating...' : 'Confirm & Generate PIN'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

