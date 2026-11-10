'use client';

import React, { useMemo, useState } from 'react';
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_TRAITS,
  isTraitRatingsComplete,
  type TraitRatings,
} from '@/lib/report-card-domains';

interface StudentAssessment {
  studentId: string;
  studentName: string;
  affectiveRatings: TraitRatings;
  psychomotorRatings: TraitRatings;
  remarks?: string;
}

interface ReportCardAssessmentsEditorProps {
  slug: string;
  classLevelId: string;
  termId: string;
  canEdit: boolean;
  students: StudentAssessment[];
  onSaved: (students: StudentAssessment[]) => void;
}

const SMART_REMARK_TEMPLATES = [
  'An outstanding performance! Keep up the commendable excellence.',
  'A very good result. Shows dedication and good conduct in class.',
  'Good performance. Capable of higher achievement with more concentration.',
  'Fair effort this term. Needs more dedication and intensive study.',
  'Has shown steady improvement. Maintain focus in the coming term.',
];

const ratingGuide = [
  { value: 5, label: 'Excellent, consistently demonstrated' },
  { value: 4, label: 'Very good, usually demonstrated' },
  { value: 3, label: 'Satisfactory, demonstrated at expected level' },
  { value: 2, label: 'Developing, needs reminders or support' },
  { value: 1, label: 'Needs significant support' },
];

export default function ReportCardAssessmentsEditor({
  slug,
  classLevelId,
  termId,
  canEdit,
  students: initialStudents,
  onSaved,
}: ReportCardAssessmentsEditorProps) {
  const [students, setStudents] = useState(initialStudents);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const completedCount = useMemo(
    () => students.filter((student) =>
      isTraitRatingsComplete(student.affectiveRatings, AFFECTIVE_TRAITS) &&
      isTraitRatingsComplete(student.psychomotorRatings, PSYCHOMOTOR_TRAITS)
    ).length,
    [students]
  );

  const updateRating = (
    studentId: string,
    domain: 'affectiveRatings' | 'psychomotorRatings',
    trait: string,
    value: number | null
  ) => {
    setStudents((current) => current.map((student) => student.studentId === studentId
      ? { ...student, [domain]: { ...student[domain], [trait]: value } }
      : student
    ));
    setMessage(null);
  };

  const updateRemark = (studentId: string, remarks: string) => {
    setStudents((current) => current.map((student) => student.studentId === studentId
      ? { ...student, remarks }
      : student
    ));
    setMessage(null);
  };

  const saveRatings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/tenant/results/report-card-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, classLevelId, termId, assessments: students }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save report card ratings');
      onSaved(students);
      setMessage({ text: `Saved ratings for ${data.savedCount} students.` });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Network error while saving ratings',
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const renderDomain = (
    student: StudentAssessment,
    title: string,
    domain: 'affectiveRatings' | 'psychomotorRatings',
    traits: readonly string[]
  ) => (
    <section className="rounded-lg border border-slate-200 overflow-hidden">
      <h4 className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-700">
        {title}
      </h4>
      <div className="divide-y divide-slate-100">
        {traits.map((trait) => (
          <label key={trait} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-3 px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">{trait}</span>
            <select
              aria-label={`${student.studentName}: ${trait} rating`}
              value={student[domain][trait] ?? ''}
              disabled={!canEdit || saving}
              onChange={(event) => updateRating(
                student.studentId,
                domain,
                trait,
                event.target.value ? Number(event.target.value) : null
              )}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 disabled:bg-slate-100"
            >
              <option value="">Select score</option>
              {[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score}</option>)}
            </select>
          </label>
        ))}
      </div>
    </section>
  );

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Student Report Card Ratings</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            Rate each student’s observable affective and practical skills from 1 to 5. These are individual teacher assessments and are not calculated from academic scores.
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            {completedCount} of {students.length} students have all {AFFECTIVE_TRAITS.length + PSYCHOMOTOR_TRAITS.length} ratings complete.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={saveRatings}
            disabled={saving || students.length === 0}
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Saving ratings…' : 'Save ratings'}
          </button>
        )}
      </div>

      <div className="px-5 sm:px-6 py-4 bg-amber-50/70 border-b border-amber-100">
        <p className="text-[11px] font-bold text-slate-700">Rating guide</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600">
          {ratingGuide.map((item) => <span key={item.value}><strong>{item.value}</strong> — {item.label}</span>)}
        </div>
      </div>

      {message && (
        <div role="status" className={`mx-5 mt-4 rounded-lg border px-3 py-2 text-xs font-semibold ${
          message.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          {message.text}
        </div>
      )}

      {!canEdit && (
        <p className="mx-5 mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Ratings are read-only because this review has been submitted or the results are published. An administrator must return or reopen the class before they can be changed.
        </p>
      )}

      {students.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No active students are enrolled in this class for the selected session.</p>
      ) : (
        <div className="p-5 sm:p-6 space-y-2">
          {students.map((student) => {
            const complete = isTraitRatingsComplete(student.affectiveRatings, AFFECTIVE_TRAITS) &&
              isTraitRatingsComplete(student.psychomotorRatings, PSYCHOMOTOR_TRAITS);
            return (
              <details key={student.studentId} className="group rounded-lg border border-slate-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800">
                  <span>{student.studentName}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {complete ? 'Complete' : 'Ratings needed'}
                  </span>
                </summary>
                <div className="grid grid-cols-1 gap-4 border-t border-slate-200 bg-white p-4 xl:grid-cols-2">
                  {renderDomain(student, 'Affective Domain', 'affectiveRatings', AFFECTIVE_TRAITS)}
                  {renderDomain(student, 'Psychomotor Domain', 'psychomotorRatings', PSYCHOMOTOR_TRAITS)}
                </div>

                {/* Form Teacher's Individual Remark Section */}
                <div className="p-4 border-t border-slate-200 bg-slate-50/60 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span>Form Teacher's Individual Remark</span>
                      {student.remarks?.trim() ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Personalized
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          Optional (falls back to class remark)
                        </span>
                      )}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Prints on {student.studentName}'s report card
                    </span>
                  </div>

                  <textarea
                    rows={2}
                    value={student.remarks || ''}
                    disabled={!canEdit || saving}
                    onChange={(e) => updateRemark(student.studentId, e.target.value)}
                    placeholder={`e.g. ${student.studentName.split(' ')[0]} is an attentive and hardworking student. Commendable performance throughout the term.`}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                  />

                  {/* Smart Suggestion Chips */}
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-bold text-slate-500 mr-1">Quick Suggestions:</span>
                      {SMART_REMARK_TEMPLATES.map((tmpl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => updateRemark(student.studentId, tmpl)}
                          className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-600 rounded-lg border border-slate-200 transition cursor-pointer"
                        >
                          {tmpl.split('.')[0]}…
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
