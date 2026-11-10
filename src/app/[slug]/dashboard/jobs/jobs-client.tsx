'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface BackgroundJobItem {
  id: string;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  payload: any;
  progress: number;
  result: any;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobsClientProps {
  slug: string;
  tenantName: string;
  isSchoolAdmin: boolean;
  initialData: {
    jobs: BackgroundJobItem[];
    totalCount: number;
    totalPages: number;
    page: number;
    pageSize: number;
  };
}

export default function JobsClient({
  slug,
  tenantName,
  isSchoolAdmin,
  initialData,
}: JobsClientProps) {
  const [jobs, setJobs] = useState<BackgroundJobItem[]>(initialData.jobs);
  const [selectedJob, setSelectedJob] = useState<BackgroundJobItem | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ slug });
      if (filterType !== 'ALL') params.set('type', filterType);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);

      const res = await fetch(`/api/tenant/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error('Failed to poll background jobs:', err);
    }
  }, [slug, filterType, filterStatus]);

  // Auto-polling when there are active (queued or processing) jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (j) => j.status === 'queued' || j.status === 'processing'
    );

    if (hasActiveJobs) {
      const interval = setInterval(() => {
        fetchJobs();
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [jobs, fetchJobs]);

  const handleRetry = async (jobId: string) => {
    if (!isSchoolAdmin) return;
    setRetryingId(jobId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/tenant/jobs/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage('Job has been re-enqueued for execution.');
        await fetchJobs();
      } else {
        setActionMessage(`Retry failed: ${data.error || 'Server error'}`);
      }
    } catch (err: any) {
      setActionMessage(`Network error: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const formatJobType = (type: string) => {
    switch (type) {
      case 'bulk_report_cards':
        return 'Bulk Report Cards';
      case 'bulk_sms_dispatch':
        return 'Bulk SMS Dispatch';
      case 'bulk_whatsapp_dispatch':
        return 'Bulk WhatsApp Dispatch';
      case 'data_export':
        return 'Data Export';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full"></span>
            Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 mr-1.5 bg-blue-500 rounded-full animate-ping"></span>
            Processing
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 mr-1.5 bg-amber-500 rounded-full"></span>
            Queued
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 mr-1.5 bg-rose-500 rounded-full"></span>
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (filterType !== 'ALL' && j.type !== filterType) return false;
    if (filterStatus !== 'ALL' && j.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Background Tasks & Processing Queue
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Phase 3 Architecture
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Asynchronous task queue for bulk report card compilation, SMS broadcasts, and data exports in{' '}
            <span className="font-semibold text-slate-700">{tenantName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsLoading(true);
              fetchJobs().finally(() => setIsLoading(false));
            }}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg
              className={`w-4 h-4 mr-2 text-slate-500 ${isLoading ? 'animate-spin' : ''}`}
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
            Refresh
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-blue-500 hover:text-blue-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Task Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            >
              <option value="ALL">All Task Types</option>
              <option value="bulk_report_cards">Bulk Report Cards</option>
              <option value="bulk_sms_dispatch">Bulk SMS Dispatch</option>
              <option value="bulk_whatsapp_dispatch">Bulk WhatsApp Dispatch</option>
              <option value="data_export">Data Export</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Execution Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-slate-500 font-medium">
          Showing <span className="font-semibold text-slate-800">{filteredJobs.length}</span> recorded tasks
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No background tasks found</h3>
            <p className="mt-1 text-sm text-slate-500">
              When heavy operations like bulk report card generation or broadsheet exports run, their progress will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Task / ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Attempts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{formatJobType(job.type)}</div>
                      <div className="text-xs text-slate-400 font-mono">{job.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(job.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap w-48">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                          <span>{job.progress}%</span>
                          {job.status === 'processing' && (
                            <span className="text-blue-600 animate-pulse font-normal">Working...</span>
                          )}
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              job.status === 'completed'
                                ? 'bg-emerald-500'
                                : job.status === 'failed'
                                ? 'bg-rose-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.max(4, job.progress)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {job.attempts} / {job.maxAttempts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(job.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                      >
                        Details
                      </button>
                      {job.status === 'failed' && isSchoolAdmin && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={retryingId === job.id}
                          className="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          {retryingId === job.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{formatJobType(selectedJob.type)}</h3>
                <p className="text-xs text-slate-400 font-mono">Job ID: {selectedJob.id}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Status:</span>
                <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Progress:</span>
                <div className="mt-1 font-semibold text-slate-800">{selectedJob.progress}%</div>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Started At:</span>
                <div className="mt-1 text-slate-700">
                  {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : 'Not started'}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Completed At:</span>
                <div className="mt-1 text-slate-700">
                  {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : 'In progress / Pending'}
                </div>
              </div>
            </div>

            {selectedJob.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                <span className="font-bold">Error Message:</span> {selectedJob.error}
              </div>
            )}

            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Payload Parameters:</span>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs overflow-x-auto max-h-40">
                {JSON.stringify(selectedJob.payload, null, 2)}
              </pre>
            </div>

            {selectedJob.result && (
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Execution Result:</span>
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl text-xs overflow-x-auto max-h-48">
                  {JSON.stringify(selectedJob.result, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              {selectedJob.status === 'failed' && isSchoolAdmin && (
                <button
                  onClick={() => {
                    handleRetry(selectedJob.id);
                    setSelectedJob(null);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Retry Job
                </button>
              )}
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
