'use client';

import React, { useState } from 'react';

interface ImpersonationLogItem {
  id: string;
  reason: string;
  startedAt: string;
  endedAt: string | null;
  superAdmin: { name: string; email: string };
  tenant: { name: string; slug: string };
}

interface ResultAuditLogItem {
  id: string;
  action: string;
  targetId: string;
  reason: string;
  createdAt: string;
  tenant: { name: string; slug: string };
  user: { username: string; role: string; staff?: { name: string } | null };
}

interface AuditLogsClientProps {
  impersonationLogs: ImpersonationLogItem[];
  resultAuditLogs: ResultAuditLogItem[];
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const ExportIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 adm-text-muted">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);
const CalIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
  </svg>
);

export function AuditLogsClient({ impersonationLogs, resultAuditLogs }: AuditLogsClientProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'impersonations' | 'system'>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  const activeImpersonations = impersonationLogs.filter((l) => !l.endedAt).length;

  const matchesDateRange = (dateStr: string) => {
    if (dateFilter === 'all') return true;
    const logDate = new Date(dateStr).getTime();
    const now = Date.now();
    if (dateFilter === 'today') return logDate >= new Date().setHours(0, 0, 0, 0);
    if (dateFilter === '7days') return now - logDate <= 7 * 86400000;
    if (dateFilter === '30days') return now - logDate <= 30 * 86400000;
    return true;
  };

  const filteredImpersonations = impersonationLogs.filter((l) => {
    const term = search.toLowerCase();
    return (
      (!term || l.superAdmin?.name?.toLowerCase().includes(term) || l.superAdmin?.email?.toLowerCase().includes(term) || l.tenant?.name?.toLowerCase().includes(term) || l.tenant?.slug?.toLowerCase().includes(term) || l.reason?.toLowerCase().includes(term)) &&
      matchesDateRange(l.startedAt)
    );
  });

  const filteredResultAudits = resultAuditLogs.filter((l) => {
    const term = search.toLowerCase();
    const userName = l.user?.staff?.name || l.user?.username || '';
    return (
      (!term || l.tenant?.name?.toLowerCase().includes(term) || l.tenant?.slug?.toLowerCase().includes(term) || l.action?.toLowerCase().includes(term) || l.reason?.toLowerCase().includes(term) || userName.toLowerCase().includes(term)) &&
      matchesDateRange(l.createdAt)
    );
  });

  const handleExportCSV = () => {
    const rows = [['Log ID', 'Type', 'Actor / User', 'Target School', 'Action / Reason', 'Timestamp', 'Status']];
    impersonationLogs.forEach((l) => {
      rows.push([l.id, 'Impersonation', `"${l.superAdmin?.name} (${l.superAdmin?.email})"`, `"${l.tenant?.name}"`, `"${l.reason}"`, new Date(l.startedAt).toISOString(), l.endedAt ? 'Ended' : 'ACTIVE']);
    });
    resultAuditLogs.forEach((l) => {
      const n = l.user?.staff?.name || l.user?.username || 'User';
      rows.push([l.id, 'System Override', `"${n} (${l.user?.role})"`, `"${l.tenant?.name}"`, `"${l.action} — ${l.reason}"`, new Date(l.createdAt).toISOString(), 'Completed']);
    });
    const csv = 'data:text/csv;charset=utf-8,' + rows.map((r) => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `bms_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const TAB_CONFIG = [
    { id: 'all', label: 'All Logs' },
    { id: 'impersonations', label: `Impersonations (${impersonationLogs.length})` },
    { id: 'system', label: `System Overrides (${resultAuditLogs.length})` },
  ] as const;

  return (
    <div className="space-y-6">

      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b adm-divider">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-[10px] font-semibold text-rose-500 uppercase tracking-widest">
              <ShieldIcon />
              Security Center
            </span>
          </div>
          <h1 className="text-2xl font-bold adm-text-primary tracking-tight">
            Security & Impersonation Audit Logs
          </h1>
          <p className="text-sm adm-text-muted mt-1 max-w-xl leading-relaxed">
            Immutable audit trail for cross-tenant access, result overrides, and administrative actions.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl adm-surface border adm-divider adm-text-secondary hover:adm-text-primary font-semibold text-sm transition-all shrink-0"
        >
          <ExportIcon />
          Export Audit Trail
        </button>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Impersonation Sessions', value: impersonationLogs.length, color: 'text-indigo-500', note: 'Logged cross-tenant access' },
          { label: 'Active Impersonations', value: activeImpersonations, color: 'text-amber-500', note: 'Sessions in progress', pulse: activeImpersonations > 0 },
          { label: 'System Override Logs', value: resultAuditLogs.length, color: 'text-emerald-500', note: 'Result & score audits' },
          { label: 'Log Integrity', value: '100%', color: 'text-sky-500', note: 'Append-only ledger', isText: true },
        ].map((m) => (
          <div key={m.label} className="adm-card border rounded-2xl p-4">
            <span className="text-[10px] font-medium adm-text-muted uppercase tracking-widest block mb-2">{m.label}</span>
            <div className={`text-2xl font-bold ${m.color} flex items-center gap-2`}>
              {m.value}
              {m.pulse && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
            </div>
            <p className="text-[10px] adm-text-muted mt-1">{m.note}</p>
          </div>
        ))}
      </div>

      {/* ── Filter Toolbar ────────────────────────────────────────────────────── */}
      <div className="adm-card border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-1 items-center gap-3 min-w-0">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2"><SearchIcon /></span>
            <input
              type="text"
              placeholder="Search by school, admin, reason or action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="adm-input w-full pl-9 pr-4 py-2 border rounded-xl text-xs"
            />
          </div>
          {/* Date range */}
          <div className="relative shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none adm-text-muted"><CalIcon /></span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="adm-input pl-8 pr-3 py-2 border rounded-xl text-xs appearance-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today Only</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                  : 'adm-surface adm-text-secondary hover:adm-text-primary border adm-divider'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Impersonation Table ───────────────────────────────────────────────── */}
      {(activeTab === 'all' || activeTab === 'impersonations') && (
        <div className="adm-card border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b adm-divider flex items-center justify-between adm-surface">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <div>
                <h2 className="text-sm font-bold adm-text-primary flex items-center gap-2">
                  <UserIcon />
                  Super Admin Impersonation History
                </h2>
                <p className="text-[11px] adm-text-muted mt-0.5">Audited cross-tenant login sessions.</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
              Mandatory Reason Enforced
            </span>
          </div>

          {filteredImpersonations.length === 0 ? (
            <div className="p-10 text-center adm-text-muted text-xs font-mono">
              No impersonation logs match your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b adm-divider">
                    {['Super Admin', 'Target School', 'Reason', 'Started At', 'Status'].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-semibold adm-text-muted uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredImpersonations.map((log, i) => (
                    <tr key={log.id} className={`border-b adm-divider adm-surface-hover transition-colors ${i % 2 === 1 ? 'adm-surface' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold adm-text-primary text-xs">{log.superAdmin?.name}</div>
                        <div className="text-[10px] adm-text-muted">{log.superAdmin?.email}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sky-500 font-semibold text-xs">{log.tenant?.name}</div>
                        <div className="text-[10px] adm-text-muted font-mono">/{log.tenant?.slug}</div>
                      </td>
                      <td className="px-5 py-3.5 text-amber-600 italic max-w-xs text-[11px]">&ldquo;{log.reason}&rdquo;</td>
                      <td className="px-5 py-3.5 adm-text-muted whitespace-nowrap">{new Date(log.startedAt).toLocaleString()}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {!log.endedAt ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                            ● Active
                          </span>
                        ) : (
                          <span className="text-[10px] adm-text-muted">Ended {new Date(log.endedAt).toLocaleTimeString()}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── System Override Table ─────────────────────────────────────────────── */}
      {(activeTab === 'all' || activeTab === 'system') && (
        <div className="adm-card border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b adm-divider flex items-center justify-between adm-surface">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <div>
                <h2 className="text-sm font-bold adm-text-primary flex items-center gap-2">
                  <ShieldIcon />
                  Academic & Result Reopening Audit Log
                </h2>
                <p className="text-[11px] adm-text-muted mt-0.5">Score broadsheet unlocks, attendance resets, and component overrides.</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              Audit Stream Active
            </span>
          </div>

          {filteredResultAudits.length === 0 ? (
            <div className="p-10 text-center adm-text-muted text-xs font-mono">
              No system override logs match your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b adm-divider">
                    {['Action', 'School', 'Authorized By', 'Reason', 'Timestamp'].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-semibold adm-text-muted uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredResultAudits.map((log, i) => {
                    const userName = log.user?.staff?.name || (log.user as any)?.staffProfile?.name || log.user?.username || 'User';
                    return (
                      <tr key={log.id} className={`border-b adm-divider adm-surface-hover transition-colors ${i % 2 === 1 ? 'adm-surface' : ''}`}>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                            {log.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sky-500 font-semibold">{log.tenant?.name}</td>
                        <td className="px-5 py-3.5 adm-text-primary">{userName} <span className="adm-text-muted">({log.user?.role})</span></td>
                        <td className="px-5 py-3.5 adm-text-secondary italic max-w-xs text-[11px]">&ldquo;{log.reason}&rdquo;</td>
                        <td className="px-5 py-3.5 adm-text-muted whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
