'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PlatformFinancialOverview } from '@/lib/super-admin';
import { TenantStatus } from '@prisma/client';
import { getTenantUrl } from '@/lib/tenant-url';

interface AdminDashboardClientProps {
  financials: PlatformFinancialOverview;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    plan: { id: string; name: string; price: number };
    featureOverrides: Array<{ featureKey: string; enabled: boolean }>;
    _count: { students: number; staff: number; sessions: number };
  }>;
  impersonationLogs: Array<{
    id: string;
    reason: string;
    startedAt: string;
    endedAt: string | null;
    superAdmin: { name: string; email: string };
    tenant: { name: string; slug: string };
  }>;
}

export function AdminDashboardClient({
  financials: initialFinancials,
  tenants: initialTenants,
  impersonationLogs: initialLogs,
}: AdminDashboardClientProps) {
  const [tenants, setTenants] = useState(initialTenants);
  const [logs] = useState(initialLogs);
  const [financials] = useState(initialFinancials);

  // Status updating state
  const [updatingTenantId, setUpdatingTenantId] = useState<string | null>(null);

  // Impersonation modal state
  const [impersonateTarget, setImpersonateTarget] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [impersonateReason, setImpersonateReason] = useState('');
  const [impersonateError, setImpersonateError] = useState('');
  const [submittingImpersonate, setSubmittingImpersonate] = useState(false);

  // Handle status update
  const handleStatusChange = async (tenantId: string, newStatus: TenantStatus) => {
    setUpdatingTenantId(tenantId);
    try {
      const res = await fetch('/api/admin/tenants/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update status');
      } else {
        setTenants((prev) =>
          prev.map((t) => (t.id === tenantId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      alert('Network error updating status');
    } finally {
      setUpdatingTenantId(null);
    }
  };

  // Handle impersonation submission
  const handleStartImpersonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setImpersonateError('');

    if (!impersonateReason.trim()) {
      setImpersonateError('A non-empty reason is mandatory before impersonation can begin.');
      return;
    }

    if (!impersonateTarget) return;

    setSubmittingImpersonate(true);
    try {
      const res = await fetch('/api/admin/impersonate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: impersonateTarget.id,
          reason: impersonateReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setImpersonateError(data.error || 'Failed to start impersonation');
        setSubmittingImpersonate(false);
      } else {
        // Redirect to target tenant URL
        window.location.href = data.targetUrl;
      }
    } catch (err) {
      setImpersonateError('Network error starting impersonation');
      setSubmittingImpersonate(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Platform Financial Overview Section (§9) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Platform Financial Metrics</h2>
            <p className="text-xs text-slate-400">
              Subscription revenue &amp; PIN sales earned directly by platform operator.
            </p>
          </div>
          <span className="text-xs font-mono bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-1 rounded-md">
            Platform Control
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="adm-card-bg-replace border adm-border-replace rounded-xl p-6">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-mono block mb-1">
              Subscription Revenue
            </span>
            <span className="text-3xl font-extrabold text-emerald-400">
              ₦{financials.platformRevenue.subscriptionRevenue.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 block mt-1">From active/trial school plans</span>
          </div>

          <div className="adm-card-bg-replace border adm-border-replace rounded-xl p-6">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-mono block mb-1">
              Result PIN Sales Revenue
            </span>
            <span className="text-3xl font-extrabold text-cyan-400">
              ₦{financials.platformRevenue.pinRevenue.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 block mt-1">From completed PIN purchases</span>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-850 border adm-border-replace rounded-xl p-6 shadow-lg">
            <span className="text-xs uppercase tracking-wider text-blue-400 font-mono block mb-1 font-semibold">
              Total Platform Revenue
            </span>
            <span className="text-3xl font-extrabold text-white">
              ₦{financials.platformRevenue.totalPlatformRevenue.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 block mt-1">Subscription + Result PIN Sales</span>
          </div>
        </div>
      </div>

      {/* Registered School Tenants Management Table */}
      <div className="adm-card-bg-replace border adm-border-replace rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b adm-border-replace flex justify-between items-center bg-slate-950/40">
          <div>
            <h2 className="font-bold text-white">Registered School Tenants ({tenants.length})</h2>
            <p className="text-xs text-slate-400">Manage tenant operational status, feature flags, and impersonate staff.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 font-mono">
              <tr>
                <th className="px-6 py-3">School Name</th>
                <th className="px-6 py-3">Subdomain</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Students/Staff</th>
                <th className="px-6 py-3">Financial Overview</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tenants.map((t) => {
                const tf = financials.tenantFinancials.find((f) => f.tenantId === t.id);
                return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">
                      <div>{t.name}</div>
                      <a
                        href={getTenantUrl(t.slug, '/')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-blue-400 hover:underline"
                      >
                        {getTenantUrl(t.slug, '/').replace(/^https?:\/\//, '')} ↗
                      </a>
                    </td>

                    <td className="px-6 py-4 font-mono text-cyan-400 text-xs">{t.slug}</td>

                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-200 block">{t.plan.name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">₦{t.plan.price.toLocaleString()}/yr</span>
                    </td>

                    <td className="px-6 py-4">
                      <select
                        value={t.status}
                        disabled={updatingTenantId === t.id}
                        onChange={(e) => handleStatusChange(t.id, e.target.value as TenantStatus)}
                        className="adm-surface-bg-replace border adm-border-replace text-xs font-medium text-white rounded px-2.5 py-1 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
                      >
                        <option value="active">active</option>
                        <option value="trial">trial</option>
                        <option value="suspended">suspended</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>

                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {t._count.students} Students / {t._count.staff} Staff
                    </td>

                    <td className="px-6 py-4 text-xs font-mono space-y-0.5">
                      <div className="text-cyan-400">
                        PIN platform fees: ₦{(tf?.pinRevenueAmount || 0).toLocaleString()} ({tf?.pinSalesCount || 0} PINs)
                      </div>
                      <div className="text-slate-400">
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setImpersonateTarget({ id: t.id, name: t.name, slug: t.slug });
                          setImpersonateReason('');
                          setImpersonateError('');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-700 transition-colors cursor-pointer"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" /></svg> Impersonate
                      </button>

                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 transition-colors"
                      >
                        Features →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impersonation Audit Log Table (§9) */}
      <div className="adm-card-bg-replace border adm-border-replace rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b adm-border-replace flex justify-between items-center bg-slate-950/40">
          <div>
            <h2 className="font-bold text-white">Super Admin Impersonation Audit Logs</h2>
            <p className="text-xs text-slate-400">Full immutable trail of every super admin session into tenant environments.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No impersonation sessions recorded yet.</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 font-mono">
                <tr>
                  <th className="px-6 py-3">Super Admin</th>
                  <th className="px-6 py-3">Impersonated School</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3">Started At</th>
                  <th className="px-6 py-3">Ended At / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors font-mono text-xs">
                    <td className="px-6 py-4 text-white font-sans">{log.superAdmin.name} ({log.superAdmin.email})</td>
                    <td className="px-6 py-4 text-cyan-400">{log.tenant.name} ({log.tenant.slug})</td>
                    <td className="px-6 py-4 text-slate-300 font-sans italic">&ldquo;{log.reason}&rdquo;</td>
                    <td className="px-6 py-4 text-slate-400">{new Date(log.startedAt).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {log.endedAt ? (
                        <span className="text-slate-400">{new Date(log.endedAt).toLocaleString()}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-700 animate-pulse">
                          ACTIVE SESSION
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Impersonation Reason Modal (§9.1) */}
      {impersonateTarget && (
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="adm-card-bg-replace border border-amber-600/50 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div>
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <span className="text-xl"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block text-amber-400 mr-1"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></span>
                <h3 className="text-lg font-bold text-white">Confirm Super Admin Impersonation</h3>
              </div>
              <p className="text-xs text-slate-400">
                You are about to view <strong className="text-white">{impersonateTarget.name}</strong> as a Super Admin.
                An immutable audit log will be created and a persistent warning banner will be displayed throughout your session.
              </p>
            </div>

            <form onSubmit={handleStartImpersonation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Reason for Impersonation <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={impersonateReason}
                  onChange={(e) => setImpersonateReason(e.target.value)}
                  placeholder="e.g., Investigating parent portal login issue (Support Ticket #4920)..."
                  rows={3}
                  required
                  className="w-full adm-surface-bg-replace border adm-border-replace rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                />
                {impersonateError && (
                  <p className="text-xs text-red-400 mt-1.5 font-medium">{impersonateError}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setImpersonateTarget(null)}
                  disabled={submittingImpersonate}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingImpersonate}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {submittingImpersonate ? 'Starting Impersonation...' : 'Start Impersonation Mode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
