'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface VerificationItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  termId: string;
  termName: string;
  amount: number;
  senderName: string;
  bankName: string;
  transactionRef: string | null;
  proofUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export function VerificationsClient({ slug, schoolName }: { slug: string; schoolName: string }) {
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  // Rejection modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Amount not reflected on school bank account.');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenant/fees/verifications?slug=${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch verifications');
      setVerifications(data.verifications || []);
    } catch (err: any) {
      setError(err.message || 'Error loading verifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, [slug]);

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      setFeedback(null);

      const res = await fetch(`/api/tenant/fees/verifications?slug=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId: id, action: 'approve' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      setFeedback({ text: 'Payment verified! Student ledger credited and clearance granted.', type: 'success' });
      fetchVerifications();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to approve payment', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;

    try {
      setActionLoading(rejectingId);
      setFeedback(null);

      const res = await fetch(`/api/tenant/fees/verifications?slug=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId: rejectingId,
          action: 'reject',
          rejectionReason: rejectReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rejection failed');

      setFeedback({ text: 'Payment verification marked as rejected.', type: 'success' });
      setRejectingId(null);
      fetchVerifications();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to reject verification', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = verifications.filter((v) => {
    if (activeTab === 'all') return true;
    return v.status === activeTab;
  });

  const pendingCount = verifications.filter((v) => v.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-lg">🏦</span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Offline Bank Transfer Verifications</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Review parent-submitted bank transfer receipts for schools without direct Paystack integration. Approving immediately credits the fee ledger and unlocks exam result access.
          </p>
        </div>

        <Link
          href={`/${slug}/dashboard/fees`}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors shrink-0"
        >
          ← School Fees Ledger
        </Link>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 px-4 text-xs font-bold transition-all relative ${
            activeTab === 'pending'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Pending Verifications
          {pendingCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('approved')}
          className={`pb-3 px-4 text-xs font-bold transition-all relative ${
            activeTab === 'approved'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Approved Transfers
        </button>

        <button
          onClick={() => setActiveTab('rejected')}
          className={`pb-3 px-4 text-xs font-bold transition-all relative ${
            activeTab === 'rejected'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Rejected
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-4 text-xs font-bold transition-all relative ${
            activeTab === 'all'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          All Submissions
        </button>
      </div>

      {/* Verifications Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs font-mono">Loading payment verifications...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">📋</span>
            <p className="text-sm font-bold text-slate-800">No {activeTab} payment verifications found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              When parents or students submit offline bank transfer receipts through the result checker portal, they will appear here for bursar review.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Student &amp; Class</th>
                  <th className="py-3 px-4">Term</th>
                  <th className="py-3 px-4">Amount Claimed</th>
                  <th className="py-3 px-4">Sender / Bank</th>
                  <th className="py-3 px-4">Receipt Proof</th>
                  <th className="py-3 px-4">Date Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{item.studentName}</span>
                      <span className="text-[11px] text-slate-500">{item.className}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {item.termName}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                      ₦{item.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">{item.senderName}</span>
                      <span className="text-[11px] text-slate-500">{item.bankName}</span>
                      {item.transactionRef && (
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">Ref: {item.transactionRef}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.proofUrl ? (
                        <button
                          type="button"
                          onClick={() => setSelectedProof(item.proofUrl)}
                          className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>📄 View Proof</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No file attached</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(item.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase tracking-wider">
                          Pending Review
                        </span>
                      )}
                      {item.status === 'approved' && (
                        <div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider">
                            ✓ Approved
                          </span>
                          {item.reviewerName && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">by {item.reviewerName}</span>
                          )}
                        </div>
                      )}
                      {item.status === 'rejected' && (
                        <div>
                          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold text-[10px] uppercase tracking-wider">
                            ✕ Rejected
                          </span>
                          {item.rejectionReason && (
                            <span className="text-[10px] text-red-600 block mt-0.5 max-w-xs truncate">{item.rejectionReason}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.status === 'pending' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={actionLoading === item.id}
                            onClick={() => handleApprove(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoading === item.id ? 'Approving...' : 'Approve & Clear'}
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading === item.id}
                            onClick={() => setRejectingId(item.id)}
                            className="px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PROOF IMAGE MODAL */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Bank Transfer Receipt Proof</h3>
              <button
                onClick={() => setSelectedProof(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-50 p-2 rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedProof}
                alt="Payment Receipt"
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
              />
            </div>

            <div className="text-right">
              <button
                onClick={() => setSelectedProof(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Reject Payment Verification</h3>
            <p className="text-xs text-slate-500">Provide an explanation for rejecting this bank transfer receipt:</p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="e.g. Transaction reference not found on bank statement..."
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === rejectingId}
                onClick={handleReject}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {actionLoading === rejectingId ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
