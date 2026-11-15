'use client';

import React, { useState } from 'react';

interface InitialEmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  verified: boolean;
  updatedAt: string;
}

interface EmailClientProps {
  slug: string;
  tenantName: string;
  tenantEmail: string;
  initialConfig: InitialEmailConfig | null;
}

export default function EmailSettingsClient({
  slug,
  tenantName,
  tenantEmail,
  initialConfig,
}: EmailClientProps) {
  const [config, setConfig] = useState<InitialEmailConfig | null>(initialConfig);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [host, setHost] = useState(initialConfig?.host || '');
  const [port, setPort] = useState(initialConfig?.port ? String(initialConfig.port) : '465');
  const [secure, setSecure] = useState(initialConfig?.secure ?? true);
  const [user, setUser] = useState(initialConfig?.user || '');
  const [pass, setPass] = useState('');
  const [fromName, setFromName] = useState(initialConfig?.fromName || tenantName);
  const [fromEmail, setFromEmail] = useState(initialConfig?.fromEmail || '');
  const [replyTo, setReplyTo] = useState(initialConfig?.replyTo || tenantEmail);

  // Action states
  const [saving, setSaving] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState(initialConfig?.replyTo || tenantEmail);

  // Alerts
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const isCustomActive = Boolean(config?.verified && config?.host && config?.user);

  async function handleSavePreferences(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!replyTo.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a valid Direct Reply-To address.' });
      return;
    }

    setSavingPrefs(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/tenant/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromName: fromName.trim() || tenantName,
          replyTo: replyTo.trim(),
          fromEmail: fromEmail.trim() || replyTo.trim(),
          isPreferencesOnly: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save sender preferences');
      }

      setConfig((prev) => ({
        ...(prev || {
          host: '',
          port: 465,
          secure: true,
          user: '',
          verified: false,
        }),
        fromName: data.config.fromName,
        fromEmail: data.config.fromEmail,
        replyTo: data.config.replyTo,
        updatedAt: new Date().toISOString(),
      }));

      setFeedback({
        type: 'success',
        message: 'Sender Display Name and Direct Reply-To address saved successfully! All recipient replies will now route directly to your school address.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to save sender preferences.',
      });
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleSaveCustomSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/tenant/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.trim(),
          port: Number(port),
          secure,
          user: user.trim(),
          pass: pass.trim(),
          fromName: fromName.trim() || tenantName,
          fromEmail: fromEmail.trim() || user.trim(),
          replyTo: replyTo.trim() || user.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save SMTP settings');
      }

      setConfig({
        host: data.config.host,
        port: data.config.port,
        secure: data.config.secure,
        user: data.config.user,
        fromName: data.config.fromName,
        fromEmail: data.config.fromEmail,
        replyTo: data.config.replyTo,
        verified: data.config.verified,
        updatedAt: new Date().toISOString(),
      });

      setPass(''); // Clear sensitive password input after save
      setFeedback({
        type: 'success',
        message: 'Custom SMTP settings verified and activated successfully! Outbound emails will now route through your private server.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to connect to SMTP server. Verify your credentials.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRevertToDefault() {
    if (!confirm('Are you sure you want to revert to platform default email delivery? Your private SMTP credentials will be removed, but your direct reply-to address will be preserved.')) {
      return;
    }

    setReverting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/tenant/settings/email', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove custom SMTP');
      }

      setConfig((prev) =>
        prev
          ? {
              ...prev,
              host: '',
              user: '',
              verified: false,
            }
          : null
      );
      setHost('');
      setUser('');
      setPass('');
      setFeedback({
        type: 'info',
        message: 'Reverted to platform default email delivery. Outbound emails will dispatch via the high-deliverability cluster, and replies will route to your direct reply-to address.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to revert email settings.',
      });
    } finally {
      setReverting(false);
    }
  }

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!testRecipient) return;

    setTesting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/tenant/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: testRecipient.trim(),
          replyTo: replyTo.trim() || config?.replyTo || tenantEmail,
          fromName: fromName.trim() || config?.fromName || tenantName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }

      setFeedback({
        type: 'success',
        message: `Test email successfully dispatched to ${testRecipient}! Delivery ID: ${data.deliveryId}`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to send test email.',
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-blue-100 text-blue-700 text-xl font-bold shadow-xs">
            ✉️
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Email Delivery & Direct Reply-To
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage how notifications, report cards, credentials, and parent replies are routed.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-sm font-medium flex items-start gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          <span className="text-lg">
            {feedback.type === 'success' ? '✅' : feedback.type === 'error' ? '⚠️' : 'ℹ️'}
          </span>
          <div className="flex-1">{feedback.message}</div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Active Delivery Status Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Mode</span>
              {isCustomActive ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                  Custom Private SMTP
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Platform Delivery Cluster (Active)
                </span>
              )}
            </div>

            <h3 className="text-xl font-black text-slate-900">
              {isCustomActive
                ? `Routing Outbound Mail via ${config?.host}`
                : `Managed Platform Delivery for ${fromName || tenantName}`}
            </h3>

            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {isCustomActive
                ? `Emails are dispatched directly through your private mail server (${config?.user}). Direct replies route to: ${config?.replyTo || replyTo || tenantEmail}.`
                : `Your school is using zero-setup platform email delivery. All notifications are stamped with your school's name (${fromName || tenantName}), and when recipients reply, replies route directly to ${config?.replyTo || replyTo || tenantEmail}.`}
            </p>
          </div>

          {isCustomActive && (
            <button
              type="button"
              onClick={handleRevertToDefault}
              disabled={reverting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all shrink-0 shadow-2xs disabled:opacity-50"
            >
              {reverting ? 'Reverting...' : 'Revert to Platform Default'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Section 1: Sender Display Name & Direct Reply-To Address */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Sender Information & Direct Reply-To
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Controls the name and return email address recipients see when they receive or reply to emails.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSavePreferences()}
                disabled={savingPrefs}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all disabled:opacity-50 self-start sm:self-auto shrink-0 shadow-2xs"
              >
                {savingPrefs ? 'Saving...' : 'Save Reply-To Address'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Sender Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Academy Portal"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
                <span className="text-[11px] text-slate-400">The name displayed as sender in inbox list.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Direct Reply-To Address *</label>
                <input
                  type="email"
                  name="school_direct_reply_to"
                  autoComplete="off"
                  required
                  placeholder="e.g. info@school.edu, school@gmail.com"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
                <span className="text-[11px] text-slate-400">Where parents, teachers, and staff replies will be sent.</span>
              </div>
            </div>
          </div>

          {/* Section 2: Custom SMTP Configuration Form */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="mb-6">
              <h2 className="text-lg font-black text-slate-900">
                {isCustomActive ? 'Update Private SMTP Settings' : 'Connect Private Custom Mail Server (Optional)'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                For schools wishing to dispatch outbound mail through private Google Workspace, Gmail, Microsoft 365, or cPanel servers.
              </p>
            </div>

            <form onSubmit={handleSaveCustomSmtp} autoComplete="off" className="space-y-5">
              {/* Hidden trap inputs to prevent browser password managers from autofilling portal login credentials */}
              <input type="text" name="prevent_autofill_user" autoComplete="username" tabIndex={-1} aria-hidden="true" className="hidden" />
              <input type="password" name="prevent_autofill_pass" autoComplete="current-password" tabIndex={-1} aria-hidden="true" className="hidden" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">SMTP Host / Server Address *</label>
                  <input
                    type="text"
                    name="smtp_server_host"
                    autoComplete="off"
                    required
                    placeholder="e.g. smtp.gmail.com, mail.school.edu"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">SMTP Port *</label>
                  <input
                    type="number"
                    name="smtp_server_port"
                    autoComplete="off"
                    required
                    placeholder="465 or 587"
                    value={port}
                    onChange={(e) => {
                      const p = e.target.value;
                      setPort(p);
                      if (p === '465') setSecure(true);
                      if (p === '587') setSecure(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <input
                  type="checkbox"
                  id="secureToggle"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="secureToggle" className="font-semibold text-slate-700 cursor-pointer">
                  Enable SSL/TLS Encryption (Recommended for Port 465; leave unchecked for Port 587)
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">SMTP Username / Email *</label>
                  <input
                    type="text"
                    name="smtp_custom_account_user"
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    required
                    placeholder="school@gmail.com or notifications@school.edu"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      SMTP Password {isCustomActive && !pass ? '(Saved)' : '*'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-blue-600 font-semibold hover:underline"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="smtp_custom_app_secret"
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    required={!isCustomActive}
                    placeholder={isCustomActive ? '•••••••• (leave blank to keep unchanged)' : 'Google App Password or Mail Password'}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                  <span className="text-[11px] text-slate-400">
                    For Gmail, use a 16-character Google App Password. Spaces are automatically stripped.
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Testing & Saving Connection...' : 'Verify & Save Custom Server'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Live Test Console & Helpful Tips */}
        <div className="space-y-6">
          {/* Live Test Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <h3 className="text-base font-black text-slate-900 mb-1">
              Live Delivery Test
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Send a test email to verify that your active delivery configuration works end-to-end.
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Test Recipient Email</label>
                <input
                  type="email"
                  required
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="admin@school.edu"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={testing}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all disabled:opacity-50"
              >
                {testing ? 'Sending Test...' : 'Send Live Test Email'}
              </button>
            </form>
          </div>

          {/* Integration Guide Box */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
              <span>Common SMTP Settings</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong>Google Workspace / Gmail:</strong><br />
                Host: <code className="text-amber-300">smtp.gmail.com</code> | Port: <code className="text-amber-300">465</code> (SSL)<br />
                Use a Google <em>App Password</em> instead of your main password.
              </p>

              <p className="pt-2 border-t border-slate-800">
                <strong>Microsoft 365 / Outlook:</strong><br />
                Host: <code className="text-amber-300">smtp.office365.com</code> | Port: <code className="text-amber-300">587</code> (TLS)
              </p>

              <p className="pt-2 border-t border-slate-800">
                <strong>cPanel / Webmail / Hostinger:</strong><br />
                Host: <code className="text-amber-300">mail.yourdomain.com</code> | Port: <code className="text-amber-300">465</code> (SSL)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
