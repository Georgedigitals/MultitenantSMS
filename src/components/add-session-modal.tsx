'use client';

import React, { useState } from 'react';

interface AddSessionModalProps {
  slug: string;
  onSessionCreated?: (newSession: { id: string; label: string; isCurrent: boolean }) => void;
  triggerButtonText?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AddSessionModal({
  slug,
  onSessionCreated,
  triggerButtonText = '+ Add Academic Session',
  className,
  style,
}: AddSessionModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute suggested dates for next academic session
  const currentYear = new Date().getFullYear();
  const [label, setLabel] = useState(`${currentYear}/${currentYear + 1}`);
  const [startDate, setStartDate] = useState(`${currentYear}-09-01`);
  const [endDate, setEndDate] = useState(`${currentYear + 1}-07-31`);
  const [isCurrent, setIsCurrent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenant/sessions?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          startDate,
          endDate,
          isCurrent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create academic session');
      }

      setIsOpen(false);
      if (onSessionCreated && data.session) {
        onSessionCreated(data.session);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={style}
        className={
          className ||
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold shadow-2xs transition-colors cursor-pointer'
        }
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {triggerButtonText}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add Academic Session</h3>
                <p className="text-xs text-slate-500">Configure a new academic year for promotions and enrollment</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Session Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2025/2026"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Format: YYYY/YYYY (e.g. 2025/2026)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Automatic Setup:</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  ✓ Standard <strong>1st Term</strong>, <strong>2nd Term</strong>, and <strong>3rd Term</strong> will be initialized automatically. Set each term’s actual school days in Settings before generating report cards.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Set as current active session for school operations
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating Session...' : 'Create Academic Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
