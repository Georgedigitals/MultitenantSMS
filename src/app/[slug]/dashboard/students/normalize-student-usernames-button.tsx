'use client';

import React, { useState } from 'react';

export default function NormalizeStudentUsernamesButton({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const normalize = async () => {
    if (!window.confirm('Update existing student portal usernames to their admission numbers? Existing passwords will be preserved.')) return;
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      const response = await fetch('/api/tenant/students/normalize-usernames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update student login names');
      setMessage(data.message);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'Could not update student login names');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={normalize} disabled={busy} className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {busy ? 'Updating login names…' : 'Fix Existing Student Logins'}
      </button>
      {message && <p role="status" className={`max-w-sm text-right text-[11px] ${error ? 'text-red-700' : 'text-emerald-700'}`}>{message}</p>}
    </div>
  );
}
