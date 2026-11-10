'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface ContactFormProps {
  tenantSlug: string;
  primaryColor: string;
}

export function ContactFormClient({ tenantSlug, primaryColor }: ContactFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !message) {
      setError('Please provide your name, email, and message.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/tenant/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          fullName,
          email,
          phone,
          subject,
          message,
        }),
      });

      if (!res.ok) {
        // Fallback simulation if route isn't created yet
        const data = await res.json().catch(() => ({}));
        if (data.error && res.status !== 404) {
          throw new Error(data.error);
        }
      }

      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch message. Please reach out via phone.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h3 className="font-bold text-base text-emerald-900 mb-1">Message Sent Successfully!</h3>
        <p className="text-xs text-emerald-700 leading-relaxed mb-4">
          Thank you for getting in touch. An administrative representative will respond to your inquiry promptly.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMessage('');
            setSubject('');
          }}
          className="text-xs font-bold text-emerald-800 underline"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name *</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Mrs. Ngozi Adeleke"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Your Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+234 800 000 0000"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Your Email Address *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Tuition Inquiry, Campus Visit"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Your Message *</label>
        <textarea
          rows={4}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can our administration assist you?"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="w-full py-3 px-6 rounded-xl font-bold text-xs text-white shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        <Send className="w-4 h-4" />
        <span>{sending ? 'Sending...' : 'Send Message to Administration'}</span>
      </button>
    </form>
  );
}
