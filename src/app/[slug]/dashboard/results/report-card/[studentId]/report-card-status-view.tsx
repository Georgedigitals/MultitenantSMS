'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface AvailableTermOption {
  id: string;
  name: string;
  sessionLabel: string;
  isPublished: boolean;
  isCurrent: boolean;
}

export interface ReportCardStatusViewProps {
  slug: string;
  role: string;
  student: {
    id: string;
    name: string;
    admissionNumber: string | null;
  };
  className: string;
  classLevelId?: string;
  activeTerm: {
    id: string;
    name: string;
    isCurrent: boolean;
    startDate: string | null;
    endDate: string | null;
    sessionLabel: string;
  };
  availableTerms: AvailableTermOption[];
  statusInfo: {
    isUpcoming: boolean;
    isNotEnrolled: boolean;
    currentStage: number; // 1: Score Entry, 2: Form Teacher, 3: Principal Approval, 4: Published
    stageTitle: string;
    stageDescription: string;
    formattedStartDate?: string;
    hasPublishedResultsInOtherTerms: boolean;
  };
}

export default function ReportCardStatusView({
  slug,
  role,
  student,
  className,
  classLevelId,
  activeTerm,
  availableTerms,
  statusInfo,
}: ReportCardStatusViewProps) {
  const router = useRouter();
  const isAdmin = role === 'school_admin';

  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const termId = e.target.value;
    router.push(`/${slug}/dashboard/results/report-card/${student.id}?termId=${termId}`);
  };

  const publishedTerms = availableTerms.filter((t) => t.isPublished && t.id !== activeTerm.id);

  // Stepper definition
  const steps = [
    {
      num: 1,
      title: 'Score Entry',
      subtitle: 'Subject Teachers enter CA & Exam scores',
    },
    {
      num: 2,
      title: 'Class Review',
      subtitle: 'Form Teacher rates traits & adds remarks',
    },
    {
      num: 3,
      title: "Principal's Approval",
      subtitle: 'Verification of broadsheet & class rankings',
    },
    {
      num: 4,
      title: 'Official Publication',
      subtitle: 'Unlocked for printing & parent portal',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. TOP ACTION & CONTEXT BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link
            href={
              classLevelId
                ? `/${slug}/dashboard/results/report-cards?classLevelId=${classLevelId}&termId=${activeTerm.id}`
                : `/${slug}/dashboard/results`
            }
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <span>&larr;</span> Back to Roster
          </Link>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">
              {student.name}{' '}
              {student.admissionNumber && (
                <span className="font-mono text-slate-500 font-normal">
                  ({student.admissionNumber})
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              Class: <span className="text-slate-800 font-semibold">{className}</span>
            </p>
          </div>
        </div>

        {/* Term Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <label htmlFor="term-selector" className="text-xs font-bold text-slate-600 shrink-0">
            Academic Term:
          </label>
          <select
            id="term-selector"
            value={activeTerm.id}
            onChange={handleTermChange}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
          >
            {availableTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.sessionLabel} - {t.name}
                {t.isPublished ? ' ✓ (Published)' : t.isCurrent ? ' • (Current)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. MAIN STATUS CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {/* Status Header Badge & Title */}
        <div className="text-center max-w-xl mx-auto mb-8">
          {statusInfo.isUpcoming ? (
            <>
              <div className="w-14 h-14 bg-sky-50 text-sky-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-sky-100">
                🗓️
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-200 mb-2">
                Upcoming Academic Term • {activeTerm.sessionLabel}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                {activeTerm.name} Has Not Commenced
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                This academic term is scheduled on the school calendar for a future date. Academic
                activities, continuous assessments, and score recording will open once the school
                session transitions into this term.
              </p>
              {statusInfo.formattedStartDate && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                  <span>📅 Scheduled Resumption:</span>
                  <span className="text-slate-900 font-bold">{statusInfo.formattedStartDate}</span>
                </div>
              )}
            </>
          ) : statusInfo.isNotEnrolled ? (
            <>
              <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-amber-100">
                👤
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 mb-2">
                Enrollment Notice • {activeTerm.sessionLabel}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                No Active Enrollment for this Session
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong>{student.name}</strong> does not have an active enrollment record for the{' '}
                {activeTerm.sessionLabel} academic session. Report cards can only be compiled for
                students enrolled in a designated class arm.
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-indigo-100">
                📋
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 mb-2">
                {activeTerm.name} ({activeTerm.sessionLabel}) • In Compilation
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                Terminal Results Are Being Compiled
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Assessments for <strong>{student.name}</strong> ({className}) are currently in
                progress. Official report cards will be ready for printing and portal access once
                the school administration completes verification and publishes the broadsheet.
              </p>
            </>
          )}
        </div>

        {/* 3. VISUAL ACADEMIC WORKFLOW PIPELINE (Shown for current/active terms) */}
        {!statusInfo.isNotEnrolled && !statusInfo.isUpcoming && (
          <div className="mb-8 pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 text-center">
              Academic Publishing Workflow
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
              {steps.map((step) => {
                const isPassed = step.num < statusInfo.currentStage;
                const isCurrent = step.num === statusInfo.currentStage;

                return (
                  <div
                    key={step.num}
                    className={`rounded-xl p-3.5 border transition-all ${
                      isCurrent
                        ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                        : isPassed
                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                        : 'bg-slate-50/60 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          isPassed
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isPassed ? '✓' : step.num}
                      </span>

                      {isCurrent && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900 animate-pulse">
                          Active Stage
                        </span>
                      )}
                      {isPassed && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">
                          Completed
                        </span>
                      )}
                    </div>

                    <h3
                      className={`text-xs font-bold ${
                        isCurrent
                          ? 'text-indigo-950'
                          : isPassed
                          ? 'text-slate-900'
                          : 'text-slate-600'
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {step.subtitle}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Current Stage Detailed Callout */}
            <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
              <span className="text-base shrink-0 mt-0.5">ℹ️</span>
              <div className="text-xs text-slate-700">
                <span className="font-bold text-slate-900">
                  Current Status: {statusInfo.stageTitle}
                </span>
                <p className="mt-0.5 text-slate-600">{statusInfo.stageDescription}</p>
              </div>
            </div>
          </div>
        )}

        {/* 4. QUICK JUMP TO PUBLISHED TERMS (If this student has past published reports) */}
        {publishedTerms.length > 0 && (
          <div className="mb-8 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Looking for past published report cards?
                </p>
                <p className="text-[11px] text-emerald-800">
                  Official report cards are already published and ready for printing in other terms:
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {publishedTerms.map((pt) => (
                  <Link
                    key={pt.id}
                    href={`/${slug}/dashboard/results/report-card/${student.id}?termId=${pt.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 font-bold text-xs rounded-lg border border-emerald-300 shadow-2xs transition-colors"
                  >
                    <span>📄</span>
                    <span>
                      {pt.name} ({pt.sessionLabel})
                    </span>
                    <span className="text-emerald-600">&rarr;</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. ACADEMIC PROTOCOL POLICY NOTICE (Plain English - Zero Code Enums) */}
        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200/80 mb-6 leading-relaxed">
          <strong className="text-slate-900 block font-bold mb-1">
            Academic Integrity & Reporting Notice:
          </strong>
          Official terminal report cards are released only after all subject continuous assessments
          (CA), examinations, affective domain observations, and principal remarks have been fully
          vetted and published. This guarantees that printed documents and parent portal views
          contain final, verified class positions, grades, and authorized signatures.
        </div>

        {/* 6. ADMINISTRATIVE ACTION BUTTONS */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {isAdmin ? (
            <>
              <Link
                href={`/${slug}/dashboard/results/broadsheet?termId=${activeTerm.id}`}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <span>📊</span> Open Class Broadsheet
              </Link>

              <Link
                href={`/${slug}/dashboard/results/entry?termId=${activeTerm.id}`}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs flex items-center gap-1.5"
              >
                <span>✏️</span> Enter or Edit Scores
              </Link>

              <Link
                href={`/${slug}/dashboard/results`}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Results Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/${slug}/dashboard/results/entry?termId=${activeTerm.id}`}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <span>✏️</span> Enter Subject Scores
              </Link>

              <Link
                href={`/${slug}/dashboard/results`}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Back to Results
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

