'use client';

import React, { useState } from 'react';
import { Building2, Inbox, Mail, Phone, Search, Trash2 } from 'lucide-react';
import type { PlatformLead } from '@/app/api/admin/leads/route';

export function LeadsClient({ initialLeads }: { initialLeads: PlatformLead[] }) {
  const [leads, setLeads] = useState<PlatformLead[]>(initialLeads);
  const [filter, setFilter] = useState<'all' | PlatformLead['status']>('all');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const updateLead = async (id: string, patch: { status?: PlatformLead['status']; notes?: string }) => {
    setSavingId(id);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...patch }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.leads)) setLeads(data.leads);
    } finally {
      setSavingId(null);
    }
  };

  const deleteLead = async (id: string) => {
    if (!window.confirm('Delete this lead inquiry?')) return;
    setSavingId(id);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.leads)) setLeads(data.leads);
    } finally {
      setSavingId(null);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = leads.filter((l) => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.schoolName || '').toLowerCase().includes(q) ||
      l.message.toLowerCase().includes(q)
    );
  });

  const counts = {
    all: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    contacted: leads.filter((l) => l.status === 'contacted').length,
    converted: leads.filter((l) => l.status === 'converted').length,
    archived: leads.filter((l) => l.status === 'archived').length,
  };

  return (
    <div className="space-y-6">
      <header className="pb-5 border-b adm-divider flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold adm-text-primary tracking-tight">Leads &amp; Inquiries</h1>
          <p className="text-sm adm-text-muted mt-1 max-w-2xl">
            Submissions from the Contact &amp; Demo Form widget on your public website pages.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 adm-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="adm-input w-full border rounded-lg pl-8 pr-3 py-2 text-xs"
          />
        </div>
      </header>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'new', 'contacted', 'converted', 'archived'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`h-8 px-3 rounded-lg text-xs font-semibold capitalize inline-flex items-center gap-1.5 cursor-pointer ${
              filter === tab
                ? 'adm-btn-primary'
                : 'adm-surface border adm-divider adm-text-secondary hover:adm-text-primary'
            }`}
          >
            <span>{tab}</span>
            <span className="text-[10px] opacity-80">{counts[tab]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="adm-card border border-dashed rounded-xl p-12 text-center space-y-2">
          <Inbox className="w-8 h-8 mx-auto adm-text-muted" />
          <p className="text-sm font-semibold adm-text-primary">No inquiries yet</p>
          <p className="text-xs adm-text-muted max-w-md mx-auto">
            Drag the <strong>Contact / Lead Form</strong> widget onto any public page in Website Studio to start capturing school demo requests here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((lead) => (
            <article key={lead.id} className="adm-card border rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold adm-text-primary">{lead.name}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        lead.status === 'new'
                          ? 'adm-status-trial'
                          : lead.status === 'converted'
                          ? 'adm-status-active'
                          : 'adm-status-neutral'
                      }`}
                    >
                      {lead.status}
                    </span>
                    <span className="text-[10px] font-mono adm-text-muted">
                      from {lead.sourcePage}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs adm-text-secondary">
                    <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:underline">
                      <Mail className="w-3.5 h-3.5 adm-text-muted" />
                      <span>{lead.email}</span>
                    </a>
                    {lead.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 adm-text-muted" />
                        <span>{lead.phone}</span>
                      </span>
                    )}
                    {lead.schoolName && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 adm-text-muted" />
                        <span>{lead.schoolName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={lead.status}
                    disabled={savingId === lead.id}
                    onChange={(e) =>
                      updateLead(lead.id, { status: e.target.value as PlatformLead['status'] })
                    }
                    className="adm-input border rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="converted">Converted</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button
                    type="button"
                    disabled={savingId === lead.id}
                    onClick={() => deleteLead(lead.id)}
                    className="p-2 rounded-lg border adm-divider text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    title="Delete lead"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs adm-text-secondary leading-relaxed p-3 rounded-lg adm-surface border adm-divider whitespace-pre-wrap">
                {lead.message}
              </p>

              <div className="text-[11px] adm-text-faint">
                Received {new Date(lead.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
