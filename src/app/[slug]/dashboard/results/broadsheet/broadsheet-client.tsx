'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ClassCoverageResult } from '@/lib/results';
import ReportCardAssessmentsEditor from './report-card-assessments-editor';
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_TRAITS,
  isTraitRatingsComplete,
  type TraitRatings,
} from '@/lib/report-card-domains';

interface MatrixRow {
  studentId: string;
  studentName: string;
  subjects: Record<
    string,
    { total?: number; grade?: string | null; status?: string; notApplicable?: boolean } | null
  >;
  totalScore: number;
  averageScore: number;
  attendance: {
    presentDays: number;
    totalSchoolDays: number | null;
    percentage: number | null;
  };
}

interface BroadsheetClientProps {
  slug: string;
  isAdmin?: boolean;
  classLevelId: string;
  className: string;
  termId: string;
  termName: string;
  coverage: ClassCoverageResult;
  rows: MatrixRow[];
  canReview: boolean;
  existingReview: {
    id: string;
    overallRemarks: string | null;
    submittedToAdminAt: Date | null;
    formTeacherName: string;
  } | null;
  canEditAssessments: boolean;
  initialStudentAssessments: Array<{
    studentId: string;
    studentName: string;
    affectiveRatings: TraitRatings;
    psychomotorRatings: TraitRatings;
  }>;
}

export default function BroadsheetClient({
  slug,
  isAdmin = false,
  classLevelId,
  className,
  termId,
  termName,
  coverage,
  rows,
  canReview,
  existingReview,
  canEditAssessments,
  initialStudentAssessments,
}: BroadsheetClientProps) {
  const [remarks, setRemarks] = useState(existingReview?.overallRemarks || '');
  const [submitting, setSubmitting] = useState(false);
  const [removingSubjectId, setRemovingSubjectId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [studentAssessments, setStudentAssessments] = useState(initialStudentAssessments);

  const handleRemoveSubjectFromClass = async (subjectId: string, subjectName: string) => {
    if (
      !confirm(
        `Remove "${subjectName}" from ${className} for this session (and clear any saved ${subjectName} scores in ${className})?\n\nOther classes offering ${subjectName} will NOT be affected.`
      )
    ) {
      return;
    }
    setRemovingSubjectId(subjectId);
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
        setRemovingSubjectId(null);
        return;
      }
      window.location.reload();
    } catch {
      setMessage({ text: 'Network error while removing subject from class', error: true });
      setRemovingSubjectId(null);
    }
  };

  const isSubmittedToAdmin = Boolean(existingReview?.submittedToAdminAt);
  const assessmentsComplete = studentAssessments.length > 0 && studentAssessments.every((student) =>
    isTraitRatingsComplete(student.affectiveRatings, AFFECTIVE_TRAITS) &&
    isTraitRatingsComplete(student.psychomotorRatings, PSYCHOMOTOR_TRAITS)
  );

  const handleSubmitReview = async () => {
    if (!coverage.isComplete) {
      setMessage({
        text: 'Cannot submit review: every assigned subject must be submitted first.',
        error: true,
      });
      return;
    }
    if (!assessmentsComplete) {
      setMessage({ text: 'Complete and save all student report card ratings before submitting to the school administrator.', error: true });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/tenant/results/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          classLevelId,
          termId,
          overallRemarks: remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to submit review', error: true });
      } else {
        setMessage({ text: data.message, error: false });
        window.location.reload();
      }
    } catch {
      setMessage({ text: 'Network error occurred', error: true });
    } finally {
      setSubmitting(false);
    }
  };

  const percentComplete =
    coverage.totalExpected > 0
      ? Math.round((coverage.submittedCount / coverage.totalExpected) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href={`/${slug}/dashboard/results`} className="hover:text-blue-600">
              Results
            </Link>
            <span>/</span>
            <span>{className}</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Broadsheet</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {className} Compiled Broadsheet
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Academic Term: <span className="font-semibold text-slate-700">{termName}</span>
          </p>
        </div>

        {isSubmittedToAdmin && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            ✓ Submitted to Admin on {new Date(existingReview!.submittedToAdminAt!).toLocaleDateString()}
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

      {/* SUBMISSION COVERAGE BANNER (§5.2) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Subject Submission Coverage Checklist
            </h3>
            <p className="text-xs text-slate-500">
              {coverage.submittedCount} of {coverage.totalExpected} expected student scores submitted ({percentComplete}%)
            </p>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                coverage.isComplete
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {coverage.isComplete ? 'All Subjects Submitted' : `${coverage.missingCount} Scores Missing`}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              coverage.isComplete ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${percentComplete}%` }}
          />
        </div>

        {/* Subject Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2">
          {coverage.subjects.map((s) =>
            isAdmin ? (
              <div
                key={s.subjectId}
                className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between transition hover:border-blue-400 hover:shadow-2xs ${
                  s.isComplete
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <Link
                    href={`/${slug}/dashboard/results/entry?classLevelId=${classLevelId}&subjectId=${s.subjectId}&termId=${termId}`}
                    className="font-semibold truncate hover:underline"
                    title="Open subject scores"
                  >
                    {s.subjectName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubjectFromClass(s.subjectId, s.subjectName)}
                    disabled={removingSubjectId === s.subjectId}
                    title={`Remove ${s.subjectName} from ${className} only`}
                    className="text-slate-400 hover:text-rose-600 font-bold leading-none px-1 cursor-pointer disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between text-2xs opacity-80">
                  <span>{s.submittedCount}/{s.totalStudents}</span>
                  <Link
                    href={`/${slug}/dashboard/results/entry?classLevelId=${classLevelId}&subjectId=${s.subjectId}&termId=${termId}`}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    Manage →
                  </Link>
                </div>
              </div>
            ) : (
              <div
                key={s.subjectId}
                className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  s.isComplete
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="font-semibold truncate">{s.subjectName}</div>
                <div className="mt-1 flex items-center justify-between text-2xs opacity-80">
                  <span>{s.submittedCount}/{s.totalStudents}</span>
                  <span>{s.isComplete ? '✓' : 'Pending'}</span>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* COMPILED BROADSHEET TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Student Results Matrix</h3>
          <span className="text-xs text-slate-500">{rows.length} Students Enrolled</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Student Name</th>
                {coverage.subjects.map((sub) => (
                  <th key={sub.subjectId} className="py-3 px-3 text-center whitespace-nowrap">
                    {sub.subjectName}
                  </th>
                ))}
                <th className="py-3 px-3 text-center font-bold text-slate-900">Total</th>
                <th className="py-3 px-3 text-center font-bold text-slate-900">Average</th>
                <th className="py-3 px-3 text-center font-bold text-blue-700">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={row.studentId} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                    {row.studentName}
                  </td>
                  {coverage.subjects.map((sub) => {
                    const cell = row.subjects[sub.subjectId];
                    if (cell?.notApplicable) {
                      return (
                        <td key={sub.subjectId} className="py-2.5 px-3 text-center">
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-semibold text-slate-400 bg-slate-100 select-none"
                            title="Not applicable for student's department"
                          >
                            N/A
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={sub.subjectId} className="py-2.5 px-3 text-center font-mono">
                        {cell ? (
                          <span>
                            <span className="font-bold text-slate-900">{cell.total}</span>{' '}
                            <span className="text-blue-600 font-bold text-2xs">({cell.grade})</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 font-sans" title="Pending score submission">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 bg-slate-50/50">
                    {row.totalScore}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 bg-slate-50/50">
                    {row.averageScore}%
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-xs whitespace-nowrap">
                    {row.attendance.percentage !== null ? (
                      <span className="font-bold text-emerald-700">
                        {row.attendance.presentDays}/{row.attendance.totalSchoolDays} ({row.attendance.percentage}%)
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        {row.attendance.presentDays} days
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM TEACHER REVIEW & SUBMIT TO ADMIN (§5.2) */}
      {canReview && (
        <div className="space-y-6">
          <ReportCardAssessmentsEditor
            slug={slug}
            classLevelId={classLevelId}
            termId={termId}
            canEdit={canEditAssessments}
            students={studentAssessments}
            onSaved={setStudentAssessments}
          />
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Form Teacher's Overall Class Remarks & Submission
          </h3>
          <p className="text-xs text-slate-500">
            Add general remarks for the class broadsheet before forwarding to the School Administrator for publishing.
          </p>

          <div>
            <textarea
              disabled={isSubmittedToAdmin}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. A very commendable performance overall with impressive academic progress in sciences..."
              rows={3}
              className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div>
              {!coverage.isComplete && (
                <span className="text-xs font-semibold text-amber-700">
                  Submission to Admin is disabled until all {coverage.subjects.length} subjects are submitted.
                </span>
              )}
              {coverage.isComplete && !assessmentsComplete && (
                <span className="block text-xs font-semibold text-amber-700">
                  Save complete Affective and Psychomotor ratings for every student before submitting.
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmitReview}
              disabled={submitting || !coverage.isComplete || !assessmentsComplete || isSubmittedToAdmin}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-40 whitespace-nowrap self-end sm:self-auto"
            >
              {submitting ? 'Submitting to Admin...' : isSubmittedToAdmin ? 'Submitted to Admin' : 'Submit Review to Admin →'}
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
