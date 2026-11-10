'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Question {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  points: number;
}

interface Exam {
  id: string;
  title: string;
  durationMins: number;
  totalMarks: number;
  subject: { name: string };
  classLevel: { name: string };
  questions: Question[];
}

export default function StudentCbtTakePage() {
  const params = useParams();
  const slug = params.slug as string;
  const examId = params.examId as string;

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<Exam | null>(null);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');

  // Exam Test Execution State
  const [questionsCount, setQuestionsCount] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultScore, setResultScore] = useState<number | null>(null);

  useEffect(() => {
    fetchExamDetails();
  }, [examId, slug]);

  // Countdown timer effect
  useEffect(() => {
    if (!examStarted || isSubmitted) return;
    if (timeLeft <= 0) {
      handleSubmitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, isSubmitted, timeLeft]);

  async function fetchExamDetails() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/cbt?slug=${slug}&examId=${examId}`);
      const data = await res.json();
      if (res.ok && data.exam) {
        setExam(data.exam);
        setQuestionsCount(typeof data.questionsCount === 'number' ? data.questionsCount : data.exam.questions.length);
        setTimeLeft(typeof data.remainingSeconds === 'number' ? data.remainingSeconds : data.exam.durationMins * 60);
        if (data.isSubmitted) {
          setIsSubmitted(true);
          setExamStarted(true);
          setResultScore(typeof data.resultScore === 'number' ? data.resultScore : 0);
        } else if (data.examStarted) {
          setExamStarted(true);
        }
        if (data.currentStudent) {
          setStudentId(data.currentStudent.admissionNumber || data.currentStudent.id);
          setStudentName(data.currentStudent.name);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartExam(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !studentName || startingExam) return;
    setStartingExam(true);
    try {
      const res = await fetch(`/api/tenant/cbt?slug=${slug}&examId=${examId}&start=true`);
      const data = await res.json();
      if (!res.ok || !data.exam) {
        alert(data.error || 'Could not start exam');
        return;
      }
      setExam(data.exam);
      setQuestionsCount(typeof data.questionsCount === 'number' ? data.questionsCount : data.exam.questions.length);
      setTimeLeft(typeof data.remainingSeconds === 'number' ? data.remainingSeconds : data.exam.durationMins * 60);
      setExamStarted(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to start exam');
    } finally {
      setStartingExam(false);
    }
  }

  function handleSelectOption(questionId: string, option: string) {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  async function handleSubmitExam() {
    if (isSubmitted || submitting || !exam) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cbt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: exam.id,
          slug,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit test');
      setIsSubmitted(true);
      setResultScore(data.score);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-mono text-sm">
        Loading Online CBT Portal...
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-rose-400">Exam Not Found or Unavailable</h1>
          <p className="text-slate-400 text-sm mt-2">Please check the test link or contact your school administrator.</p>
          <Link
            href={`/${slug}/portal/cbt`}
            className="inline-block mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
          >
            ← Return to CBT Portal
          </Link>
        </div>
      </div>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  // Step 1: Pre-Exam Identification Screen
  if (!examStarted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-white">
          <div className="text-center mb-6">
            <span className="inline-block p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 font-mono text-xs uppercase font-bold tracking-widest mb-3">
              CBT Entrance & Assessment Portal
            </span>
            <h1 className="text-2xl font-black tracking-tight">{exam.title}</h1>
            <p className="text-slate-400 text-xs mt-1">
              Subject: {exam.subject.name} | Class: {exam.classLevel.name}
            </p>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-4 text-xs space-y-2 mb-6 border border-slate-700/50">
            <div className="flex justify-between text-slate-300">
              <span>Duration Allowed:</span>
              <span className="font-bold text-indigo-300">{exam.durationMins} Minutes</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Total Questions:</span>
              <span className="font-bold text-indigo-300">{questionsCount || exam.questions.length} Items</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Total Score Marks:</span>
              <span className="font-bold text-indigo-300">{exam.totalMarks} Points</span>
            </div>
          </div>

          {studentName && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400">Authenticated Student</p>
                <p className="text-sm font-bold text-white">{studentName}</p>
                <p className="text-xs text-slate-400 font-mono">Reg: {studentId}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Verified
              </span>
            </div>
          )}

          {studentName && studentId ? (
            <form onSubmit={handleStartExam} className="space-y-4">
              <p className="text-sm text-slate-300">You are signed in as <strong className="text-white">{studentName}</strong>. Your student record is verified by the school portal.</p>
              <button
                type="submit"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition text-sm cursor-pointer"
              >
                Start CBT Exam Now →
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Sign in to your student portal before starting this exam. Student IDs typed into this page cannot be used to submit an exam.
              <Link href={`/${slug}/login`} className="ml-1 underline font-semibold">Go to sign in</Link>
            </div>
          )}

          <div className="mt-4 text-center">
            <Link
              href={`/${slug}/portal/cbt`}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              ← Back to Student CBT Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Result Submission Screen
  if (isSubmitted && resultScore !== null) {
    const percentage = Math.round((resultScore / exam.totalMarks) * 100);
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-white text-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Exam Submitted Successfully!</h1>
          <p className="text-slate-400 text-xs mt-1">Thank you for completing {exam.title}.</p>

          <div className="my-8 p-6 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Your Final CBT Score</span>
            <div className="text-5xl font-extrabold text-indigo-400 my-2">
              {resultScore} <span className="text-xl text-slate-400 font-normal">/ {exam.totalMarks}</span>
            </div>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                percentage >= 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              Grade Accuracy: {percentage}%
            </span>
          </div>

          <p className="text-xs text-slate-500">Your results have been automatically recorded into the school ledger.</p>

          <div className="mt-6 space-y-2">
            <Link
              href={`/${slug}/portal/cbt`}
              className="inline-flex items-center justify-center w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transition text-xs"
            >
              ← Return to CBT Assessments Portal
            </Link>
            <Link
              href={`/${slug}/portal`}
              className="inline-flex items-center justify-center w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition text-xs"
            >
              Go to Student Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Live CBT Test Taking Screen
  const currentQ = exam.questions[currentIdx];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{exam.title}</h1>
          <p className="text-xs text-slate-400">Student ID: {studentId}</p>
        </div>

        {/* Live Timer */}
        <div
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl border font-mono text-base font-bold ${
            mins < 5 ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-indigo-400'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
        </div>
      </header>

      {/* Test Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Question Pane */}
        <div className="lg:col-span-3 space-y-6">
          {currentQ && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-400 border-b border-slate-800 pb-3">
                <span>Question {currentIdx + 1} of {exam.questions.length}</span>
                <span className="text-indigo-400 font-mono">Points: {currentQ.points}</span>
              </div>

              <h2 className="text-lg font-semibold leading-relaxed text-slate-100">{currentQ.questionText}</h2>

              {/* Options */}
              <div className="space-y-3 pt-2">
                {[
                  { key: 'A', text: currentQ.optionA },
                  { key: 'B', text: currentQ.optionB },
                  { key: 'C', text: currentQ.optionC },
                  { key: 'D', text: currentQ.optionD },
                ].map((opt) => {
                  const isSelected = answers[currentQ.id] === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelectOption(currentQ.id, opt.key)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center space-x-4 ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-lg'
                          : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs shrink-0 ${
                          isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation Controls */}
              <div className="flex justify-between pt-4 border-t border-slate-800">
                <button
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((prev) => prev - 1)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl text-xs font-bold text-slate-300 transition"
                >
                  ← Previous Question
                </button>
                {currentIdx < exam.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx((prev) => prev + 1)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition"
                  >
                    Next Question →
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitExam}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition shadow-lg"
                  >
                    {submitting ? 'Submitting Test...' : 'Finish & Submit Test'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Question Palette Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 h-fit space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Question Palette</h3>
          <div className="grid grid-cols-4 gap-2">
            {exam.questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(idx)}
                  className={`h-10 rounded-xl font-bold text-xs transition flex items-center justify-center ${
                    isCurrent
                      ? 'ring-2 ring-indigo-400 bg-indigo-600 text-white'
                      : isAnswered
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg"
            >
              {submitting ? 'Submitting Test...' : 'Finish & Submit Test'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
