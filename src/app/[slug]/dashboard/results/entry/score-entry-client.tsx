'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { computeTotal, previewGrade, type GradingScaleLike } from '@/lib/grading';

interface ComponentDef {
  id: string;
  name: string;
  maxScore: number;
  weightPercent: number;
}

interface StudentRow {
  studentId: string;
  studentName: string;
  hasSavedEntry?: boolean;
  scores: Record<string, number | string>;
  total: number;
  previewGrade: string | null;
  comment: string;
  status: string;
}

interface ScoreEntryClientProps {
  slug: string;
  isAdmin?: boolean;
  classLevelId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  termName: string;
  components: ComponentDef[];
  gradingScales: GradingScaleLike[];
  classLevelOrderIndex: number;
  initialRows: StudentRow[];
  isLocked: boolean;
}

export default function ScoreEntryClient({
  slug,
  isAdmin = false,
  classLevelId,
  className,
  subjectId,
  subjectName,
  termId,
  termName,
  components,
  gradingScales,
  classLevelOrderIndex,
  initialRows,
  isLocked,
}: ScoreEntryClientProps) {
  const [rows, setRows] = useState<StudentRow[]>(initialRows);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [removingFromClass, setRemovingFromClass] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleDeleteEntry = async (studentId: string, studentName: string) => {
    if (!confirm(`Delete saved ${subjectName} result entry for ${studentName}? This removes this subject score from their record.`)) {
      return;
    }
    setDeletingId(studentId);
    setMessage(null);
    try {
      const qs = new URLSearchParams({ slug, termId, subjectId, studentId });
      const res = await fetch(`/api/tenant/results/entries?${qs.toString()}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to delete result entry', error: true });
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.studentId === studentId
            ? { ...r, hasSavedEntry: false, scores: {}, total: 0, previewGrade: null, comment: '', status: 'not_started' }
            : r
        )
      );
      setMessage({ text: data.message || `Deleted entry for ${studentName}.`, error: false });
    } catch {
      setMessage({ text: 'Network error while deleting result entry', error: true });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearSubjectScores = async () => {
    if (!confirm(`Clear ALL saved ${subjectName} scores for ${className} in ${termName}? This action is logged and cannot be undone.`)) {
      return;
    }
    setClearingAll(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams({ slug, termId, subjectId, classLevelId, clearAll: 'true' });
      const res = await fetch(`/api/tenant/results/entries?${qs.toString()}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to clear subject scores', error: true });
        return;
      }
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          hasSavedEntry: false,
          scores: {},
          total: 0,
          previewGrade: null,
          comment: '',
          status: 'not_started',
        }))
      );
      setMessage({ text: data.message || 'Cleared all subject scores.', error: false });
    } catch {
      setMessage({ text: 'Network error while clearing subject scores', error: true });
    } finally {
      setClearingAll(false);
    }
  };

  const handleRemoveSubjectFromClass = async () => {
    if (
      !confirm(
        `Remove "${subjectName}" from ${className} completely (and clear any saved ${subjectName} scores in ${className})?\n\nOther classes offering ${subjectName} will NOT be affected.`
      )
    ) {
      return;
    }
    setRemovingFromClass(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams({
        slug,
        termId,
        subjectId,
        classLevelId,
        clearAll: 'true',
        removeFromClass: 'true',
      });
      const res = await fetch(`/api/tenant/results/entries?${qs.toString()}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to remove subject from class', error: true });
        setRemovingFromClass(false);
        return;
      }
      window.location.href = `/${slug}/dashboard/results/broadsheet?classLevelId=${classLevelId}&termId=${termId}`;
    } catch {
      setMessage({ text: 'Network error while removing subject from class', error: true });
      setRemovingFromClass(false);
    }
  };

  const handleScoreChange = (studentIndex: number, compName: string, value: string) => {
    const updated = [...rows];
    const student = { ...updated[studentIndex] };
    const newScores = { ...student.scores, [compName]: value === '' ? '' : Number(value) };

    student.scores = newScores;
    student.total = computeTotal(newScores, components);
    student.previewGrade = previewGrade(
      student.total,
      classLevelOrderIndex,
      gradingScales
    ).grade;
    updated[studentIndex] = student;
    setRows(updated);
  };

  const handleCommentChange = (studentIndex: number, comment: string) => {
    const updated = [...rows];
    updated[studentIndex] = { ...updated[studentIndex], comment };
    setRows(updated);
  };

  const saveScores = async (markAsSubmitted: boolean) => {
    setSaving(true);
    setMessage(null);

    // Validate maxScores client-side before sending
    for (const r of rows) {
      for (const comp of components) {
        const val = r.scores[comp.id] ?? r.scores[comp.name] ?? r.scores[comp.name.toLowerCase()];
        if (val !== undefined && val !== '' && val !== null) {
          const num = Number(val);
          if (isNaN(num) || num < 0 || num > comp.maxScore) {
            setMessage({
              text: `Score for ${comp.name} on student "${r.studentName}" exceeds maximum of ${comp.maxScore}`,
              error: true,
            });
            setSaving(false);
            return;
          }
        }
      }
    }

    try {
      const payload = {
        slug,
        classLevelId,
        subjectId,
        termId,
        markAsSubmitted,
        entries: rows.map((r) => ({
          studentId: r.studentId,
          scores: r.scores,
          comment: r.comment,
        })),
      };

      const res = await fetch('/api/tenant/results/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to save scores', error: true });
      } else {
        setMessage({ text: data.message, error: false });
        // Update local statuses
        setRows(
          rows.map((r) => ({
            ...r,
            hasSavedEntry: true,
            status: markAsSubmitted ? 'submitted' : 'not_started',
          }))
        );
      }
    } catch {
      setMessage({ text: 'Network error occurred', error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href={`/${slug}/dashboard/results`} className="hover:text-blue-600">
              Results
            </Link>
            <span>/</span>
            <span>{className}</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">{subjectName}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {className} — {subjectName}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Academic Term: <span className="font-semibold text-slate-700">{termName}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && !isLocked && rows.some((r) => r.hasSavedEntry) && (
            <button
              type="button"
              onClick={handleClearSubjectScores}
              disabled={clearingAll || removingFromClass}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearingAll ? 'Clearing...' : 'Clear Subject Scores'}
            </button>
          )}
          {isAdmin && !isLocked && (
            <button
              type="button"
              onClick={handleRemoveSubjectFromClass}
              disabled={removingFromClass || clearingAll}
              title={`Unassign ${subjectName} from ${className} only (other classes are unaffected)`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {removingFromClass ? 'Removing...' : `Remove Subject from ${className}`}
            </button>
          )}
          {isLocked && (
            <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
              {isAdmin ? 'Results Published — Reopen Class to Edit/Delete' : 'Results Reviewed or Published (Read-Only)'}
            </div>
          )}
        </div>
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

      {/* Score Entry Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Student Name</th>
                {components.map((c) => (
                  <th key={c.id} className="py-3 px-4">
                    {c.name}
                    <span className="block text-2xs font-normal text-slate-400 normal-case">
                      Max {c.maxScore} ({c.weightPercent}%)
                    </span>
                  </th>
                ))}
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Preview Grade</th>
                <th className="py-3 px-4">Teacher Remark / Comment</th>
                <th className="py-3 px-4">Status</th>
                {isAdmin && !isLocked && <th className="py-3 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, sIdx) => (
                <tr key={r.studentId} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-xs text-slate-400">{sIdx + 1}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {r.studentName}
                  </td>
                  {components.map((c) => {
                    const val =
                      r.scores[c.id] ?? r.scores[c.name] ?? r.scores[c.name.toLowerCase()] ?? '';
                    return (
                      <td key={c.id} className="py-3 px-4">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={val}
                          onChange={(e) => handleScoreChange(sIdx, c.name, e.target.value)}
                          min={0}
                          max={c.maxScore}
                          className="w-20 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
                        />
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 font-bold text-slate-900 font-mono text-sm">
                    {r.total}
                  </td>
                  <td className="py-3 px-4">
                    {r.previewGrade ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">
                        {r.previewGrade}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      disabled={isLocked}
                      value={r.comment}
                      onChange={(e) => handleCommentChange(sIdx, e.target.value)}
                      placeholder="Optional comment..."
                      className="w-full min-w-40 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-blue-500 disabled:bg-slate-50"
                    />
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-full ${
                        r.status === 'submitted'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : r.status === 'form_teacher_reviewed'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : r.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  {isAdmin && !isLocked && (
                    <td className="py-3 px-4 text-right">
                      {r.hasSavedEntry ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(r.studentId, r.studentName)}
                          disabled={deletingId === r.studentId}
                          title="Delete this student's result entry"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{deletingId === r.studentId ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Controls */}
        {!isLocked && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {rows.length} Students in class register. Submit when all scores are verified.
            </span>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => saveScores(false)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={() => saveScores(true)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Submit to Form Teacher'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
