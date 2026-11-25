'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, CheckCircle2, ClipboardList, Plus, Trash2, Users, X } from 'lucide-react';

interface OptionItem {
  id: string;
  name: string;
}

interface HomeworkItem {
  id: string;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  maxScore: number;
  createdAt: string;
  classLevel: OptionItem;
  subject: OptionItem;
  teacherName: string;
  submissionCount: number;
}

interface SubmissionItem {
  id: string;
  content: string | null;
  attachmentUrl: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
  submittedAt: string;
  student: { id: string; name: string; admissionNumber: string | null };
}

export default function HomeworkClient({
  classLevels,
  subjects,
  currentTermId,
}: {
  role: string;
  classLevels: OptionItem[];
  subjects: OptionItem[];
  currentTermId: string | null;
}) {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClassId, setFilterClassId] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [title, setTitle] = useState('');
  const [classLevelId, setClassLevelId] = useState(classLevels[0]?.id || '');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState(20);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ text: string; error?: boolean } | null>(null);

  // Submissions drawer/modal
  const [activeAssignment, setActiveAssignment] = useState<{
    id: string;
    title: string;
    maxScore: number;
    classLevel: OptionItem;
    subject: OptionItem;
    submissions: SubmissionItem[];
  } | null>(null);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  const loadHomework = async () => {
    setLoading(true);
    try {
      const qs = filterClassId ? `?classLevelId=${encodeURIComponent(filterClassId)}` : '';
      const res = await fetch(`/api/tenant/homework${qs}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.assignments)) {
        setItems(data.assignments);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomework();
  }, [filterClassId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch('/api/tenant/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          classLevelId,
          subjectId,
          termId: currentTermId,
          dueDate: dueDate || null,
          maxScore: Number(maxScore) || 20,
          instructions: instructions.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create assignment');
      setShowCreate(false);
      setTitle('');
      setInstructions('');
      setDueDate('');
      setBanner({ text: 'Assignment published to students!' });
      loadHomework();
    } catch (err: any) {
      setBanner({ text: err.message || 'Failed to publish assignment', error: true });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this homework assignment and all student submissions?')) return;
    const res = await fetch(`/api/tenant/homework?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setBanner({ text: 'Assignment deleted.' });
    }
  };

  const openSubmissions = async (assignmentId: string) => {
    setLoadingSubs(true);
    try {
      const res = await fetch(`/api/tenant/homework?assignmentId=${encodeURIComponent(assignmentId)}`);
      const data = await res.json();
      if (res.ok && data.assignment) {
        setActiveAssignment(data.assignment);
        const drafts: Record<string, { score: string; feedback: string }> = {};
        for (const sub of data.assignment.submissions || []) {
          drafts[sub.id] = {
            score: sub.score !== null && sub.score !== undefined ? String(sub.score) : '',
            feedback: sub.feedback || '',
          };
        }
        setGradeDrafts(drafts);
      }
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleGrade = async (submissionId: string) => {
    const draft = gradeDrafts[submissionId];
    if (!draft || draft.score === '') return;
    setGradingId(submissionId);
    try {
      const res = await fetch('/api/tenant/homework', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grade',
          submissionId,
          score: Number(draft.score),
          feedback: draft.feedback,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not save grade');
        return;
      }
      if (activeAssignment) {
        setActiveAssignment({
          ...activeAssignment,
          submissions: activeAssignment.submissions.map((s) =>
            s.id === submissionId
              ? { ...s, score: Number(draft.score), feedback: draft.feedback, status: 'graded' }
              : s
          ),
        });
      }
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Homework &amp; Student Assignments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Post classwork or homework with due dates, review student submissions, and grade with feedback.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <option value="">All Classes</option>
            {classLevels.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Post Assignment
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold border ${
            banner.error
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {banner.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          Loading assignments...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No homework assignments yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click &ldquo;Post Assignment&rdquo; to publish homework for any class and subject.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase">
                    {item.classLevel.name} · {item.subject.name}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    /{item.maxScore} pts
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                {item.instructions && (
                  <p className="text-xs text-slate-600 mt-1.5 line-clamp-3 leading-relaxed">
                    {item.instructions}
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : 'No due date'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <Users className="w-3.5 h-3.5" />
                    {item.submissionCount} submitted
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openSubmissions(item.id)}
                    className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Review &amp; Grade ({item.submissionCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    title="Delete assignment"
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Post New Homework / Assignment</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assignment Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Week 4 Algebra Practice Problems"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class *</label>
                  <select
                    value={classLevelId}
                    onChange={(e) => setClassLevelId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    {classLevels.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject *</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Score</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instructions</label>
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Write clear instructions, textbook pages, or questions for students..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Publishing...' : 'Publish Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submissions Grading Modal */}
      {(activeAssignment || loadingSubs) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {activeAssignment?.title || 'Loading submissions...'}
                </h2>
                {activeAssignment && (
                  <p className="text-xs text-slate-500">
                    {activeAssignment.classLevel.name} · {activeAssignment.subject.name} · Max Score: {activeAssignment.maxScore}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveAssignment(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {loadingSubs ? (
                <p className="text-xs text-slate-500 text-center py-8">Loading student submissions...</p>
              ) : activeAssignment && activeAssignment.submissions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No students have submitted yet.</p>
              ) : (
                activeAssignment?.submissions.map((sub) => (
                  <div key={sub.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900">{sub.student.name}</span>
                        {sub.student.admissionNumber && (
                          <span className="ml-2 text-[11px] font-mono text-slate-500">{sub.student.admissionNumber}</span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          sub.status === 'graded'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sub.status === 'graded' && <CheckCircle2 className="w-3 h-3" />}
                        {sub.status}
                      </span>
                    </div>

                    {sub.content && (
                      <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
                        {sub.content}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 pt-1">
                      <div className="w-full sm:w-28">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Score / {activeAssignment.maxScore}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={activeAssignment.maxScore}
                          step="0.5"
                          value={gradeDrafts[sub.id]?.score ?? ''}
                          onChange={(e) =>
                            setGradeDrafts((prev) => ({
                              ...prev,
                              [sub.id]: { ...(prev[sub.id] || { feedback: '' }), score: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Teacher Feedback
                        </label>
                        <input
                          type="text"
                          value={gradeDrafts[sub.id]?.feedback ?? ''}
                          onChange={(e) =>
                            setGradeDrafts((prev) => ({
                              ...prev,
                              [sub.id]: { ...(prev[sub.id] || { score: '' }), feedback: e.target.value },
                            }))
                          }
                          placeholder="Great work! Check question 3..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGrade(sub.id)}
                        disabled={gradingId === sub.id}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                      >
                        {gradingId === sub.id ? 'Saving...' : 'Save Grade'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
