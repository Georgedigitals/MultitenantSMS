'use client';

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface InlineCallbackFormProps {
  slug: string;
  levels: Array<{ name: string }>;
  primaryColor: string;
  textOnPrimary?: string;
}

export function InlineCallbackForm({
  slug,
  levels,
  primaryColor,
  textOnPrimary = '#FFFFFF',
}: InlineCallbackFormProps) {
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [classInterest, setClassInterest] = useState(levels[0]?.name || 'Early Years & Nursery');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/tenant/admissions/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          studentName: `${parentName.trim()} (Callback Request)`,
          parentName: parentName.trim(),
          parentEmail: `${slug}-callback@inquiry.local`,
          parentPhone: phone.trim(),
          targetClass: classInterest,
          notes: `Requested an admissions callback for ${classInterest}.`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not submit request.');
      }
      setSubmitted(true);
      setParentName('');
      setPhone('');
    } catch (err: any) {
      setError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl bg-white p-6 text-[#171614] shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="w-5 h-5" />
          <h3 className="text-base font-semibold">Callback request received</h3>
        </div>
        <p className="text-xs leading-5 text-[#5c5952]">
          Thank you! Our admissions team has received your details and will reach out shortly.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-xs font-semibold underline cursor-pointer"
          style={{ color: primaryColor }}
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 text-[#171614] shadow-lg space-y-3.5">
      <h3 className="text-base font-semibold tracking-[-0.01em]">Request a call back</h3>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div>
        <label className="block text-[11px] font-medium text-[#5c5952] mb-1">Parent&apos;s name</label>
        <input
          type="text"
          required
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          placeholder="Your full name"
          className="w-full h-10 rounded-lg border border-[#dedbd2] bg-[#faf9f6] px-3 text-xs text-[#171614] focus:outline-none focus:border-[#171614]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-[#5c5952] mb-1">Phone number</label>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone or WhatsApp number"
          className="w-full h-10 rounded-lg border border-[#dedbd2] bg-[#faf9f6] px-3 text-xs text-[#171614] focus:outline-none focus:border-[#171614]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-[#5c5952] mb-1">Class of interest</label>
        <select
          value={classInterest}
          onChange={(e) => setClassInterest(e.target.value)}
          className="w-full h-10 rounded-lg border border-[#dedbd2] bg-[#faf9f6] px-3 text-xs text-[#171614] focus:outline-none focus:border-[#171614]"
        >
          {(levels.length > 0 ? levels : [{ name: 'Early Years & Nursery' }, { name: 'Primary School' }, { name: 'Secondary School' }]).map(
            (lvl) => (
              <option key={lvl.name} value={lvl.name}>
                {lvl.name}
              </option>
            )
          )}
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full h-10 rounded-full text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        style={{ backgroundColor: primaryColor, color: textOnPrimary }}
      >
        {submitting ? 'Sending...' : 'Send my request'}
      </button>
    </form>
  );
}
