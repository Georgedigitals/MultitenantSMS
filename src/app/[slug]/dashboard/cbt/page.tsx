'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Subject {
  id: string;
  name: string;
}

interface ClassLevel {
  id: string;
  name: string;
}

interface Term {
  id: string;
  name: string;
  session: { label: string };
}

interface CbtQuestion {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  points: number;
}

interface CbtExam {
  id: string;
  title: string;
  durationMins: number;
  totalMarks: number;
  isPublished: boolean;
  subject: Subject;
  classLevel: ClassLevel;
  term: Term;
  questions: CbtQuestion[];
  attempts: any[];
}

export default function CbtDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [hasFeature, setHasFeature] = useState(true);
  const [userRole, setUserRole] = useState<string>('school_admin');
  const [exams, setExams] = useState<CbtExam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);

  // Create Exam Form
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classLevelId, setClassLevelId] = useState('');
  const [termId, setTermId] = useState('');
  const [durationMins, setDurationMins] = useState(45);
  const [totalMarks] = useState(60);
  const [creatingExam, setCreatingExam] = useState(false);

  // Active Exam Builder Modal State
  const [activeExam, setActiveExam] = useState<CbtExam | null>(null);
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState('A');
  const [qPoints, setQPoints] = useState(5);
  const [addingQ, setAddingQ] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deletion States
  const [confirmDeleteExam, setConfirmDeleteExam] = useState<CbtExam | null>(null);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [attemptsExamId, setAttemptsExamId] = useState<string | null>(null);
  const [resettingAttemptId, setResettingAttemptId] = useState<string | null>(null);

  useEffect(() => {
    fetchCbtData();
  }, [slug]);

  async function fetchCbtData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/cbt?slug=${slug}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) setHasFeature(false);
        setLoading(false);
        return;
      }
      setHasFeature(data.hasFeature);
      if (data.userRole) setUserRole(data.userRole);
      setExams(data.exams || []);
      setSubjects(data.subjects || []);
      setClassLevels(data.classLevels || []);
      setTerms(data.terms || []);

      if (data.subjects?.length) setSubjectId(data.subjects[0].id);
      if (data.classLevels?.length) setClassLevelId(data.classLevels[0].id);
      if (data.terms?.length) setTermId(data.terms[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !subjectId || !classLevelId || !termId) return;
    setCreatingExam(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/tenant/cbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_exam',
          slug,
          examData: { title, subjectId, classLevelId, termId, durationMins, totalMarks },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create CBT exam');
      setFeedback({ type: 'success', text: 'CBT Exam created! Add questions to complete setup.' });
      setTitle('');
      fetchCbtData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setCreatingExam(false);
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!activeExam || !qText || !optA || !optB || !optC || !optD) return;
    setAddingQ(true);
    try {
      const res = await fetch('/api/tenant/cbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_question',
          slug,
          questionData: {
            examId: activeExam.id,
            questionText: qText,
            optionA: optA,
            optionB: optB,
            optionC: optC,
            optionD: optD,
            correctOption: correctOpt,
            points: qPoints,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add question');

      const updatedQuestions = [...activeExam.questions, data.question];
      const updatedExam = { ...activeExam, questions: updatedQuestions };
      setActiveExam(updatedExam);
      setExams(exams.map((e) => (e.id === activeExam.id ? updatedExam : e)));

      setQText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingQ(false);
    }
  }

  async function handleTogglePublish(exam: CbtExam) {
    try {
      const res = await fetch('/api/tenant/cbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_publish',
          slug,
          examId: exam.id,
          isPublished: !exam.isPublished,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle publish status');
      setExams(exams.map((e) => (e.id === exam.id ? { ...e, isPublished: data.exam.isPublished } : e)));
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleImportScores(exam: CbtExam) {
    try {
      const res = await fetch('/api/tenant/cbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_scores', slug, examId: exam.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not import CBT scores');
      setFeedback({ type: 'success', text: data.message || 'CBT scores imported into the result entry.' });
      fetchCbtData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleDeleteExam(examId: string) {
    setDeletingExamId(examId);
    try {
      const res = await fetch(`/api/tenant/cbt?slug=${slug}&examId=${examId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete exam');

      setExams((prev) => prev.filter((e) => e.id !== examId));
      if (activeExam?.id === examId) setActiveExam(null);
      setFeedback({ type: 'success', text: data.message || 'CBT Exam deleted successfully.' });
      setConfirmDeleteExam(null);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setDeletingExamId(null);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    setDeletingQuestionId(questionId);
    try {
      const res = await fetch(`/api/tenant/cbt?slug=${slug}&questionId=${questionId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete question');

      if (activeExam) {
        const updatedQuestions = activeExam.questions.filter((q) => q.id !== questionId);
        const updatedExam = { ...activeExam, questions: updatedQuestions };
        setActiveExam(updatedExam);
        setExams((prev) => prev.map((e) => (e.id === activeExam.id ? updatedExam : e)));
      }
      setFeedback({ type: 'success', text: 'Question removed from question bank.' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingQuestionId(null);
    }
  }

  async function handleResetAttempt(examId: string, attemptId: string, studentName: string) {
    if (!confirm(`Delete CBT attempt for ${studentName} so they can retake this test?`)) return;
    setResettingAttemptId(attemptId);
    try {
      const res = await fetch(`/api/tenant/cbt?slug=${slug}&attemptId=${attemptId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset student attempt');
      setExams((prev) =>
        prev.map((e) =>
          e.id === examId ? { ...e, attempts: e.attempts.filter((a: any) => a.id !== attemptId) } : e
        )
      );
      setFeedback({ type: 'success', text: data.message || `Reset attempt for ${studentName}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setResettingAttemptId(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500 font-mono text-sm">Loading CBT Engine...</div>;
  }

  if (!hasFeature) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800">
        <div className="flex items-center space-x-3 text-amber-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold">CBT Online Exams Feature Locked</h2>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          The CBT (Computer Based Test) engine enables online entrance exams, term tests, instant auto-grading, and question bank administration. Upgrade to Growth or Enterprise plan to activate CBT online testing.
        </p>
        <Link
          href={`/${slug}/dashboard/subscription`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md transition-all"
        >
          Upgrade Subscription Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CBT Online Exams Engine</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create timed online tests, build objective question banks, publish exams, and view instant student scores.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Create New CBT Exam (Teachers & Admins Only) */}
      {(userRole === 'school_admin' || userRole === 'teacher') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Class Test or CBT Exam
          </h2>

          {userRole === 'teacher' && subjects.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
              <p className="text-sm font-medium text-slate-700">No Teaching Allocations Found</p>
              <p className="text-xs text-slate-500 mt-1">
                You can only create tests and exams for classes and subjects allocated to your profile. Please contact your School Administrator to assign your classes and subjects.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCreateExam} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Test / Exam Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1st Term CA Test - Mathematics"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Result Component
                </label>
                <div className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-medium">
                  Terminal examination · 60 marks
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Subject {userRole === 'teacher' && '(Your Assigned Subjects)'}
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Target Class {userRole === 'teacher' && '(Your Assigned Classes)'}
                </label>
                <select
                  value={classLevelId}
                  onChange={(e) => setClassLevelId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                >
                  {classLevels.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name} (Only enrolled students can take this test)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Academic Term
                </label>
                <select
                  value={termId}
                  onChange={(e) => setTermId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                >
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.session.label} - {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  value={durationMins}
                  onChange={(e) => setDurationMins(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Total Score Marks
                </label>
                <input
                  type="number"
                  value={totalMarks}
                  readOnly
                  aria-readonly="true"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>

              <div className="flex items-end md:col-span-3">
                <button
                  type="submit"
                  disabled={creatingExam}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition cursor-pointer shadow-sm"
                >
                  {creatingExam ? 'Publishing Test...' : 'Create & Assign Test to Class'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* CBT Exam List & Question Manager */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Configured CBT Exams ({exams.length})</h2>
        {exams.map((exam) => (
          <div key={exam.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                    {exam.subject.name}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {exam.classLevel.name}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      exam.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {exam.isPublished ? 'Live & Published' : 'Draft'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-2">{exam.title}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Duration: {exam.durationMins} mins | Max Score: {exam.totalMarks} pts | Questions: {exam.questions.length} | Student Attempts: {exam.attempts.length}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {(userRole === 'school_admin' || userRole === 'teacher') && (
                  <>
                    {exam.attempts.length > 0 && (
                      <button
                        onClick={() => setAttemptsExamId(attemptsExamId === exam.id ? null : exam.id)}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        {attemptsExamId === exam.id ? 'Hide Attempts' : `Attempts (${exam.attempts.length})`}
                      </button>
                    )}
                    {exam.attempts.some((attempt: any) => attempt.submittedAt) && (
                      <button
                        onClick={() => handleImportScores(exam)}
                        className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        Import CBT scores to Results
                      </button>
                    )}
                    <button
                      onClick={() => setActiveExam(activeExam?.id === exam.id ? null : exam)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      {activeExam?.id === exam.id ? 'Close Question Bank' : 'Manage Questions'}
                    </button>
                    <button
                      onClick={() => handleTogglePublish(exam)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                        exam.isPublished ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {exam.isPublished ? 'Unpublish' : 'Publish Live'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteExam(exam)}
                      disabled={deletingExamId === exam.id}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-rose-200"
                      title="Delete CBT Exam"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </>
                )}
                {exam.isPublished && (
                  <a
                    href={`/${slug}/cbt/take/${exam.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center shadow-xs"
                  >
                    {userRole === 'student' ? 'Take Online Exam' : 'Portal Demo'}
                    <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Student Attempts Drawer (Teachers & Admins) */}
            {(userRole === 'school_admin' || userRole === 'teacher') && attemptsExamId === exam.id && (
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Student Test Attempts ({exam.attempts.length})
                  </h4>
                  {userRole === 'school_admin' && (
                    <span className="text-[11px] text-slate-500">
                      Resetting an attempt deletes the score and allows the student to retake the CBT test.
                    </span>
                  )}
                </div>
                {exam.attempts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No student attempts recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {exam.attempts.map((att: any) => (
                      <div key={att.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-bold text-slate-900">{att.student?.name || 'Student'}</span>
                          <span className="ml-2 text-slate-500">
                            {att.submittedAt
                              ? `Submitted ${new Date(att.submittedAt).toLocaleString()}`
                              : 'In progress'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                            {att.score ?? 0} / {att.maxScore || exam.totalMarks}
                          </span>
                          {userRole === 'school_admin' && (
                            <button
                              type="button"
                              onClick={() => handleResetAttempt(exam.id, att.id, att.student?.name || 'Student')}
                              disabled={resettingAttemptId === att.id}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold transition cursor-pointer disabled:opacity-50"
                            >
                              {resettingAttemptId === att.id ? 'Resetting...' : 'Reset / Delete Attempt'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Questions Bank Drawer (Teachers & Admins Only) */}
            {(userRole === 'school_admin' || userRole === 'teacher') && activeExam?.id === exam.id && (
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Add Objective Question</h4>
                  <form onSubmit={handleAddQuestion} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Enter question prompt..."
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Option A"
                        value={optA}
                        onChange={(e) => setOptA(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Option B"
                        value={optB}
                        onChange={(e) => setOptB(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Option C"
                        value={optC}
                        onChange={(e) => setOptC(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Option D"
                        value={optD}
                        onChange={(e) => setOptD(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-semibold text-slate-700">Correct Choice:</label>
                        <select
                          value={correctOpt}
                          onChange={(e) => setCorrectOpt(e.target.value)}
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-indigo-700"
                        >
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-semibold text-slate-700">Points:</label>
                        <input
                          type="number"
                          value={qPoints}
                          onChange={(e) => setQPoints(parseInt(e.target.value) || 5)}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={addingQ}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition cursor-pointer"
                      >
                        {addingQ ? 'Adding...' : '+ Add Question'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Question List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Question Bank ({exam.questions.length} Items)
                  </h4>
                  {exam.questions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No questions added yet to this test.</p>
                  ) : (
                    <div className="space-y-2">
                      {exam.questions.map((q, idx) => (
                        <div key={q.id} className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-slate-900 leading-snug">
                              Q{idx + 1}. {q.questionText} <span className="text-indigo-600 font-mono">({q.points} pts)</span>
                            </p>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              disabled={deletingQuestionId === q.id}
                              className="text-rose-600 hover:text-rose-800 text-[11px] font-bold px-2 py-1 rounded-md hover:bg-rose-50 transition flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Delete Question"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-slate-600">
                            <span className={`px-2 py-1 rounded ${q.correctOption === 'A' ? 'font-bold text-emerald-700 bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>A: {q.optionA}</span>
                            <span className={`px-2 py-1 rounded ${q.correctOption === 'B' ? 'font-bold text-emerald-700 bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>B: {q.optionB}</span>
                            <span className={`px-2 py-1 rounded ${q.correctOption === 'C' ? 'font-bold text-emerald-700 bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>C: {q.optionC}</span>
                            <span className={`px-2 py-1 rounded ${q.correctOption === 'D' ? 'font-bold text-emerald-700 bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>D: {q.optionD}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete CBT Exam?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-800 font-semibold">{confirmDeleteExam.title}</strong>? This will permanently delete all associated questions and student test attempt records. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingExamId !== null}
                onClick={() => setConfirmDeleteExam(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingExamId !== null}
                onClick={() => handleDeleteExam(confirmDeleteExam.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {deletingExamId === confirmDeleteExam.id ? 'Deleting Exam...' : 'Confirm Delete Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
