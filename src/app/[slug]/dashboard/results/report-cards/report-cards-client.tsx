'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ReportCardData } from '@/lib/report-card';
import { ReportCardDocument } from '@/components/report-card-document';

interface StudentRow {
  studentId: string;
  name: string;
  isPublished: boolean;
  publishedCount: number;
  totalSubjects: number;
  averageScore: number | null;
  position: number | null;
  reportCard: ReportCardData | null;
}

interface ReportCardsClientProps {
  slug: string;
  classLevels: Array<{ id: string; name: string }>;
  terms: Array<{ id: string; name: string; sessionLabel: string }>;
  selectedClassId: string;
  selectedTermId: string;
  students: StudentRow[];
  publishedCount: number;
  totalStudents: number;
}

export default function ReportCardsClient({
  slug,
  classLevels,
  terms,
  selectedClassId,
  selectedTermId,
  students,
  publishedCount,
  totalStudents,
}: ReportCardsClientProps) {
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  const publishedReportCards = students
    .map((s) => s.reportCard)
    .filter((rc): rc is ReportCardData => rc !== null);

  const handleTriggerPrint = () => {
    setIsBatchPrinting(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="space-y-6 print:space-y-0 print:p-0 print:m-0">
      {/* Filters Bar - Hidden during print */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Class Report Cards Directory
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              View and print official terminal report cards for published students.
            </p>
          </div>

          {/* Action: Batch Print */}
          {publishedReportCards.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleTriggerPrint}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow transition-all"
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
                Batch Print Class ({publishedReportCards.length})
              </button>
            </div>
          )}
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Select Class Level
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                window.location.href = `/${slug}/dashboard/results/report-cards?classLevelId=${e.target.value}&termId=${selectedTermId}`;
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 font-medium"
            >
              {classLevels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Select Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => {
                window.location.href = `/${slug}/dashboard/results/report-cards?classLevelId=${selectedClassId}&termId=${e.target.value}`;
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 font-medium"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.sessionLabel} - {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mode 1: Directory Table (Screen view) */}
      {!isBatchPrinting && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-700">
              Students Enrolled: {totalStudents} | Published Report Cards: {publishedCount}
            </span>
            <div className="flex gap-2">
              <Link
                href={`/${slug}/dashboard/results/broadsheet?classLevelId=${selectedClassId}&termId=${selectedTermId}`}
                className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
              >
                View Broadsheet →
              </Link>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No active students enrolled in this class.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 uppercase text-[11px] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Average</th>
                    <th className="py-3 px-3 text-center">Position</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((st) => (
                    <tr key={st.studentId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {st.name}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {st.isPublished ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Unpublished
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-700">
                        {st.averageScore !== null ? `${st.averageScore}%` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">
                        {st.position !== null ? (
                          <span>
                            {st.position}
                            <span className="text-[10px] font-normal text-slate-500">
                              {st.position === 1
                                ? 'st'
                                : st.position === 2
                                ? 'nd'
                                : st.position === 3
                                ? 'rd'
                                : 'th'}
                            </span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {st.isPublished ? (
                          <Link
                            href={`/${slug}/dashboard/results/report-card/${st.studentId}?termId=${selectedTermId}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors"
                          >
                            View / Print
                          </Link>
                        ) : (
                          <span
                            title="Results must be published before report cards can be generated."
                            className="text-slate-400 cursor-not-allowed font-medium text-[11px]"
                          >
                            Unpublished
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Batch Print View (Rendered when isBatchPrinting is true or in print mode) */}
      {(isBatchPrinting || publishedReportCards.length > 0) && (
        <div className={isBatchPrinting ? 'block' : 'hidden print:block'}>
          {isBatchPrinting && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex justify-between items-center print:hidden">
              <span className="text-xs font-semibold text-amber-800">
                Batch print preview active ({publishedReportCards.length} report cards ready to print).
              </span>
              <button
                onClick={() => setIsBatchPrinting(false)}
                className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold rounded-lg"
              >
                Close Preview
              </button>
            </div>
          )}

          <div className="space-y-8 print:space-y-0">
            {publishedReportCards.map((rc, index) => (
              <ReportCardDocument
                key={rc.student.id}
                reportCard={rc}
                isBatchPrint={true}
                isLastInBatch={index === publishedReportCards.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
