'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, ClipboardList, Send } from 'lucide-react';

interface PortalAssignment {
  id: string;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  maxScore: number;
  classLevel: { id: string; name: string };
  subject: { id: string; name: string };
  teacherName: string;
  mySubmission: {
    id: string;
    content: string | null;
    score: number | null;
    feedback: string | null;
    status: string;
    submittedAt: string;
  } | null;
}

export default function PortalHomeworkClient({ role }: { role: string }) {
  const [assignments, setAssignments] = useState<PortalAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenant/homework');
      const data = await res.json();
      if (res.ok && Array.isArray(data.assignments)) {
        setAssignments(data.assignments);
        const initial: Record<string, string> = {};
        for (const a of data.assignments) {
          if (a.mySubmission?.content) initial[a.id] = a.mySubmission.content;
        }
        setAnswers(initial);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (assignmentId: string) => {
    const content = (answers[assignmentId] || '').trim();
    if (!content) return;
    setSubmittingId(assignmentId);
    setMessage(null);
    try {
      const res = await fetch('/api/tenant/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', assignmentId, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setMessage({ text: 'Homework submitted successfully!' });
      load();
    } catch (err: any) {
      setMessage({ text: err.message || 'Submission failed', error: true });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          Homework &amp; Class Assignments
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {role === 'parent'
            ? 'Track your child’s assigned homework, due dates, submissions, and teacher grades.'
            : 'View assignments from your teachers, submit your work, and check your grades & feedback.'}
        </p>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold border ${
            message.error
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          Loading assignments...
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
          No homework assignments have been posted for your class yet.
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const sub = a.mySubmission;
            const isGraded = sub?.status === 'graded';
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase">
                      {a.subject.name} · {a.teacherName}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-1.5">{a.title}</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {a.dueDate && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                        <Calendar className="w-3.5 h-3.5" />
                        Due {new Date(a.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {isGraded ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Graded: {sub?.score} / {a.maxScore}
                      </span>
                    ) : sub ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold">
                        Submitted
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold">
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {a.instructions && (
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    {a.instructions}
                  </p>
                )}

                {isGraded && sub?.feedback && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                    <strong>Teacher Feedback:</strong> {sub.feedback}
                  </div>
                )}

                {role === 'student' && !isGraded && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-bold text-slate-600">
                      {sub ? 'Update Your Submission' : 'Your Answer / Submission'}
                    </label>
                    <textarea
                      rows={3}
                      value={answers[a.id] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      placeholder="Type your homework answer here..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSubmit(a.id)}
                        disabled={submittingId === a.id || !(answers[a.id] || '').trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {submittingId === a.id ? 'Submitting...' : sub ? 'Update Submission' : 'Submit Homework'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
