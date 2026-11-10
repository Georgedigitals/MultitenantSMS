'use client';

import React, { useState, useTransition } from 'react';

interface AuditLogItem {
  id: string;
  tenantId: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogsClientProps {
  slug: string;
  tenantName: string;
  initialData: {
    logs: AuditLogItem[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  };
}

export default function AuditLogsClient({
  slug,
  tenantName,
  initialData,
}: AuditLogsClientProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialData.logs);
  const [totalCount, setTotalCount] = useState(initialData.totalCount);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const fetchLogs = async (page: number, searchVal: string, actionVal: string, roleVal: string) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '25');
      if (searchVal.trim()) params.set('search', searchVal.trim());
      if (actionVal !== 'all') params.set('action', actionVal);
      if (roleVal !== 'all') params.set('actorRole', roleVal);

      const res = await fetch(`/api/tenant/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();

      setLogs(data.logs || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    }
  };

  const handleFilterChange = (newAction: string, newRole: string) => {
    setActionFilter(newAction);
    setRoleFilter(newRole);
    startTransition(() => {
      fetchLogs(1, search, newAction, newRole);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      fetchLogs(1, search, actionFilter, roleFilter);
    });
  };

  const handlePageChange = (page: number) => {
    startTransition(() => {
      fetchLogs(page, search, actionFilter, roleFilter);
    });
  };

  const handleCopyJson = (log: AuditLogItem) => {
    navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for action badge colors
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'AUTH_LOGIN':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            Login
          </span>
        );
      case 'FEE_PAYMENT_RECORDED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            Fee Payment
          </span>
        );
      case 'PROMOTION_EXECUTED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            Promotion
          </span>
        );
      case 'TENANT_REGISTERED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            Registration
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            {action.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'school_admin':
        return <span className="text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold">Admin</span>;
      case 'teacher':
        return <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-medium">Staff</span>;
      case 'student':
        return <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">Student</span>;
      default:
        return <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">{role}</span>;
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  };

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail & Security Log</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {totalCount} Recorded Event{totalCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Immutable system record of administrative mutations, staff actions, and access events for <span className="font-medium text-slate-800">{tenantName}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs(currentPage, search, actionFilter, roleFilter)}
          disabled={isPending}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm disabled:opacity-50"
        >
          <svg className={`w-4 h-4 mr-2 text-slate-500 ${isPending ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isPending ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {/* ─── Search and Filters ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by actor name, action, or entity ID..."
              className="w-full pl-9 pr-20 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchLogs(1, '', actionFilter, roleFilter);
                }}
                className="absolute inset-y-0 right-14 pr-2 flex items-center text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute inset-y-1 right-1 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors"
            >
              Search
            </button>
          </form>

          {/* Action Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Action:</label>
            <select
              value={actionFilter}
              onChange={(e) => handleFilterChange(e.target.value, roleFilter)}
              className="py-2 px-3 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Actions</option>
              <option value="AUTH_LOGIN">Logins (AUTH_LOGIN)</option>
              <option value="FEE_PAYMENT_RECORDED">Fee Payments</option>
              <option value="PROMOTION_EXECUTED">Student Promotions</option>
              <option value="TENANT_REGISTERED">Tenant Registrations</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => handleFilterChange(actionFilter, e.target.value)}
              className="py-2 px-3 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Roles</option>
              <option value="school_admin">School Admin</option>
              <option value="teacher">Teacher / Staff</option>
              <option value="student">Student</option>
              <option value="system">System / Automated</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Audit Log Table ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No audit records found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || actionFilter !== 'all' || roleFilter !== 'all'
                ? 'Try adjusting your search query or filters to locate historical logs.'
                : 'Administrative and authentication actions will appear here once performed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3">Timestamp</th>
                  <th scope="col" className="px-3 py-3.5">Actor</th>
                  <th scope="col" className="px-3 py-3.5">Action</th>
                  <th scope="col" className="px-3 py-3.5">Target Entity</th>
                  <th scope="col" className="px-3 py-3.5">Client IP</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logs.map((log) => {
                  const dt = formatDate(log.createdAt);
                  const isExpanded = expandedLogId === log.id;
                  const hasDetails = log.details && Object.keys(log.details).length > 0;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className={`hover:bg-slate-50/75 transition-colors ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                        <td className="whitespace-nowrap py-3.5 pl-6 pr-3 text-xs">
                          <div className="font-medium text-slate-900">{dt.date}</div>
                          <div className="text-slate-500 text-[11px] font-mono">{dt.time}</div>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
                              {log.actorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-900">{log.actorName}</div>
                              <div>{getRoleBadge(log.actorRole)}</div>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3.5">
                          {getActionBadge(log.action)}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3.5 text-xs">
                          <span className="font-medium text-slate-800">{log.entityType}</span>
                          {log.entityId && (
                            <span className="block text-[11px] font-mono text-slate-500 truncate max-w-[140px]" title={log.entityId}>
                              {log.entityId}
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600 font-mono">
                          {log.ipAddress || <span className="text-slate-400 italic">N/A</span>}
                        </td>

                        <td className="whitespace-nowrap py-3.5 pl-3 pr-6 text-right text-xs">
                          {hasDetails ? (
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-900 font-medium"
                            >
                              <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                              <svg
                                className={`w-3.5 h-3.5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No payload</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable JSON Detail Row */}
                      {isExpanded && hasDetails && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="px-6 py-4 border-t border-b border-slate-100">
                            <div className="rounded-lg bg-slate-900 text-slate-200 p-4 font-mono text-xs overflow-x-auto relative">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                                <span>Payload Details ({log.entityType}:{log.entityId || 'none'})</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyJson(log)}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                  {copiedId === log.id ? (
                                    <>
                                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                      <span>Copy JSON</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="text-emerald-300 leading-relaxed overflow-x-auto max-h-60">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Pagination Footer ─── */}
        {totalPages > 1 && (
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold text-slate-900">{currentPage}</span> of{' '}
              <span className="font-semibold text-slate-900">{totalPages}</span> ({totalCount} total records)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1 || isPending}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
