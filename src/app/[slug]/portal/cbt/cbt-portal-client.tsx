'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

export interface SerializedCbtExam {
  id: string;
  title: string;
  durationMins: number;
  totalMarks: number;
  subjectName: string;
  classLevelName: string;
  termName: string;
  sessionLabel: string;
  questionCount: number;
  attempt: {
    id: string;
    score: number;
    maxScore: number;
    percentage: number;
    submittedAt: string | null;
  } | null;
}

export interface StudentWithExams {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  className: string;
  exams: SerializedCbtExam[];
}

interface CbtPortalClientProps {
  slug: string;
  primaryColor?: string;
  accentColor?: string;
  students: StudentWithExams[];
  isParent: boolean;
}

export default function CbtPortalClient({
  slug,
  primaryColor = '#1E3A8A',
  accentColor = '#2563EB',
  students,
  isParent,
}: CbtPortalClientProps) {
  const [selectedStudentIdx, setSelectedStudentIdx] = useState(0);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activeStudent = students[selectedStudentIdx] || students[0];

  const filteredExams = useMemo(() => {
    if (!activeStudent) return [];
    return activeStudent.exams.filter((exam) => {
      // Tab filter
      if (filterTab === 'pending' && exam.attempt !== null) return false;
      if (filterTab === 'completed' && exam.attempt === null) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = exam.title.toLowerCase().includes(query);
        const matchesSubject = exam.subjectName.toLowerCase().includes(query);
        const matchesTerm = exam.termName.toLowerCase().includes(query);
        return matchesTitle || matchesSubject || matchesTerm;
      }
      return true;
    });
  }, [activeStudent, filterTab, searchQuery]);

  const stats = useMemo(() => {
    if (!activeStudent) return { total: 0, pending: 0, completed: 0, avgScore: 0 };
    const total = activeStudent.exams.length;
    const completedExams = activeStudent.exams.filter((e) => e.attempt !== null);
    const completed = completedExams.length;
    const pending = total - completed;

    const avgScore =
      completed > 0
        ? Math.round(
            completedExams.reduce((acc, curr) => acc + (curr.attempt?.percentage || 0), 0) / completed
          )
        : 0;

    return { total, pending, completed, avgScore };
  }, [activeStudent]);

  if (!activeStudent) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-800 text-sm">
        No enrolled student record found for this account. Please contact the school office.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div
        className="rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)` }}
      >
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold backdrop-blur-xs mb-3">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Computer-Based Assessments (CBT)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Online Examination Portal
          </h1>
          <p className="text-sm text-white/85 mt-2 leading-relaxed">
            Take allocated class tests and terminal examinations with automated grading, instant score recording, and timed question delivery.
          </p>
        </div>

        {/* Ambient decorative elements */}
        <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute right-12 top-4 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Parent Ward Selector (if multiple wards) */}
      {isParent && students.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Select Student Ward:
          </label>
          <div className="flex flex-wrap gap-2">
            {students.map((st, idx) => (
              <button
                key={st.studentId}
                onClick={() => {
                  setSelectedStudentIdx(idx);
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  selectedStudentIdx === idx
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{st.studentName}</span>
                <span className="text-[10px] opacity-75">({st.className || 'Enrolled'})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Student Profile & Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl text-white shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {activeStudent.studentName.charAt(0)}
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Candidate</p>
            <p className="text-sm font-black text-slate-900 truncate max-w-[150px]">{activeStudent.studentName}</p>
            <p className="text-xs text-slate-500 font-medium">Class: {activeStudent.className || 'General'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Tests</p>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
            <p className="text-[11px] text-slate-500 font-medium">Allocated to Class</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Ready to Take</p>
            <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
            <p className="text-[11px] text-slate-500 font-medium">Pending Attempts</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-black text-emerald-600">{stats.completed}</p>
            <p className="text-[11px] text-slate-500 font-medium">Avg Accuracy: {stats.avgScore}%</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilterTab('all')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Tests ({activeStudent.exams.length})
          </button>
          <button
            onClick={() => setFilterTab('pending')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterTab === 'pending' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterTab === 'completed' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed ({stats.completed})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by subject or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Exams Grid */}
      {filteredExams.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {searchQuery
              ? 'No matching tests found'
              : filterTab === 'pending'
              ? 'No Pending Tests!'
              : filterTab === 'completed'
              ? 'No Completed Tests Yet'
              : 'No CBT Exams Configured'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
            {searchQuery
              ? `No examinations matching "${searchQuery}". Clear your search query to see all tests.`
              : filterTab === 'pending'
              ? 'You have answered all available tests for your class. Great job!'
              : 'When your teachers publish tests for your class, they will appear here with instructions and timers.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map((exam) => {
            const isCompleted = exam.attempt !== null;
            const percentage = exam.attempt?.percentage || 0;

            return (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {/* Top Badge Indicators */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                        {exam.subjectName}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                        {exam.classLevelName}
                      </span>
                    </div>

                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Ready to Take
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                    {exam.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {exam.sessionLabel ? `${exam.sessionLabel} • ` : ''}
                    {exam.termName}
                  </p>

                  {/* Metadata Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 my-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Duration</p>
                      <p className="text-xs font-black text-slate-800 mt-0.5">{exam.durationMins} Mins</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Questions</p>
                      <p className="text-xs font-black text-slate-800 mt-0.5">{exam.questionCount} Items</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Max Score</p>
                      <p className="text-xs font-black text-slate-800 mt-0.5">{exam.totalMarks} Pts</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Result or Action */}
                <div>
                  {isCompleted ? (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Score</p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-black text-emerald-600">{exam.attempt?.score}</span>
                          <span className="text-xs font-medium text-slate-400">/ {exam.totalMarks} pts</span>
                          <span className="ml-1 text-xs font-bold text-slate-600">({percentage}%)</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            percentage >= 50
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {percentage >= 70 ? 'Excellent' : percentage >= 50 ? 'Passed' : 'Needs Review'}
                        </span>
                        {exam.attempt?.submittedAt && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(exam.attempt.submittedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                      <div className="text-xs text-slate-500 font-medium">
                        Timed automated test
                      </div>
                      <Link
                        href={`/${slug}/cbt/take/${exam.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:shadow-md cursor-pointer"
                      >
                        Start CBT Exam →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Help info note */}
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex items-start gap-3">
        <svg className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-bold text-slate-800">CBT Online Exam Rules & Guidelines</p>
          <p className="mt-0.5 text-slate-600 leading-relaxed">
            Ensure you have a stable network connection before starting an online exam. Once started, the countdown timer runs continuously and will automatically submit your exam when time runs out. Each exam can only be taken once unless reset by your teacher.
          </p>
        </div>
      </div>
    </div>
  );
}
