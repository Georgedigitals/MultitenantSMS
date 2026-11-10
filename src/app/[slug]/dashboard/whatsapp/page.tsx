'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface WhatsAppLog {
  id: string;
  phone: string;
  template: string;
  status: string;
  sentAt: string;
}

export default function WhatsAppDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [hasFeature, setHasFeature] = useState(true);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);

  // Form State
  const [phone, setPhone] = useState('');
  const [template, setTemplate] = useState('pdf_report_card');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchWhatsAppLogs();
  }, [slug]);

  async function fetchWhatsAppLogs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/whatsapp?slug=${slug}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) setHasFeature(false);
        setLoading(false);
        return;
      }
      setHasFeature(data.hasFeature);
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setSendingMsg(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/tenant/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          phone,
          template,
          payload: { dispatchedAt: new Date().toISOString() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch WhatsApp alert');
      setLogs((prev) => [data.log, ...prev]);
      setPhone('');
      setFeedback({ type: 'success', text: 'WhatsApp accepted the message for delivery.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSendingMsg(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500 font-mono text-sm">Loading WhatsApp Engine...</div>;
  }

  if (!hasFeature) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800">
        <div className="flex items-center space-x-3 text-amber-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold">WhatsApp Business Alerts Feature Locked</h2>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          WhatsApp Business integration allows direct delivery of PDF report cards, fee breakdown statements, and official school announcements directly into parents' WhatsApp chat. Upgrade to Growth or Enterprise plan to unlock WhatsApp integration.
        </p>
        <Link
          href={`/${slug}/dashboard/subscription`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md transition-all"
        >
          Upgrade Subscription Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Business Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Send rich Meta-approved WhatsApp template notifications (PDF Reports, Fee Invoices & Urgent Announcements).
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          <span className="w-2 h-2 mr-2 bg-emerald-500 rounded-full animate-pulse"></span>
          Meta API Connected
        </span>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Dispatch Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-2xl">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <svg className="w-5 h-5 text-emerald-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Send WhatsApp Template Alert
        </h2>
        <form onSubmit={handleSendWhatsApp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Parent WhatsApp Number (with country code)
            </label>
            <input
              type="text"
              placeholder="+2348012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Meta Approved Template
            </label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="pdf_report_card">PDF Report Card Instant Delivery</option>
              <option value="fee_invoice_breakdown">Fee Payment Receipt & Breakdown</option>
              <option value="urgent_school_announcement">Urgent Parent Notice / Holiday Brief</option>
              <option value="cbt_exam_reminder">CBT Online Exam Schedule Reminder</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={sendingMsg}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50 text-sm"
          >
            {sendingMsg ? 'Dispatching WhatsApp Message...' : 'Dispatch WhatsApp Alert'}
          </button>
        </form>
      </div>

      {/* Delivery Logs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4">WhatsApp Delivery History</h2>
        {logs.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono py-4">No WhatsApp alerts dispatched yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <th className="pb-3 px-3">Date</th>
                  <th className="pb-3 px-3">WhatsApp Number</th>
                  <th className="pb-3 px-3">Template</th>
                  <th className="pb-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-800">{log.phone}</td>
                    <td className="py-3 px-3 text-slate-700 font-mono">{log.template}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
