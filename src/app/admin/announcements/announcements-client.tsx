'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle2, Info, Megaphone, Plus, Trash2, AlertTriangle } from 'lucide-react';
import type { PlatformAnnouncement } from '@/app/api/admin/announcements/route';

interface AnnouncementsClientProps {
  initialAnnouncements: PlatformAnnouncement[];
  planNames: string[];
}

export function AnnouncementsClient({
  initialAnnouncements,
  planNames,
}: AnnouncementsClientProps) {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>(initialAnnouncements);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'success'>('info');
  const [targetPlan, setTargetPlan] = useState('all');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title,
          message,
          severity,
          targetPlan,
          ctaLabel: ctaLabel || undefined,
          ctaHref: ctaHref || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish announcement');
      setAnnouncements(data.announcements);
      setTitle('');
      setMessage('');
      setCtaLabel('');
      setCtaHref('');
      setExpiresAt('');
      setStatus({ type: 'success', text: 'Broadcast announcement published to tenant dashboards.' });
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Publish failed.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: 'toggle' | 'delete', id: string) => {
    if (action === 'delete' && !window.confirm('Delete this broadcast announcement?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements);
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'adm-input w-full border rounded-lg px-3 py-2 text-xs';

  return (
    <div className="space-y-6">
      <header className="pb-5 border-b adm-divider">
        <h1 className="text-2xl font-bold adm-text-primary tracking-tight">Broadcast Announcements</h1>
        <p className="text-sm adm-text-muted mt-1 max-w-2xl">
          Push live notice banners across all school dashboards or target specific subscription tiers.
        </p>
      </header>

      {status && (
        <div
          className={`px-4 py-3 rounded-xl text-xs font-semibold border ${
            status.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
              : 'bg-rose-500/10 text-rose-600 border-rose-500/25'
          }`}
        >
          {status.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Compose Form */}
        <form onSubmit={handleCreate} className="lg:col-span-5 adm-card border rounded-xl p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b adm-divider">
            <Megaphone className="w-4 h-4 adm-text-accent" />
            <h2 className="text-sm font-bold adm-text-primary">New Broadcast Banner</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold adm-text-secondary mb-1">Headline</label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled Maintenance — Sunday 2:00 AM"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold adm-text-secondary mb-1">Message</label>
            <textarea
              required
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a concise notice that appears at the top of school dashboards..."
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold adm-text-secondary mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className={inputClass}
              >
                <option value="info">Information</option>
                <option value="warning">Warning / Maintenance</option>
                <option value="success">Feature / Good News</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold adm-text-secondary mb-1">Target Audience</label>
              <select
                value={targetPlan}
                onChange={(e) => setTargetPlan(e.target.value)}
                className={inputClass}
              >
                <option value="all">All Schools</option>
                {planNames.map((p) => (
                  <option key={p} value={p}>
                    {p} Plan Only
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold adm-text-secondary mb-1">
                Optional CTA Label
              </label>
              <input
                type="text"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="e.g. Learn more"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold adm-text-secondary mb-1">
                Optional CTA Link
              </label>
              <input
                type="text"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
                placeholder="e.g. /pricing"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold adm-text-secondary mb-1">
              Auto-Expire Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="adm-btn-primary w-full h-10 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Publishing...' : 'Publish Broadcast'}</span>
          </button>
        </form>

        {/* Active & Past Broadcasts */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold adm-text-primary">
              Published Broadcasts ({announcements.length})
            </h2>
          </div>

          {announcements.length === 0 ? (
            <div className="adm-card border border-dashed rounded-xl p-12 text-center space-y-2">
              <Bell className="w-7 h-7 mx-auto adm-text-muted" />
              <p className="text-sm font-semibold adm-text-primary">No broadcasts yet</p>
              <p className="text-xs adm-text-muted">
                Create a broadcast on the left to notify school admins and staff inside their workspace.
              </p>
            </div>
          ) : (
            announcements.map((item) => {
              const Icon =
                item.severity === 'warning'
                  ? AlertTriangle
                  : item.severity === 'success'
                  ? CheckCircle2
                  : Info;
              return (
                <article
                  key={item.id}
                  className="adm-card border rounded-xl p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          item.severity === 'warning'
                            ? 'text-amber-500'
                            : item.severity === 'success'
                            ? 'text-emerald-600'
                            : 'adm-text-accent'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold adm-text-primary">{item.title}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.active ? 'adm-status-active' : 'adm-status-neutral'
                            }`}
                          >
                            {item.active ? 'Live' : 'Paused'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono adm-surface border adm-divider adm-text-secondary">
                            Target: {item.targetPlan === 'all' ? 'All Schools' : item.targetPlan}
                          </span>
                        </div>
                        <p className="text-xs adm-text-secondary mt-1 leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t adm-divider flex flex-wrap items-center justify-between gap-2 text-[11px] adm-text-muted">
                    <span>
                      Posted {new Date(item.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                      {item.expiresAt
                        ? ` · Expires ${new Date(item.expiresAt).toLocaleDateString('en-NG')}`
                        : ''}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleAction('toggle', item.id)}
                        className="font-semibold adm-text-secondary hover:adm-text-primary cursor-pointer"
                      >
                        {item.active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleAction('delete', item.id)}
                        className="font-semibold text-rose-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
