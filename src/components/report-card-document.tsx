'use client';

import React from 'react';
import { ReportCardData } from '@/lib/report-card';

interface ReportCardDocumentProps {
  reportCard: ReportCardData;
  isBatchPrint?: boolean;
  isLastInBatch?: boolean;
}

export function ReportCardDocument({ reportCard, isBatchPrint = false, isLastInBatch = true }: ReportCardDocumentProps) {
  const {
    school,
    student,
    assessmentComponents,
    subjects,
    summary,
    attendance,
    review,
    domains,
    gradeAnalysis,
    nextTermBegins,
    gradingScale,
    options,
  } = reportCard;

  const showClassRank = options?.showClassRank !== false;
  const showDomains = options?.showDomains !== false;

  const primaryColor = school.branding.primaryColor || '#0F172A';

  // Format attendance display
  const timesOpened = attendance.totalSchoolDays;
  const timesPresent = attendance.presentDays;
  const timesAbsent = attendance.absentDays;
  const attendanceRate = attendance.percentage !== null
    ? `${attendance.percentage}%`
    : timesOpened !== null && timesOpened > 0
    ? `${Math.round((timesPresent / timesOpened) * 1000) / 10}%`
    : '—';

  // Format ordinals (1st, 2nd, 3rd...)
  const getOrdinal = (n: number | null) => {
    if (!n) return '';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div
      className={`report-card-sheet report-card-print-root bg-white text-black font-sans text-[11px] leading-tight max-w-[850px] mx-auto p-6 sm:p-8 rounded-lg border-2 border-slate-300 shadow-xl print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none ${
        isBatchPrint ? `${!isLastInBatch ? 'print:break-after-page' : ''} mb-12 print:mb-0` : ''
      }`}
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* 1. OFFICIAL SCHOOL HEADER */}
      <div className="report-card-header flex items-start justify-between gap-4 pb-3 mb-2.5 border-b-2 border-black">
        {/* School Crest / Logo */}
        <div className="flex-shrink-0 pt-0.5">
          {school.branding.logoUrl ? (
            <img
              src={school.branding.logoUrl}
              alt={school.name}
              className="report-card-logo w-20 h-20 sm:w-24 sm:h-24 object-contain"
            />
          ) : (
            <div
              className="report-card-logo w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-black flex flex-col items-center justify-center text-center p-1 font-serif"
              style={{ color: primaryColor }}
            >
              <div className="text-2xl font-black">🎓</div>
              <span className="text-[9px] font-bold uppercase leading-none mt-1">
                {school.name.substring(0, 12)}
              </span>
            </div>
          )}
        </div>

        {/* School Name & Contact Information */}
        <div className="flex-1 text-center px-2">
          <h1
            className="text-2xl sm:text-3xl print:text-xl font-black tracking-wider uppercase font-serif"
            style={{ color: primaryColor }}
          >
            {school.name}
          </h1>
          {school.address && (
            <p className="text-[11px] print:text-[9.5px] font-medium text-slate-800 mt-1 print:mt-0.5">
              {school.address}
            </p>
          )}
          {(school.phone || school.email) && (
            <p className="text-[10px] print:text-[9px] text-slate-700 mt-0.5">
              {school.phone && (
                <>
                  <span className="font-semibold">TEL:</span> {school.phone}
                </>
              )}
              {school.phone && school.email && <> &bull; </>}
              {school.email && (
                <>
                  <span className="font-semibold">Email:</span> {school.email}
                </>
              )}
            </p>
          )}

          {/* Subheading: Term Student's Performance Report */}
          <div className="mt-2.5 print:mt-1.5">
            <h2 className="text-sm sm:text-base print:text-xs font-black uppercase tracking-widest font-serif border-y-2 border-black py-0.5 bg-slate-100/70 inline-block px-4">
              {student.term.name.toUpperCase()} STUDENT'S PERFORMANCE REPORT
            </h2>
          </div>
        </div>

        {/* Right Balance spacer for centered title against logo */}
        <div className="w-16 sm:w-20 print:w-14 hidden sm:block print:block flex-shrink-0" />
      </div>

      {/* 2. STUDENT BIO INFORMATION & PASSPORT PHOTO */}
      <div className="report-card-bio flex items-stretch justify-between gap-3 mb-2.5 border-2 border-black p-2.5 bg-slate-50/60">
        {/* Bio Data Fields */}
        <div className="flex-1 space-y-1.5 text-[11px]">
          {/* Row 1 */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div className="flex items-baseline">
              <span className="font-bold text-slate-700 w-16">NAME:</span>
              <span className="font-black text-black text-xs uppercase tracking-wide border-b border-dotted border-black pb-0.5 min-w-[200px]">
                {student.name}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-slate-700 w-16">GENDER:</span>
              <span className="font-bold text-black border-b border-dotted border-black pb-0.5 min-w-[80px]">
                {student.gender}
              </span>
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div className="flex items-baseline">
              <span className="font-bold text-slate-700 w-16">CLASS:</span>
              <span className="font-bold text-black border-b border-dotted border-black pb-0.5 min-w-[120px]">
                {student.classLevel.name}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-slate-700 w-16">SESSION:</span>
              <span className="font-bold text-black border-b border-dotted border-black pb-0.5 min-w-[100px]">
                {student.session.label}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-slate-700">ADM NO:</span>
              <span className="font-mono font-bold text-black border-b border-dotted border-black pb-0.5 min-w-[90px] ml-1.5">
                {student.admissionNumber || student.id.substring(0, 10).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Row 3 */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div className="flex items-baseline">
              <span className="font-bold text-slate-700 w-16">D.O.B.:</span>
              <span className="font-medium text-black border-b border-dotted border-black pb-0.5 min-w-[120px]">
                {student.dob}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-slate-700 w-16">AGE:</span>
              <span className="font-medium text-black border-b border-dotted border-black pb-0.5 min-w-[60px]">
                {student.age}
              </span>
            </div>
            <div className="flex items-baseline gap-4">
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700">HT:</span>
                <span className="font-medium text-black border-b border-dotted border-black pb-0.5 min-w-[50px] ml-1">
                  {student.height}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700">WT:</span>
                <span className="font-medium text-black border-b border-dotted border-black pb-0.5 min-w-[50px] ml-1">
                  {student.weight}
                </span>
              </div>
            </div>
          </div>

          {/* Row 4 */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div className="flex items-baseline flex-1 min-w-[240px]">
              <span className="font-bold text-slate-700">CLUB/SOCIETY:</span>
              <span className="font-medium text-black border-b border-dotted border-black pb-0.5 flex-1 ml-1.5">
                {student.club}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-slate-700">FAV. COL:</span>
              <span className="font-medium text-black border-b border-dotted border-black pb-0.5 min-w-[90px] ml-1.5">
                {student.favColor}
              </span>
            </div>
          </div>
        </div>

        {/* Passport Photo Box */}
        <div className="report-card-photo w-24 sm:w-28 flex-shrink-0 flex flex-col items-center justify-center border-2 border-black bg-white p-1">
          {student.avatarUrl ? (
            <img
              src={student.avatarUrl}
              alt={student.name}
              className="report-card-photo-img w-full h-28 object-cover"
            />
          ) : (
            <div className="report-card-photo-img w-full h-28 bg-slate-100 flex flex-col items-center justify-center text-center p-1">
              <svg className="w-10 h-10 print:w-7 print:h-7 text-slate-400 mb-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="text-[9px] print:text-[7.5px] font-bold text-slate-500 uppercase leading-none">
                PASSPORT PHOTO
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. MAIN ACADEMIC SECTION: COGNITIVE DOMAIN + RIGHT PANELS */}
      <div className={`${showDomains ? 'report-card-main-grid' : ''} report-card-section grid grid-cols-1 ${showDomains ? 'lg:grid-cols-12' : ''} gap-3 print:gap-2 mb-2.5 items-start`}>
        {/* LEFT COLUMN: COGNITIVE DOMAIN TABLE */}
        <div className={showDomains ? 'lg:col-span-7' : 'w-full'}>
          <div className="border-2 border-black overflow-hidden">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-300 text-black border-b-2 border-black">
                  <th
                    colSpan={assessmentComponents.length + (showClassRank ? 6 : 5)}
                    className="py-1 px-2 text-center font-black uppercase tracking-wider text-xs border-b border-black"
                  >
                    COGNITIVE DOMAIN
                  </th>
                </tr>
                <tr className="bg-slate-200 text-black font-bold border-b border-black text-center text-[9px] uppercase">
                  <th className="py-1 px-1.5 text-left border-r border-black w-36">
                    SUBJECTS
                  </th>
                  {assessmentComponents.map((comp) => (
                    <th key={comp.id} className="py-1 px-1 border-r border-black">
                      <div>{comp.name}</div>
                      <div className="font-normal text-[8px]">({comp.maxScore})</div>
                    </th>
                  ))}
                  <th className="py-1 px-1 border-r border-black font-black">
                    <div>TOTAL</div>
                    <div className="font-normal text-[8px]">(100)</div>
                  </th>
                  <th className="py-1 px-1 border-r border-black">GRADE</th>
                  {showClassRank && <th className="py-1 px-1 border-r border-black">POS</th>}
                  <th className="py-1 px-1 border-r border-black">REMARKS</th>
                  <th className="py-1 px-1">AVG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {subjects.map((sub, idx) => (
                  <tr
                    key={sub.subjectId}
                    className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                  >
                    <td className="py-1 px-1.5 font-bold uppercase border-r border-black truncate max-w-[130px]">
                      {sub.subjectName}
                    </td>

                    {/* Continuous Assessment Component Scores */}
                    {assessmentComponents.map((comp) => {
                      const rawVal =
                        sub.scores[comp.id] ??
                        sub.scores[comp.name] ??
                        sub.scores[comp.name.toLowerCase()];
                      return (
                        <td
                          key={comp.id}
                          className="py-1 px-1 text-center font-mono border-r border-black"
                        >
                          {rawVal !== undefined && rawVal !== null ? rawVal : '-'}
                        </td>
                      );
                    })}

                    {/* Subject Total */}
                    <td className="py-1 px-1 text-center font-black font-mono border-r border-black">
                      {sub.total.toFixed(1)}
                    </td>

                    {/* Grade */}
                    <td className="py-1 px-1 text-center font-black border-r border-black">
                      {sub.grade}
                    </td>

                    {/* Subject Position */}
                    {showClassRank && (
                      <td className="py-1 px-1 text-center font-bold font-mono border-r border-black">
                        {sub.subjectPosition || '-'}
                      </td>
                    )}

                    {/* Remark */}
                    <td className="py-1 px-1 text-center font-semibold uppercase text-[8.5px] border-r border-black">
                      {sub.remark}
                    </td>

                    {/* Class Average */}
                    <td className="py-1 px-1 text-center font-mono">
                      {sub.classAverage.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: ATTENDANCE + AFFECTIVE + PSYCHOMOTOR + RATING INDICES (~40% width) */}
        {showDomains && (
        <div className="lg:col-span-5 space-y-2">
          {/* 1. ATTENDANCE SUMMARY */}
          <div className="border-2 border-black overflow-hidden text-[10px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-300 border-b border-black">
                  <th
                    colSpan={2}
                    className="py-1 px-2 text-center font-black uppercase text-[10px]"
                  >
                    ATTENDANCE SUMMARY
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black font-medium">
                <tr>
                  <td className="py-0.5 px-2 border-r border-black w-3/5">
                    Times School Opened
                  </td>
                  <td className="py-0.5 px-2 text-center font-bold font-mono">
                    {timesOpened ?? '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 border-r border-black">
                    Times Present
                  </td>
                  <td className="py-0.5 px-2 text-center font-bold font-mono">
                    {timesPresent} <span className="font-normal text-[9px]">({attendanceRate})</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 border-r border-black">
                    Times Absent
                  </td>
                  <td className="py-0.5 px-2 text-center font-bold font-mono">
                    {timesAbsent}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. AFFECTIVE DOMAIN (10 Observable Traits) */}
          <div className="border-2 border-black overflow-hidden text-[9px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-300 border-b border-black">
                  <th className="py-1 px-2 font-black uppercase text-[10px] border-r border-black">
                    AFFECTIVE DOMAIN
                  </th>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <th
                      key={n}
                      className="py-1 px-1 text-center font-black w-6 border-r border-black last:border-r-0"
                    >
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {domains.affective.map((item, idx) => (
                  <tr
                    key={item.name}
                    className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                  >
                    <td className="py-0.5 px-2 font-semibold border-r border-black truncate max-w-[125px]">
                      {item.name}
                    </td>
                    {[5, 4, 3, 2, 1].map((scale) => (
                      <td
                        key={scale}
                        className="py-0.5 px-1 text-center font-bold border-r border-black last:border-r-0"
                      >
                        {item.score === scale ? '✓' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3. PSYCHOMOTOR DOMAIN (6 Physical / Practical Skills) */}
          <div className="border-2 border-black overflow-hidden text-[9px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-300 border-b border-black">
                  <th className="py-1 px-2 font-black uppercase text-[10px] border-r border-black">
                    PSYCHOMOTOR DOMAIN
                  </th>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <th
                      key={n}
                      className="py-1 px-1 text-center font-black w-6 border-r border-black last:border-r-0"
                    >
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {domains.psychomotor.map((item, idx) => (
                  <tr
                    key={item.name}
                    className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                  >
                    <td className="py-0.5 px-2 font-semibold border-r border-black truncate max-w-[125px]">
                      {item.name}
                    </td>
                    {[5, 4, 3, 2, 1].map((scale) => (
                      <td
                        key={scale}
                        className="py-0.5 px-1 text-center font-bold border-r border-black last:border-r-0"
                      >
                        {item.score === scale ? '✓' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. RATING INDICES GUIDE */}
          <div className="border border-black p-1 bg-slate-50 text-[8.5px] leading-tight text-center font-medium">
            <strong>RATING SCALE:</strong> 5 - Excellent &bull; 4 - Very Good &bull; 3 - Good &bull; 2 - Fair &bull; 1 - Needs Support
          </div>
        </div>
        )}
      </div>

      {/* 4. PERFORMANCE SUMMARY BAR */}
      <div className="report-card-section border-2 border-black overflow-hidden mb-2.5 text-[10px]">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="bg-slate-300 border-b border-black">
              <th
                colSpan={5}
                className="py-1 px-2 font-black uppercase text-[10px] tracking-wider"
              >
                PERFORMANCE SUMMARY
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black">
              <td className="py-1 px-2 border-r border-black w-1/5 text-left font-semibold">
                Total Obtained:
              </td>
              <td className="py-1 px-2 border-r border-black font-black font-mono text-xs w-1/5">
                {summary.totalScore.toFixed(0)}
              </td>
              <td className="py-1 px-2 border-r border-black font-semibold text-left w-1/5">
                %TAGE (Average):
              </td>
              <td className="py-1 px-2 border-r border-black font-black font-mono text-xs w-1/5">
                {summary.averageScore.toFixed(1)}%
              </td>
              <td
                rowSpan={2}
                className="py-2 px-3 font-black text-sm uppercase bg-slate-100 flex-1 align-middle text-center"
              >
                {summary.overallRemark}
              </td>
            </tr>
            <tr>
              <td className="py-1 px-2 border-r border-black text-left font-semibold">
                Total Obtainable:
              </td>
              <td className="py-1 px-2 border-r border-black font-black font-mono text-xs">
                {summary.totalObtainable}
              </td>
              <td className="py-1 px-2 border-r border-black font-semibold text-left">
                {showClassRank ? 'GRADE / POSITION:' : 'OVERALL GRADE:'}
              </td>
              <td className="py-1 px-2 border-r border-black font-black font-mono text-xs">
                {summary.overallGrade}{' '}
                {showClassRank && summary.position && (
                  <span className="font-normal text-[10px]">
                    ({getOrdinal(summary.position)} of {summary.classSize})
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. GRADE SCALE & GRADE ANALYSIS (Side by side) */}
      <div className="report-card-grade-grid report-card-section grid grid-cols-1 md:grid-cols-12 gap-3 print:gap-2 mb-2.5">
        {/* Left: Grade Scale Legend */}
        <div className="md:col-span-7 border-2 border-black overflow-hidden text-[9px]">
          <div className="bg-slate-300 font-black text-center py-1 uppercase border-b border-black">
            GRADE SCALE
          </div>
          <div className="p-1.5 text-center text-[9px] font-medium leading-relaxed bg-white">
            {gradingScale.length > 0 ? (
              gradingScale.map((gs, i) => (
                <span key={`${gs.grade}-${gs.minScore ?? ''}-${i}`} className="inline-block mr-2 last:mr-0">
                  {gs.minScore}-{gs.maxScore}% = <strong>{gs.grade}</strong> ({gs.remark})
                  {i < gradingScale.length - 1 ? ' | ' : ''}
                </span>
              ))
            ) : (
              <span>
                70-100%=<strong>A</strong>(EXCELLENT) &bull; 60-69.9%=<strong>B</strong>(VERY GOOD) &bull; 50-59.9%=<strong>C</strong>(GOOD) &bull; 40-49.9%=<strong>D</strong>(PASS) &bull; 0-39.9%=<strong>F</strong>(WEAK)
              </span>
            )}
          </div>
        </div>

        {/* Right: Grade Analysis Table */}
        <div className="md:col-span-5 border-2 border-black overflow-hidden text-[9px]">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-300 border-b border-black">
                <th
                  colSpan={gradeAnalysis.distribution.length + 1}
                  className="py-1 font-black uppercase text-[9px]"
                >
                  GRADE ANALYSIS
                </th>
              </tr>
              <tr className="bg-slate-100 border-b border-black font-bold">
                <th className="py-0.5 px-1 border-r border-black">GRADE</th>
                {gradeAnalysis.distribution.map((d, i) => (
                  <th key={`${d.grade}-${i}`} className="py-0.5 px-1 border-r border-black last:border-r-0">
                    {d.grade}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black font-mono font-bold">
                <td className="py-0.5 px-1 border-r border-black font-semibold text-slate-700">NO</td>
                {gradeAnalysis.distribution.map((d, i) => (
                  <td key={`${d.grade}-${i}`} className="py-0.5 px-1 border-r border-black last:border-r-0">
                    {d.count > 0 ? d.count : '-'}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td colSpan={gradeAnalysis.distribution.length - 1} className="py-0.5 px-2 text-left">
                  TOTAL OFFERED
                </td>
                <td colSpan={2} className="py-0.5 px-1 text-center font-mono">
                  {gradeAnalysis.totalSubjects}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. TEACHER'S & PRINCIPAL'S REMARKS & SIGNATURES (Side by side for perfect balance) */}
      <div className="report-card-section grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 print:gap-2 mb-2.5 text-[10px]">
        {/* Form Teacher's Remark */}
        <div className="border-2 border-black p-2 print:p-1.5 bg-slate-50/40 flex flex-col justify-between">
          <div>
            <span className="font-bold italic text-slate-800 block mb-1 print:mb-0.5">Teacher's Remark:</span>
            <div className="report-card-remarks-box border border-slate-300 p-2 min-h-[38px] bg-white italic font-serif text-[11px] print:text-[9.5px] flex items-center">
              {review.formTeacherRemarks ? `"${review.formTeacherRemarks}"` : <span className="text-slate-400 not-italic text-[10px]">—</span>}
            </div>
          </div>
          <div className="flex justify-between items-end mt-1.5 print:mt-1 pt-1 border-t border-dotted border-slate-300 text-[10px] print:text-[9px] gap-2">
            <div>
              <span className="font-bold text-slate-700">Teacher:</span>{' '}
              <strong className="uppercase">{review.formTeacherName}</strong>
            </div>
            <div className="font-bold text-slate-700 flex items-end gap-1 shrink-0">
              <span>Sign:</span>
              <span className="inline-flex flex-col items-center justify-end border-b border-black min-w-[84px] print:min-w-[68px] min-h-[24px] print:min-h-[18px]">
                {review.formTeacherSignatureUrl && (
                  <img
                    src={review.formTeacherSignatureUrl}
                    alt={`${review.formTeacherName} signature`}
                    className="h-7 print:h-5 max-w-[90px] object-contain -mb-0.5"
                  />
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Principal's Remark */}
        <div className="border-2 border-black p-2 print:p-1.5 bg-slate-50/40 flex flex-col justify-between">
          <div>
            <span className="font-bold italic text-slate-800 block mb-1 print:mb-0.5">Principal's Remark:</span>
            <div className="report-card-remarks-box border border-slate-300 p-2 min-h-[38px] bg-white italic font-serif text-[11px] print:text-[9.5px] flex items-center">
              {review.principalRemarks ? `"${review.principalRemarks}"` : <span className="text-slate-400 not-italic text-[10px]">—</span>}
            </div>
          </div>
          <div className="flex justify-between items-end mt-1.5 print:mt-1 pt-1 border-t border-dotted border-slate-300 text-[10px] print:text-[9px] gap-2">
            <div>
              <span className="font-bold text-slate-700">Principal:</span>{' '}
              <strong className="uppercase">{review.principalName}</strong>
            </div>
            <div className="font-bold text-slate-700 flex items-end gap-1 shrink-0">
              <span>Sign:</span>
              <span className="inline-flex flex-col items-center justify-end border-b border-black min-w-[84px] print:min-w-[68px] min-h-[24px] print:min-h-[18px]">
                {review.principalSignatureUrl && (
                  <img
                    src={review.principalSignatureUrl}
                    alt={`${review.principalName} signature`}
                    className="h-7 print:h-5 max-w-[90px] object-contain -mb-0.5"
                  />
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. FOOTER: NEXT TERM BEGINS & DATE ISSUED */}
      <div className="pt-2 border-t-2 border-black flex justify-between items-baseline text-[10px] font-bold">
        <div className="flex items-baseline">
          <span className="text-slate-800">Next Term Begins:</span>
          <span className="ml-2 font-mono border-b border-black pb-0.5 min-w-[130px] text-center">
            {nextTermBegins}
          </span>
        </div>

        <div className="flex items-baseline">
          <span className="text-slate-800">Date:</span>
          <span className="ml-2 font-mono border-b border-black pb-0.5 min-w-[90px] text-center">
            {new Date(reportCard.publishedAt).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Subtle authoritative print stamp */}
      <div className="text-center text-[8px] text-slate-400 mt-1.5">
        Authoritative Academic Report &bull; Issued by {school.name} &bull; Official Terminal Record
      </div>
    </div>
  );
}
