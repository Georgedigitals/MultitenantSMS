'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Check, X, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import { DepartmentTrack } from '@/lib/curriculum-types';

interface StudentTrackBadgeProps {
  slug: string;
  studentId: string;
  studentName: string;
  classLevelName: string;
  currentTrack?: string | null;
  currentElectiveIds?: string[];
  availableElectiveSubjects?: Array<{ id: string; name: string; department?: string }>;
  isAdmin?: boolean;
}

const TRACK_CONFIG: Record<
  DepartmentTrack,
  { label: string; icon: string; bg: string; text: string; border: string; desc: string }
> = {
  science: {
    label: 'Science',
    icon: '🔬',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    desc: 'Core + Physics, Chemistry, Biology, Further Maths',
  },
  arts: {
    label: 'Arts & Humanities',
    icon: '🎨',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    desc: 'Core + Literature, Government, CRS/IRS, History',
  },
  commercial: {
    label: 'Commercial',
    icon: '📊',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    desc: 'Core + Accounting, Commerce, Economics',
  },
  general: {
    label: 'General / Core Only',
    icon: '📚',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    desc: 'Core mandatory subjects only',
  },
};

export function StudentTrackBadge({
  slug,
  studentId,
  studentName,
  classLevelName,
  currentTrack,
  currentElectiveIds = [],
  availableElectiveSubjects = [],
  isAdmin = false,
}: StudentTrackBadgeProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveTrack: DepartmentTrack =
    currentTrack && ['science', 'arts', 'commercial', 'general'].includes(currentTrack)
      ? (currentTrack as DepartmentTrack)
      : 'general';

  const [selectedTrack, setSelectedTrack] = useState<DepartmentTrack>(effectiveTrack);
  const [selectedElectives, setSelectedElectives] = useState<string[]>(currentElectiveIds);

  const trackInfo = TRACK_CONFIG[effectiveTrack] || TRACK_CONFIG.general;

  const handleOpen = () => {
    if (!isAdmin) return;
    setSelectedTrack(effectiveTrack);
    setSelectedElectives(currentElectiveIds);
    setError(null);
    setIsOpen(true);
  };

  const handleToggleElective = (subjectId: string) => {
    setSelectedElectives((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tenant/students/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          studentIds: [studentId],
          departmentTrack: selectedTrack,
          electiveSubjectIds: selectedElectives,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update department track');
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!isAdmin}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
          trackInfo.bg
        } ${trackInfo.text} ${trackInfo.border} ${
          isAdmin ? 'hover:shadow-xs hover:border-slate-400 cursor-pointer' : 'cursor-default'
        }`}
        title={isAdmin ? `Click to change academic track for ${studentName}` : undefined}
      >
        <span>{trackInfo.icon}</span>
        <span>{trackInfo.label}</span>
        {currentElectiveIds.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/80 font-mono font-bold">
            +{currentElectiveIds.length} electives
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Assign Academic Department Track</h3>
                  <p className="text-xs text-slate-500">
                    {studentName} • {classLevelName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Select Senior Department
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(TRACK_CONFIG) as DepartmentTrack[]).map((t) => {
                    const conf = TRACK_CONFIG[t];
                    const isSelected = selectedTrack === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTrack(t)}
                        className={`text-left p-3 rounded-xl border text-xs transition-all ${
                          isSelected
                            ? `${conf.bg} ${conf.border} ring-2 ring-blue-500 font-semibold`
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{conf.icon}</span>
                          <span className="font-bold text-slate-900">{conf.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{conf.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Elective Subject Selection */}
              {availableElectiveSubjects.length > 0 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                    Specific Elective Subjects for this Student
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {availableElectiveSubjects.map((sub) => {
                      const isChecked = selectedElectives.includes(sub.id);
                      return (
                        <label
                          key={sub.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 cursor-pointer text-xs"
                        >
                          <span className="font-medium text-slate-800">{sub.name}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleElective(sub.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Track</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

