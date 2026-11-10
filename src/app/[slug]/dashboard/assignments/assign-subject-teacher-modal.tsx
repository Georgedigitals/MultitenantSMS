'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AssignSubjectTeacherModalProps {
  slug: string;
  classLevels: Array<{ id: string; name: string }>;
  staffList: Array<{ id: string; name: string; roleBase: string }>;
  subjects: Array<{ id: string; name: string }>;
  sessionId: string;
}

export function AssignSubjectTeacherModal({
  slug,
  classLevels,
  staffList,
  subjects,
  sessionId,
}: AssignSubjectTeacherModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [classLevelId, setClassLevelId] = useState(classLevels[0]?.id || '');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [staffId, setStaffId] = useState(staffList[0]?.id || '');

  const handleOpen = () => {
    setClassLevelId(classLevels[0]?.id || '');
    setSubjectId(subjects[0]?.id || '');
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
    if (!subjectId) {
      setError('Please select a subject.');
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
      const res = await fetch('/api/tenant/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          staffId,
          classLevelId,
          subjectId,
          sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create teaching assignment');
      }

      handleClose();
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating teaching assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all duration-150 active:scale-95 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Assign Subject Teacher
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn text-left">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assign Subject Teacher</h3>
                  <p className="text-xs text-slate-500">Pair a teacher with a class curriculum subject</p>
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-hidden transition font-medium"
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
                  Curriculum Subject <span className="text-rose-500">*</span>
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  required
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-hidden transition font-medium"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assigned Teacher / Staff <span className="text-rose-500">*</span>
                </label>
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  required
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-hidden transition font-medium"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.roleBase})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Once assigned, this teacher can enter scores and submit results for this subject and class.
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
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? 'Assigning...' : 'Assign Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
