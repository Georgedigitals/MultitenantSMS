'use client';

import React, { useState } from 'react';

interface TenantBackupItem {
  id: string;
  name: string;
  trigger: string;
  status: string;
  sizeBytes: number;
  metadata: any;
  createdById: string | null;
  restoredAt: string | null;
  restoredById: string | null;
  createdAt: string;
}

interface BackupsClientProps {
  slug: string;
  tenantName: string;
  initialBackups: TenantBackupItem[];
}

export default function BackupsClient({
  slug,
  tenantName,
  initialBackups,
}: BackupsClientProps) {
  const [backups, setBackups] = useState<TenantBackupItem[]>(initialBackups);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create Snapshot Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [newSnapshotTrigger, setNewSnapshotTrigger] = useState('manual');
  const [isCreating, setIsCreating] = useState(false);

  // Restore Modal State
  const [restoreModalBackup, setRestoreModalBackup] = useState<TenantBackupItem | null>(null);
  const [confirmSlugInput, setConfirmSlugInput] = useState('');
  const [autoSafetyBackup, setAutoSafetyBackup] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchBackups = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/tenant/backups?slug=${slug}`);
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups);
      }
    } catch (err: any) {
      console.error('Failed to refresh backups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setFeedback(null);
      const res = await fetch('/api/tenant/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name: newSnapshotName.trim() || undefined,
          trigger: newSnapshotTrigger,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Point-in-time snapshot created successfully.' });
        setShowCreateModal(false);
        setNewSnapshotName('');
        await fetchBackups();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to create snapshot.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error occurred.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreModalBackup) return;
    if (confirmSlugInput.trim() !== slug) {
      setFeedback({
        type: 'error',
        message: `Confirmation mismatch. You must enter exact school slug "${slug}".`,
      });
      return;
    }

    try {
      setIsRestoring(true);
      setFeedback(null);
      const res = await fetch(`/api/tenant/backups/${restoreModalBackup.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          confirmSlug: confirmSlugInput.trim(),
          autoSafetyBackup,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `Disaster recovery complete! Workspace restored to "${restoreModalBackup.name}".`,
        });
        setRestoreModalBackup(null);
        setConfirmSlugInput('');
        await fetchBackups();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to restore snapshot.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Restoration failed due to an error.' });
    } finally {
      setIsRestoring(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTriggerBadge = (trigger: string) => {
    switch (trigger) {
      case 'pre_promotion':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            Pre-Promotion
          </span>
        );
      case 'automated_scheduled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            Automated
          </span>
        );
      case 'pre_migration':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            Pre-Restore Safety
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            Manual
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Disaster Recovery & Backup Snapshots
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Point-in-Time Safe
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Immutable point-in-time state captures and atomic rollbacks for{' '}
            <span className="font-semibold text-slate-700">{tenantName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Snapshot Now
          </button>
          <button
            onClick={fetchBackups}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            <svg
              className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold text-lg px-2">
            ×
          </button>
        </div>
      )}

      {/* Snapshot History Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        {backups.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
              />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No backup snapshots recorded</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create a snapshot before major academic operations (like promotion or bulk grade entry) to protect your school data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Snapshot Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Entity Metrics
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Created / Restored
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{b.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{b.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getTriggerBadge(b.trigger)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1 text-xs">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                          {b.metadata?.studentsCount || 0} Students
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                          {b.metadata?.resultsCount || 0} Results
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                          {b.metadata?.feePaymentsCount || 0} Fees
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      <div>Captured: {new Date(b.createdAt).toLocaleDateString()}</div>
                      {b.restoredAt && (
                        <div className="text-amber-600 font-semibold mt-0.5">
                          Restored on {new Date(b.restoredAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <a
                        href={`/api/tenant/backups/${b.id}/download?slug=${slug}`}
                        download
                        className="inline-flex items-center text-xs font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      >
                        Download
                      </a>
                      <button
                        onClick={() => {
                          setRestoreModalBackup(b);
                          setConfirmSlugInput('');
                        }}
                        className="inline-flex items-center text-xs font-semibold px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded transition-colors"
                      >
                        Restore State
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Snapshot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create Point-in-Time Snapshot</h3>
            <p className="text-sm text-slate-500">
              Captures an exact snapshot of current students, enrollments, sessions, examination scores, and fee records.
            </p>

            <form onSubmit={handleCreateSnapshot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Snapshot Label</label>
                <input
                  type="text"
                  placeholder="e.g. End of First Term 2024 State"
                  value={newSnapshotName}
                  onChange={(e) => setNewSnapshotName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Reason / Trigger</label>
                <select
                  value={newSnapshotTrigger}
                  onChange={(e) => setNewSnapshotTrigger(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="manual">Manual Backup</option>
                  <option value="pre_promotion">Pre-Promotion Safety Backup</option>
                  <option value="pre_migration">Pre-Migration / Restructure</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Capturing Snapshot...' : 'Create Snapshot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore State Modal */}
      {restoreModalBackup && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-lg font-bold text-slate-900">Authorize Point-in-Time State Rollback</h3>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
              <p className="font-bold">CAUTION: Destructive State Replacement</p>
              <p>
                Restoring snapshot &quot;<strong>{restoreModalBackup.name}</strong>&quot; will roll back your school&apos;s
                students, sessions, examination scores, and fee records to the exact state captured on{' '}
                {new Date(restoreModalBackup.createdAt).toLocaleString()}.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSafetyBackup}
                  onChange={(e) => setAutoSafetyBackup(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Automatically create safety backup of current state before rollback (recommended)</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Type exact school slug <span className="font-mono text-rose-700 bg-rose-50 px-1 py-0.5 rounded">{slug}</span> to confirm:
                </label>
                <input
                  type="text"
                  placeholder={slug}
                  value={confirmSlugInput}
                  onChange={(e) => setConfirmSlugInput(e.target.value)}
                  className="w-full text-sm font-mono border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRestoreModalBackup(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring || confirmSlugInput.trim() !== slug}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isRestoring ? 'Restoring State...' : 'Confirm & Restore State'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
