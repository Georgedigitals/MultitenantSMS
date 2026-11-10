'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface SmsConfig {
  id: string;
  provider: string;
  apiKey?: string;
  senderId: string;
  autoResultAlert: boolean;
  autoFeeAlert: boolean;
  autoAbsentAlert: boolean;
}

interface SmsLog {
  id: string;
  phone: string;
  message: string;
  status: string;
  sentAt: string;
}

interface ClassLevelOption {
  id: string;
  name: string;
}

interface TermOption {
  id: string;
  name: string;
  session?: { label: string };
}

export default function SmsDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [hasFeature, setHasFeature] = useState(true);
  const [config, setConfig] = useState<SmsConfig | null>(null);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [classes, setClasses] = useState<ClassLevelOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);

  // Config Form State
  const [provider, setProvider] = useState('termii');
  const [apiKey, setApiKey] = useState('');
  const [inquiriesPhone, setInquiriesPhone] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [senderId, setSenderId] = useState('SchoolBMS');
  const [autoResultAlert, setAutoResultAlert] = useState(true);
  const [autoFeeAlert, setAutoFeeAlert] = useState(true);
  const [autoAbsentAlert, setAutoAbsentAlert] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Quick Broadcast Form State
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  // Result SMS Broadcast Form State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [broadcastingResults, setBroadcastingResults] = useState(false);

  // Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!slug || slug === 'undefined') return;
    fetchSmsData();
  }, [slug]);

  async function fetchSmsData() {
    if (!slug || slug === 'undefined') return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/sms?slug=${encodeURIComponent(slug)}`);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        if (res.status === 403) setHasFeature(false);
        setLoading(false);
        return;
      }
      setHasFeature(data.hasFeature);
      if (data.inquiriesPhone) {
        setInquiriesPhone(data.inquiriesPhone);
      }
      if (data.config) {
        setConfig(data.config);
        const prov = data.config.provider || 'termii';
        setProvider(prov);
        setSenderId(data.config.senderId || 'SchoolBMS');
        setAutoResultAlert(data.config.autoResultAlert ?? true);
        setAutoFeeAlert(data.config.autoFeeAlert ?? true);
        setAutoAbsentAlert(data.config.autoAbsentAlert ?? false);

        if (prov === 'twilio' && data.config.apiKey) {
          const parts = data.config.apiKey.split(/[:|, \r\n]+/).map((s: string) => s.trim()).filter(Boolean);
          setTwilioAccountSid(parts[0] || '');
          setTwilioAuthToken(parts[1] || '');
          setApiKey('');
        } else {
          setApiKey(data.config.apiKey || '');
          setTwilioAccountSid('');
          setTwilioAuthToken('');
        }
      }
      setLogs(data.logs || []);
      if (data.classes) {
        setClasses(data.classes);
        if (data.classes.length > 0 && !selectedClassId) {
          setSelectedClassId(data.classes[0].id);
        }
      }
      if (data.terms) {
        setTerms(data.terms);
        if (data.terms.length > 0 && !selectedTermId) {
          setSelectedTermId(data.terms[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    setFeedback(null);
    try {
      let effectiveApiKey = apiKey.trim();
      if (provider === 'twilio') {
        if (!twilioAccountSid.trim() || !twilioAuthToken.trim()) {
          throw new Error('Please provide both Twilio Account SID and Auth Token.');
        }
        effectiveApiKey = `${twilioAccountSid.trim()}:${twilioAuthToken.trim()}`;
      }

      const res = await fetch('/api/tenant/sms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          provider,
          apiKey: effectiveApiKey,
          inquiriesPhone: inquiriesPhone.trim(),
          senderId: senderId.trim(),
          autoResultAlert,
          autoFeeAlert,
          autoAbsentAlert,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');
      setConfig(data.config);
      setFeedback({ type: 'success', text: 'SMS Gateway settings updated successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    const recipientList = phone
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (recipientList.length === 0 || !message.trim()) {
      setFeedback({ type: 'error', text: 'Please provide at least one valid recipient phone number and message.' });
      return;
    }

    setSendingSms(true);
    setFeedback(null);
    try {
      const payload = recipientList.length > 1
        ? { slug, recipients: recipientList, message: message.trim() }
        : { slug, phone: recipientList[0], message: message.trim() };

      const res = await fetch('/api/tenant/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        fetchSmsData();
        throw new Error(data.error || 'Failed to dispatch SMS');
      }

      setFeedback({
        type: 'success',
        text: data.queued
          ? `Queued bulk SMS broadcast to ${recipientList.length} recipients in background task. Check logs below for progress.`
          : `SMS dispatched successfully via ${provider.toUpperCase()} Gateway!`,
      });
      setPhone('');
      setMessage('');
      fetchSmsData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSendingSms(false);
    }
  }

  async function handleBroadcastClassResults(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClassId || !selectedTermId) {
      setFeedback({ type: 'error', text: 'Please select both a class and a term.' });
      return;
    }

    setBroadcastingResults(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/tenant/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          action: 'broadcast_results',
          classLevelId: selectedClassId,
          termId: selectedTermId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        fetchSmsData();
        throw new Error(data.error || 'Failed to broadcast result alerts');
      }

      setFeedback({
        type: 'success',
        text: data.message || 'Result notification SMS alerts dispatched to class parents!',
      });
      fetchSmsData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBroadcastingResults(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500 font-mono text-sm">Loading SMS Alerts Engine...</div>;
  }

  if (!hasFeature) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800">
        <div className="flex items-center space-x-3 text-amber-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold">SMS Alerts Feature Locked</h2>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          The Automated SMS Alerts Engine is an enterprise feature designed to send instant SMS receipts, result notifications, and emergency broadcasts. Upgrade your subscription plan to enable SMS dispatch.
        </p>
        <Link
          href={`/${slug}/dashboard/subscription`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm shadow-md transition-all"
        >
          Upgrade Subscription Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">SMS Alerts & Broadcast Engine</h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch Termii/Twilio SMS notifications for published report cards, fee payments, and custom broadcasts to parents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <span className="w-2 h-2 mr-2 bg-emerald-500 rounded-full animate-pulse"></span>
            {provider === 'termii' ? 'Termii Gateway Ready' : 'Twilio Gateway Ready'}
          </span>
          <button
            onClick={() => fetchSmsData()}
            className="p-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold"
            title="Refresh Logs"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs underline font-bold ml-3">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Tools Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: Quick SMS Broadcast */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Quick SMS Broadcast
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Sender: <strong>{senderId}</strong>
            </span>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Recipient Phone Number(s) *
                </label>
                <span className="text-[10px] text-slate-400">Comma or line separated for bulk</span>
              </div>
              <textarea
                rows={2}
                placeholder="08031234567, 08098765432 (or one number per line)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Single recipient sends immediately; multiple numbers are dispatched via background queue.
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Message Body *
                </label>
                <span className={`text-[10px] font-mono ${message.length > 160 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                  {message.length} / 160 chars {message.length > 160 ? '(2 SMS units)' : '(1 SMS unit)'}
                </span>
              </div>
              <textarea
                rows={4}
                placeholder="Type notice or announcement to parent..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={320}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Mobile Preview Bubble */}
            {message && (
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Parent SMS Preview ({senderId})
                </span>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800 shadow-2xs font-sans">
                  {message}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sendingSms}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50 text-xs cursor-pointer"
            >
              {sendingSms
                ? 'Dispatching SMS...'
                : phone.includes(',') || phone.includes('\n') || phone.includes(';')
                ? 'Queue Bulk SMS Broadcast'
                : 'Dispatch Instant SMS'}
            </button>
          </form>
        </div>

        {/* Card 2: Term Result SMS Broadcast Tool */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Broadcast Class Result SMS Alerts
            </h2>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
              Bulk Result Alert
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Dispatch automated terminal performance reports directly to all parents in a selected class. Each parent receives their child's specific average score, class position, and result check link.
          </p>

          <form onSubmit={handleBroadcastClassResults} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Class Level *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Academic Term *
                </label>
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                >
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.session?.label ? `${t.session.label} - ` : ''}{t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Template Preview */}
            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                  Personalized SMS Template Sent to Each Parent:
                </span>
                <span className="text-[10px] bg-indigo-200/60 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                  100% Dynamic Per Student
                </span>
              </div>
              <p className="text-[11px] text-indigo-950 font-mono bg-white p-2.5 rounded-lg border border-indigo-200 leading-relaxed shadow-2xs">
                Dear Parent, [Term Name] result for [Child Name] at [School Name] is out! Avg: [Dynamic Avg]%. Pos: [Dynamic Rank]/[Total in Class]. Check online: /{slug}/results/check.{inquiriesPhone ? ` Call: ${inquiriesPhone}` : ' Call: [School Helpline]'}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] text-slate-600">
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono text-indigo-700 font-bold">[Child Name] = Matched per student</span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono text-emerald-700 font-bold">[Dynamic Avg] = Real student average %</span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono text-amber-700 font-bold">[Dynamic Rank] = Real class rank (e.g. 2nd/45)</span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono text-purple-700 font-bold">Call Helpline = Dialable by touchlight phones</span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono text-blue-700 font-bold">Recipient Phone = Student&apos;s registered parent</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={broadcastingResults}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50 text-xs cursor-pointer"
            >
              {broadcastingResults
                ? 'Processing & Dispatching Class Result SMS...'
                : 'Send Result SMS Alerts to Class Parents'}
            </button>
          </form>
        </div>
      </div>

      {/* Gateway Configuration & Automation Settings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center">
            <svg className="w-5 h-5 text-slate-700 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {provider === 'termii' ? 'Termii Gateway Integration & Auto-Alert Rules' : 'Twilio Global SMS Integration & Auto-Alert Rules'}
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            Endpoint: <code className="font-mono text-slate-700">{provider === 'termii' ? 'api.ng.termii.com' : 'api.twilio.com'}</code>
          </span>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                SMS Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
              >
                <option value="termii">Termii SMS API (Nigeria Standard)</option>
                <option value="twilio">Twilio Global SMS</option>
              </select>
            </div>

            {provider === 'termii' ? (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Registered Sender ID
                    </label>
                    <span className="text-[10px] text-slate-400">Max 11 chars</span>
                  </div>
                  <input
                    type="text"
                    maxLength={11}
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    placeholder="e.g. BowenColl"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      School Helpline / Callback
                    </label>
                    <span className="text-[10px] text-slate-400">Touchlight Dialable</span>
                  </div>
                  <input
                    type="text"
                    value={inquiriesPhone}
                    onChange={(e) => setInquiriesPhone(e.target.value)}
                    placeholder="e.g. 08031234567"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Termii API Key (Optional)
                    </label>
                    <span className="text-[10px] text-slate-400">Blank = Platform Master Gateway</span>
                  </div>
                  <input
                    type="password"
                    placeholder="Leave blank to use Platform Master Termii Gateway"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Twilio From / Sender *
                    </label>
                    <span className="text-[10px] text-slate-400">E.164 phone or ID</span>
                  </div>
                  <input
                    type="text"
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    placeholder="e.g. +12025550143 or SchoolBMS"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Twilio Account SID *
                    </label>
                    <span className="text-[10px] text-slate-400">Starts with AC...</span>
                  </div>
                  <input
                    type="text"
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Twilio Auth Token *
                    </label>
                    <span className="text-[10px] text-slate-400">Secret Token</span>
                  </div>
                  <input
                    type="password"
                    placeholder="Enter Twilio Auth Token"
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-3">
              Automated Event Triggers
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoResultAlert}
                  onChange={(e) => setAutoResultAlert(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <strong className="text-slate-900 block font-bold">Auto Result Publication Alert</strong>
                  <span className="text-slate-500 text-[11px]">
                    Dispatches SMS with student grade and rank when admin publishes terminal results.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFeeAlert}
                  onChange={(e) => setAutoFeeAlert(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <strong className="text-slate-900 block font-bold">Auto Fee Payment Receipt</strong>
                  <span className="text-slate-500 text-[11px]">
                    Sends instant SMS payment receipt when bursar records tuition fees.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAbsentAlert}
                  onChange={(e) => setAutoAbsentAlert(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <strong className="text-slate-900 block font-bold">Auto Absenteeism Warning</strong>
                  <span className="text-slate-500 text-[11px]">
                    Alerts parents when a student is marked absent during morning roll call.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm transition text-xs cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? 'Saving Settings...' : 'Save Gateway Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* SMS Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Recent Gateway SMS Logs</h2>
          <span className="text-xs font-mono text-slate-400">Total: {logs.length} logged</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono py-8 text-center bg-slate-50 rounded-xl">
            No SMS messages logged yet. Send a test broadcast above to verify gateway delivery.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="pb-3 px-3">Date & Time</th>
                  <th className="pb-3 px-3">Recipient Phone</th>
                  <th className="pb-3 px-3">Message Body</th>
                  <th className="pb-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {log.phone}
                    </td>
                    <td className="py-3 px-3 text-slate-700 max-w-md truncate">
                      {log.message}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        title={log.status}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          log.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status === 'sent' ? 'Delivered' : (log.status.length > 28 ? log.status.slice(0, 28) + '...' : log.status)}
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
