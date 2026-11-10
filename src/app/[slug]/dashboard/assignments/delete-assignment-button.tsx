'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteAssignmentButtonProps {
  slug: string;
  assignmentId: string;
  title: string;
}

export function DeleteAssignmentButton({
  slug,
  assignmentId,
  title,
}: DeleteAssignmentButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenant/assignments?slug=${slug}&id=${assignmentId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove assignment');
      }

      setShowConfirm(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Error removing teaching assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
        title="Remove Teaching Assignment"
      >
        Delete Remove
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn text-slate-800 text-left">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-lg mx-auto">
              
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Remove Teaching Assignment</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to unassign <strong className="text-slate-900">{title}</strong>?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="w-1/2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="w-1/2 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition flex items-center justify-center gap-1 cursor-pointer"
              >
                {loading ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
