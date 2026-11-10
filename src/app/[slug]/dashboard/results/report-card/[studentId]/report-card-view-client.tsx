'use client';

import React from 'react';
import Link from 'next/link';
import { ReportCardData } from '@/lib/report-card';
import { ReportCardDocument } from '@/components/report-card-document';

interface ReportCardViewClientProps {
  slug: string;
  reportCard: ReportCardData;
  availableTerms: Array<{
    id: string;
    name: string;
    sessionLabel: string;
    isPublished?: boolean;
    isCurrent?: boolean;
  }>;
  currentTermId: string;
}

export default function ReportCardViewClient({
  slug,
  reportCard,
  availableTerms,
  currentTermId,
}: ReportCardViewClientProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-0 print:p-0 print:m-0">
      {/* Top Action Bar - Hidden during printing */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/dashboard/results/report-cards?classLevelId=${reportCard.student.classLevel.id}&termId=${currentTermId}`}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← Back to Class List
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-xs text-slate-500 font-medium">
            Student: <strong className="text-slate-800">{reportCard.student.name}</strong> (
            {reportCard.student.classLevel.name})
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {availableTerms.length > 1 && (
            <select
              value={currentTermId}
              onChange={(e) => {
                window.location.href = `/${slug}/dashboard/results/report-card/${reportCard.student.id}?termId=${e.target.value}`;
              }}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium"
            >
              {availableTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.sessionLabel} - {t.name}
                  {t.isPublished ? ' ✓' : t.isCurrent ? ' •' : ''}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all hover:shadow"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print Report Card
          </button>
        </div>
      </div>

      {/* The Printable Official Document */}
      <ReportCardDocument reportCard={reportCard} />
    </div>
  );
}
