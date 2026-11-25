'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface TeacherAssignmentItem {
  id: string;
  classLevelId: string;
  className: string;
  subjectId: string;
  subjectName: string;
}

interface ClassSummaryItem {
  classLevelId: string;
  classLevelName: string;
  assignedSubjects: number;
  enrolledStudents: number;
  statusLabel: string;
  isPublished: boolean;
  isReviewed: boolean;
  formTeacherName: string;
  reviewNotes?: string | null;
  submittedToAdminAt?: string | null;
}

interface ResultsOverviewClientProps {
  slug: string;
  role: string;
  terms: Array<{ id: string; name: string; isCurrent: boolean }>;
  currentTermId?: string;
  teacherAssignments: TeacherAssignmentItem[];
  formTeacherClasses: Array<{ classLevelId: string; className: string }>;
  classSummaries: ClassSummaryItem[];
}

export default function ResultsOverviewClient({
  slug,
  role,
  terms,
  currentTermId,
  teacherAssignments,
  formTeacherClasses,
  classSummaries,
}: ResultsOverviewClientProps) {
  const [selectedTermId, setSelectedTermId] = useState<string>(currentTermId || terms[0]?.id || '');
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Modal states for Admin Publish, Bulk Publish, Reopen, and Form Teacher Feedback
  const [publishModalClass, setPublishModalClass] = useState<ClassSummaryItem | null>(null);
  const [reopenModalClass, setReopenModalClass] = useState<ClassSummaryItem | null>(null);
  const [feedbackModalClass, setFeedbackModalClass] = useState<ClassSummaryItem | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleSelectClass = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllUnpublished = () => {
    const unpublished = classSummaries.filter((c) => !c.isPublished).map((c) => c.classLevelId);
    if (selectedClassIds.length === unpublished.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(unpublished);
    }
  };

  const handleBulkPublish = async () => {
    if (selectedClassIds.length === 0) return;
    setIsProcessing(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/tenant/results/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          classLevelIds: selectedClassIds,
          termId: selectedTermId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || 'Failed to bulk publish results', error: true });
      } else {
        setActionMessage({ text: data.message, error: false });
        setSelectedClassIds([]);
        window.location.reload();
      }
    } catch {
      setActionMessage({ text: 'Network error occurred during bulk publish', error: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePublish = async () => {
    if (!publishModalClass) return;
    setIsProcessing(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/tenant/results/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          classLevelId: publishModalClass.classLevelId,
          termId: selectedTermId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || 'Failed to publish results', error: true });
      } else {
        setActionMessage({ text: data.message, error: false });
        setPublishModalClass(null);
        window.location.reload();
      }
    } catch {
      setActionMessage({ text: 'Network error occurred', error: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenModalClass || !reopenReason) return;
    setIsProcessing(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/tenant/results/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          classLevelId: reopenModalClass.classLevelId,
          termId: selectedTermId,
          reason: reopenReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || 'Failed to reopen results', error: true });
      } else {
        setActionMessage({ text: data.message, error: false });
        setReopenModalClass(null);
        setReopenReason('');
        window.location.reload();
      }
    } catch {
      setActionMessage({ text: 'Network error occurred', error: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackModalClass || !feedbackNotes.trim()) return;
    setIsProcessing(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/tenant/results/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          action: 'request_corrections',
          classLevelId: feedbackModalClass.classLevelId,
          termId: selectedTermId,
          feedbackNotes: feedbackNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || 'Failed to send feedback', error: true });
      } else {
        setActionMessage({ text: data.message, error: false });
        setFeedbackModalClass(null);
        setFeedbackNotes('');
        window.location.reload();
      }
    } catch {
      setActionMessage({ text: 'Network error occurred', error: true });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Term Selector & Quick Operations Links */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Academic Term:</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="rounded-lg border border-slate-300 text-sm font-medium px-3 py-1.5 bg-slate-50 focus:bg-white"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.isCurrent ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Quick Links */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${slug}/dashboard/results/report-cards?termId=${selectedTermId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L19 7.5V19a2 2 0 01-2 2z" />
              </svg>
              <span>Terminal Report Cards</span>
            </Link>

            {role === 'school_admin' && (
              <>
                <Link
                  href={`/${slug}/dashboard/results/pins`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  <span>Result PIN Manager</span>
                </Link>

                <Link
                  href={`/${slug}/dashboard/grading`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Grading Scale Setup</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {actionMessage && (
          <div
            className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
              actionMessage.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* TEACHER WORKSPACE */}
      {teacherAssignments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Your Assigned Subjects & Classes</h2>
            <p className="text-xs text-slate-500 mt-1">
              Select an assigned class and subject to enter CA tests and exam scores.
            </p>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacherAssignments.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-slate-200 p-4 hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {a.className}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base mt-2">{a.subjectName}</h3>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Link
                    href={`/${slug}/dashboard/results/entry?classLevelId=${a.classLevelId}&subjectId=${a.subjectId}&termId=${selectedTermId}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Enter Scores →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORM TEACHER BROADSHEET ACCESS (Supports 1 or multiple form classes) */}
      {formTeacherClasses.length > 0 && (
        <div className="space-y-3">
          {formTeacherClasses.map((ftc) => (
            <div
              key={ftc.classLevelId}
              className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                    Form Teacher
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {ftc.className} Broadsheet &amp; Class Review
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Monitor subject submission progress, review compiled results, and submit remarks to the School Admin.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/${slug}/dashboard/results/broadsheet?classLevelId=${ftc.classLevelId}&termId=${selectedTermId}`}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap text-center shadow-xs"
                >
                  Open Class Broadsheet →
                </Link>
                <Link
                  href={`/${slug}/dashboard/results/report-cards?classLevelId=${ftc.classLevelId}&termId=${selectedTermId}`}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap text-center shadow-xs"
                >
                  Terminal Report Cards →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SCHOOL ADMIN CONTROL PLANE */}
      {role === 'school_admin' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">School Class Results Broadsheets & Publishing</h2>
              <p className="text-xs text-slate-500 mt-1">
                Track results progress across all levels, review class broadsheets, send corrections feedback, and execute individual or bulk publishing.
              </p>
            </div>

            {/* Bulk Action Controls */}
            {selectedClassIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                  {selectedClassIds.length} classes selected
                </span>
                <button
                  type="button"
                  onClick={handleBulkPublish}
                  disabled={isProcessing}
                  className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Publishing...' : 'Bulk Publish Selected Classes'}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedClassIds.length > 0 &&
                        selectedClassIds.length === classSummaries.filter((c) => !c.isPublished).length
                      }
                      onChange={handleSelectAllUnpublished}
                      title="Select all unpublished classes"
                      className="rounded text-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Class Level</th>
                  <th className="py-3 px-4">Students</th>
                  <th className="py-3 px-4">Subjects</th>
                  <th className="py-3 px-4">Form Teacher</th>
                  <th className="py-3 px-4">Lifecycle Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classSummaries.map((c) => (
                  <tr key={c.classLevelId} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-center">
                      {!c.isPublished ? (
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(c.classLevelId)}
                          onChange={() => toggleSelectClass(c.classLevelId)}
                          className="rounded text-blue-600 cursor-pointer"
                        />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{c.classLevelName}</td>
                    <td className="py-3 px-4 text-slate-600">{c.enrolledStudents} students</td>
                    <td className="py-3 px-4 text-slate-600">{c.assignedSubjects} subjects</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{c.formTeacherName}</td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            c.isPublished
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : c.isReviewed
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.statusLabel}
                        </span>
                        {c.reviewNotes && !c.isPublished && (
                          <p className="text-[10px] text-slate-500 italic max-w-xs truncate" title={c.reviewNotes}>
                            Note: {c.reviewNotes}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <Link
                        href={`/${slug}/dashboard/results/broadsheet?classLevelId=${c.classLevelId}&termId=${selectedTermId}`}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 inline-block"
                      >
                        Broadsheet
                      </Link>

                      {c.isPublished && (
                        <Link
                          href={`/${slug}/dashboard/results/report-cards?classLevelId=${c.classLevelId}&termId=${selectedTermId}`}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 inline-block shadow-2xs"
                        >
                          Report Cards
                        </Link>
                      )}

                      {c.isReviewed && !c.isPublished && (
                        <button
                          type="button"
                          onClick={() => setFeedbackModalClass(c)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer"
                          title="Send corrections notes back to form teacher"
                        >
                          Send Feedback
                        </button>
                      )}

                      {!c.isPublished ? (
                        <button
                          type="button"
                          onClick={() => setPublishModalClass(c)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReopenModalClass(c)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 cursor-pointer"
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PUBLISH CONFIRMATION MODAL */}
      {publishModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Publish Results for {publishModalClass.classLevelName}?
            </h3>
            <div className="text-xs text-slate-600 space-y-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-semibold text-amber-900">Permanent Grade Freeze Policy:</p>
              <p>
                Publishing will compute each student's letter grade using the currently active grading scale and
                permanently freeze it onto the result record.
              </p>
              <p>
                Once published, report cards become available and scores cannot be edited without an explicit logged
                admin reopen action.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPublishModalClass(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                {isProcessing ? 'Freezing & Publishing...' : 'Confirm Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REOPEN MODAL */}
      {reopenModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Reopen Results for {reopenModalClass.classLevelName}
            </h3>
            <p className="text-xs text-slate-600">
              Reopening unlocks result entries and unfreezes grades so teachers can make authorized corrections. An audit
              log entry is required.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Reopening (Mandatory for Audit Trail):
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Teacher requested correction for Exam score computation..."
                rows={3}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReopenModalClass(null);
                  setReopenReason('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopen}
                disabled={isProcessing || reopenReason.trim().length < 5}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? 'Reopening...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND FEEDBACK MODAL (ADMIN -> FORM TEACHER) */}
      {feedbackModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Send Review Feedback to Form Teacher
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                {feedbackModalClass.classLevelName}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Form Teacher: <strong>{feedbackModalClass.formTeacherName}</strong>
            </p>
            {feedbackModalClass.reviewNotes && (
              <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700">
                <span className="font-semibold block text-[10px] uppercase text-slate-400">Current Remarks:</span>
                {feedbackModalClass.reviewNotes}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Correction Instructions / Feedback Notes *:
              </label>
              <textarea
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="e.g. Please verify student test scores in Mathematics before final approval..."
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFeedbackModalClass(null);
                  setFeedbackNotes('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendFeedback}
                disabled={isProcessing || !feedbackNotes.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? 'Sending Feedback...' : 'Send Feedback & Return Broadsheet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
