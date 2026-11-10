'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface StudentAttendanceItem {
  studentId: string;
  studentName: string;
  status: 'present' | 'absent' | 'late';
  isMarked: boolean;
}

interface AttendanceClientProps {
  slug: string;
  terms: Array<{ id: string; name: string; totalDays: number | null }>;
  currentTermId: string;
  totalSchoolDays: number | null;
  classes: Array<{ id: string; name: string }>;
  selectedClassId: string;
  initialDate: string;
  initialStudents: StudentAttendanceItem[];
  isLocked: boolean;
}

export default function AttendanceClient({
  slug,
  terms,
  currentTermId,
  totalSchoolDays,
  classes,
  selectedClassId,
  initialDate,
  initialStudents,
  isLocked,
}: AttendanceClientProps) {
  const router = useRouter();
  const [classId, setClassId] = useState(selectedClassId);
  const [termId, setTermId] = useState(currentTermId);
  const [date, setDate] = useState(initialDate);
  const [students, setStudents] = useState<StudentAttendanceItem[]>(initialStudents);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleClassOrDateChange = (newClassId: string, newDate: string, newTermId: string) => {
    setClassId(newClassId);
    setDate(newDate);
    setTermId(newTermId);
    router.push(`/dashboard/attendance?classLevelId=${newClassId}&date=${newDate}&termId=${newTermId}`);
  };

  const handleStatusChange = (index: number, status: 'present' | 'absent' | 'late') => {
    const updated = [...students];
    updated[index] = { ...updated[index], status, isMarked: true };
    setStudents(updated);
  };

  const markAll = (status: 'present' | 'absent') => {
    setStudents(students.map((s) => ({ ...s, status, isMarked: true })));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/tenant/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          classLevelId: classId,
          termId,
          date,
          records: students.map((s) => ({
            studentId: s.studentId,
            status: s.status,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to record attendance', error: true });
      } else {
        setMessage({ text: data.message, error: false });
        setStudents(students.map((s) => ({ ...s, isMarked: true })));
      }
    } catch {
      setMessage({ text: 'Network error occurred', error: true });
    } finally {
      setSaving(false);
    }
  };

  const presentCount = students.filter((s) => s.status === 'present' || s.status === 'late').length;

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-2xs uppercase font-bold text-slate-500 mb-1">Class</label>
            <select
              value={classId}
              onChange={(e) => handleClassOrDateChange(e.target.value, date, termId)}
              className="text-xs rounded-lg border-slate-300 font-semibold px-3 py-1.5 bg-slate-50 focus:bg-white"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-2xs uppercase font-bold text-slate-500 mb-1">Term</label>
            <select
              value={termId}
              onChange={(e) => handleClassOrDateChange(classId, date, e.target.value)}
              className="text-xs rounded-lg border-slate-300 font-semibold px-3 py-1.5 bg-slate-50 focus:bg-white"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-2xs uppercase font-bold text-slate-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleClassOrDateChange(classId, e.target.value, termId)}
              className="text-xs rounded-lg border border-slate-300 font-mono px-3 py-1.5 bg-slate-50 focus:bg-white"
            />
          </div>
        </div>

        {isLocked ? (
          <div className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 font-semibold">
            Term Results Published (Attendance Locked)
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => markAll('present')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Mark All Present
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Register'}
            </button>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold ${
            message.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Attendance Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Daily Attendance for {new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <span className="text-xs text-slate-500">
              {presentCount} of {students.length} students present today • Term total: {totalSchoolDays ?? 'not set'} school days
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Quick Toggles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s, idx) => (
                <tr key={s.studentId} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 text-sm whitespace-nowrap">
                    {s.studentName}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                        s.status === 'present'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : s.status === 'late'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleStatusChange(idx, 'present')}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                          s.status === 'present'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleStatusChange(idx, 'late')}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                          s.status === 'late'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                        }`}
                      >
                        Late
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleStatusChange(idx, 'absent')}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                          s.status === 'absent'
                            ? 'bg-red-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
