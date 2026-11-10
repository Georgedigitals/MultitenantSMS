'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AssignFormTeacherModalProps {
  slug: string;
  classLevels: Array<{ id: string; name: string }>;
  staffList: Array<{ id: string; name: string; roleBase: string }>;
  sessionId: string;
  initialClassLevelId?: string;
  triggerButton?: React.ReactNode;
}

export function AssignFormTeacherModal({
  slug,
  classLevels,
  staffList,
  sessionId,
  initialClassLevelId,
  triggerButton,
}: AssignFormTeacherModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [classLevelId, setClassLevelId] = useState(initialClassLevelId || classLevels[0]?.id || '');
  const [staffId, setStaffId] = useState(staffList[0]?.id || '');

  const handleOpen = () => {
    setClassLevelId(initialClassLevelId || classLevels[0]?.id || '');
    setStaffId(staffList[0]?.id || '');
    setError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    setError(null);
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!classLevelId) {
      setError('Please select a class level.');
      return;
    }
    if (!staffId) {
      setError('Please select a teacher.');
      return;
    }
    if (!sessionId) {
      setError('No active session found.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/tenant/form-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          staffId,
          classLevelId,
          sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign form teacher');
      }

      handleClose();
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred while assigning form teacher');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {triggerButton ? (
        <span onClick={handleOpen}>{triggerButton}</span>
      ) : (
        <button
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
        >
          Assign Form Teacher
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn text-left">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assign Form Teacher</h3>
                  <p className="text-xs text-slate-500">Assign active form teacher for this class session</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Class Level <span className="text-rose-500">*</span>
                </label>
                <select
                  value={classLevelId}
                  onChange={(e) => setClassLevelId(e.target.value)}
                  required
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition font-medium"
                >
                  {classLevels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Staff / Teacher <span className="text-rose-500">*</span>
                </label>
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  required
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition font-medium"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.roleBase})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Each class has exactly 1 active form teacher per academic session.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? 'Assigning...' : 'Confirm Form Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
