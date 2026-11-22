'use client';

import React, { useState } from 'react';
import { PromotionEligibilityResult, PromotionRosterResult, StudentPromotionRosterItem } from '@/lib/promotion';
import { AddSessionModal } from '@/components/add-session-modal';
import { useLanguage } from '@/components/language-provider';

interface SessionOption {
  id: string;
  label: string;
  isCurrent: boolean;
}

interface PromotionClientProps {
  slug: string;
  tenantName: string;
  sessions: SessionOption[];
  activeSessionId: string;
  initialEligibility: PromotionEligibilityResult | null;
  initialRoster: PromotionRosterResult | null;
}

export default function PromotionClient({
  slug,
  tenantName,
  sessions,
  activeSessionId,
  initialEligibility,
  initialRoster,
}: PromotionClientProps) {
  const { localization: { currencySymbol, locale } } = useLanguage();
  const [sessionList, setSessionList] = useState<SessionOption[]>(sessions);
  const [selectedFromSession, setSelectedFromSession] = useState<string>(activeSessionId);
  const [targetSessionId, setTargetSessionId] = useState<string>(
    sessions.find((s) => s.id !== activeSessionId)?.id || ''
  );

  const [eligibility, setEligibility] = useState<PromotionEligibilityResult | null>(initialEligibility);
  const [roster, setRoster] = useState<PromotionRosterResult | null>(initialRoster);

  // Student overrides state: studentId -> decision
  const [decisions, setDecisions] = useState<Record<string, 'promote' | 'repeat' | 'graduate' | 'withdraw'>>({});
  // Fee exemptions state: studentId -> boolean (Principal bond / exemption)
  const [exemptions, setExemptions] = useState<Record<string, boolean>>({});
  const [blockFeePolicy, setBlockFeePolicy] = useState<boolean>(initialRoster?.blockPromotionOnFeeBalance || false);

  // Filters & Search
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedDecisionFilter, setSelectedDecisionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  if (!roster || !eligibility) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-8 text-center">
        <h2 className="text-lg font-bold mb-2">No Active Academic Sessions</h2>
        <p className="text-sm">Configure academic sessions and terms before executing promotion workflows.</p>
      </div>
    );
  }

  const getDecision = (student: StudentPromotionRosterItem): 'promote' | 'repeat' | 'graduate' | 'withdraw' => {
    return decisions[student.studentId] || student.defaultDecision;
  };

  const isExempt = (studentId: string): boolean => {
    return Boolean(exemptions[studentId]);
  };

  const isBlockedByFee = (student: StudentPromotionRosterItem): boolean => {
    const decision = getDecision(student);
    return Boolean(
      blockFeePolicy &&
      student.hasFeeDebt &&
      !isExempt(student.studentId) &&
      (decision === 'promote' || decision === 'repeat')
    );
  };

  const handleDecisionChange = (
    studentId: string,
    decision: 'promote' | 'repeat' | 'graduate' | 'withdraw'
  ) => {
    setDecisions((prev) => ({ ...prev, [studentId]: decision }));
  };

  const handleToggleExemption = (studentId: string) => {
    setExemptions((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handleToggleFeeBlock = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/tenant/settings/fee-block', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockPromotionOnFeeBalance: enabled }),
      });
      if (res.ok) {
        setBlockFeePolicy(enabled);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Bulk Actions
  const handlePromoteAllInView = () => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const s of filteredStudents) {
        if (!s.isTopClassLevel) {
          next[s.studentId] = 'promote';
        }
      }
      return next;
    });
  };

  const handleRepeatAllInView = () => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const s of filteredStudents) {
        next[s.studentId] = 'repeat';
      }
      return next;
    });
  };

  const handleExemptAllDebtors = () => {
    const nextExemptions: Record<string, boolean> = { ...exemptions };
    for (const s of roster.students) {
      if (s.hasFeeDebt) {
        nextExemptions[s.studentId] = true;
      }
    }
    setExemptions(nextExemptions);
  };

  const handleResetDefaults = () => {
    setDecisions({});
    setExemptions({});
  };

  const handleExecutePromotion = async () => {
    if (!targetSessionId) {
      alert('Please select a target new academic session for promotion');
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    const payloadDecisions = roster.students.map((s) => ({
      studentId: s.studentId,
      decision: getDecision(s),
      exemptFeeBlock: isExempt(s.studentId),
    }));

    try {
      const res = await fetch('/api/tenant/promotion/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSessionId: selectedFromSession,
          targetSessionId,
          decisions: payloadDecisions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Promotion failed');
        return;
      }

      setShowConfirmModal(false);
      setExecutionResult(
        `Session Promotion Executed Successfully! Created ${data.createdEnrollmentsCount} new enrollments in target session.`
      );
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setIsExecuting(false);
    }
  };

  // CSV Export
  const handleExportPromotionCSV = () => {
    const targetSession = sessionList.find((s) => s.id === targetSessionId);
    const headers = [
      'Student Name',
      'Current Class',
      'Next Target Class / Outcome',
      'Promotion Decision',
      'Average Score (%)',
      'Fee Clearance Status',
      'Outstanding Debt (NGN)',
      'Fee Exemption Granted',
    ];
    const rows = roster.students.map((s) => [
      `"${s.studentName.replace(/"/g, '""')}"`,
      `"${s.currentClassLevelName.replace(/"/g, '""')}"`,
      `"${(s.isTopClassLevel ? 'Graduating Cohort' : s.nextClassLevelName || '—').replace(/"/g, '""')}"`,
      getDecision(s).toUpperCase(),
      s.averageScore !== undefined && s.averageScore !== null ? `${s.averageScore}%` : 'N/A',
      s.hasFeeDebt ? 'UNPAID DEBT' : 'CLEARED',
      s.feeDebtAmount,
      isExempt(s.studentId) ? 'YES (PRINCIPAL BOND)' : 'NO',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanFileName = `${tenantName.replace(/[^a-zA-Z0-9]/g, '_')}_Promotion_Register_${roster.sessionLabel}_to_${targetSession?.label || 'New_Session'}.csv`;
    link.setAttribute('download', cleanFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPromotionSheet = () => {
    window.print();
  };

  // Calculations
  const promoteCount = roster.students.filter((s) => getDecision(s) === 'promote').length;
  const repeatCount = roster.students.filter((s) => getDecision(s) === 'repeat').length;
  const graduateCount = roster.students.filter((s) => getDecision(s) === 'graduate').length;
  const withdrawCount = roster.students.filter((s) => getDecision(s) === 'withdraw').length;
  const debtBlockedCount = roster.students.filter(isBlockedByFee).length;
  const exemptedCount = roster.students.filter((s) => s.hasFeeDebt && isExempt(s.studentId)).length;

  // Filtered List
  const filteredStudents = roster.students.filter((s) => {
    const matchesClass = selectedClassFilter === 'all' || s.currentClassLevelId === selectedClassFilter;
    const decision = getDecision(s);
    const isBlocked = isBlockedByFee(s);
    const matchesDecision =
      selectedDecisionFilter === 'all' ||
      (selectedDecisionFilter === 'debt_blocked' ? isBlocked : decision === selectedDecisionFilter);
    const matchesSearch =
      !searchQuery.trim() ||
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.currentClassLevelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(s.nextClassLevelName && s.nextClassLevelName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesClass && matchesDecision && matchesSearch;
  });

  // Calculate student count per class for the dropdown
  const classCounts: Record<string, number> = {};
  for (const s of roster.students) {
    classCounts[s.currentClassLevelId] = (classCounts[s.currentClassLevelId] || 0) + 1;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-600 font-mono font-bold block mb-1">
            Session-End Promotion Control Plane
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Student Promotion &amp; Advancement Roster
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review student promotion decisions, top-of-range bounds, and fee balance debt flags for {tenantName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPromotionCSV}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
            title="Download promotion register as CSV spreadsheet"
          >
            <span>📥 Export Register (CSV)</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPromotionSheet}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
            title="Print promotion sheet for noticeboards"
          >
            <span>🖨️ Print Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={!eligibility.eligible || debtBlockedCount > 0 || !targetSessionId}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            Execute Promotion
          </button>
        </div>
      </div>

      {executionResult && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-6 text-sm font-bold shadow-xs">
          {executionResult}
        </div>
      )}

      {/* Debt Warning Banner if debt blocks promotion */}
      {debtBlockedCount > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 text-rose-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-bold text-sm flex items-center gap-1.5">
              <span>⚠️ Promotion Paused:</span>
              <span>{debtBlockedCount} {debtBlockedCount === 1 ? 'student has' : 'students have'} outstanding fee debt</span>
            </div>
            <p className="text-xs text-rose-700">
              The fee clearance policy is active. You can grant a <strong>Principal Exemption</strong> individually or click <strong>Exempt All Debtors on Bond</strong> to allow promotion to proceed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExemptAllDebtors}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-2xs"
            >
              Exempt All Debtors on Bond
            </button>
            <button
              type="button"
              onClick={() => handleToggleFeeBlock(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-rose-800 border border-rose-300 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Disable Fee Block
            </button>
          </div>
        </div>
      )}

      {/* Session Controls & Policy Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Current Ending Session
          </label>
          <select
            value={selectedFromSession}
            onChange={(e) => setSelectedFromSession(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white"
          >
            {sessionList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} {s.isCurrent ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Target New Session
              </label>
              <AddSessionModal
                slug={slug}
                triggerButtonText="+ New Session"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                onSessionCreated={(newSession) => {
                  setSessionList((prev) => [newSession, ...prev]);
                  setTargetSessionId(newSession.id);
                }}
              />
            </div>
            <select
              value={targetSessionId}
              onChange={(e) => setTargetSessionId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white"
            >
              <option value="">Select Target Session...</option>
              {sessionList
                .filter((s) => s.id !== selectedFromSession)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </select>
            {sessionList.filter((s) => s.id !== selectedFromSession).length === 0 && (
              <p className="text-[11px] text-amber-600 mt-2 font-medium">
                No future session exists yet. Click &quot;+ New Session&quot; above to create one.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Fee Balance Clearance Policy
            </span>
            <p className="text-xs text-slate-500 mb-2">
              Block promotion execution for students with outstanding fee debt.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={blockFeePolicy}
              onChange={(e) => handleToggleFeeBlock(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span className="text-xs font-bold text-slate-900">Enforce Fee Balance Block</span>
          </label>
        </div>
      </div>

      {/* Decision KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-mono block">Promote</span>
          <span className="text-2xl font-extrabold text-blue-600">{promoteCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-mono block">Repeat</span>
          <span className="text-2xl font-extrabold text-amber-600">{repeatCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-mono block">Graduate</span>
          <span className="text-2xl font-extrabold text-emerald-600">{graduateCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-mono block">Withdraw</span>
          <span className="text-2xl font-extrabold text-rose-600">{withdrawCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/30 p-4 text-center shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-rose-700 font-mono block">Debt Blocked</span>
          <span className="text-2xl font-extrabold text-rose-700">{debtBlockedCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-purple-200 bg-purple-50/30 p-4 text-center shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-purple-700 font-mono block">Bond Exempt</span>
          <span className="text-2xl font-extrabold text-purple-700">{exemptedCount}</span>
        </div>
      </div>

      {/* Student Promotion Review Table with Class Filter & Bulk Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Enrolled Students Review Roster</h2>
            <p className="text-xs text-slate-500">
              Confirming promotion creates brand-new enrollment rows for the target session; historical records remain securely archived.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search student or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />

            {/* Class Filter */}
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes ({roster.students.length})</option>
              {roster.enabledClassLevels.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name} ({classCounts[cl.id] || 0})
                </option>
              ))}
            </select>

            {/* Decision Filter */}
            <select
              value={selectedDecisionFilter}
              onChange={(e) => setSelectedDecisionFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Decisions</option>
              <option value="promote">Promoting</option>
              <option value="repeat">Repeating</option>
              <option value="graduate">Graduating</option>
              <option value="withdraw">Withdrawing</option>
              <option value="debt_blocked">Debt Blocked</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>Showing <strong className="text-slate-900">{filteredStudents.length}</strong> of {roster.students.length} students</span>
            {selectedClassFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-semibold text-[11px]">
                {roster.enabledClassLevels.find((c) => c.id === selectedClassFilter)?.name}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Batch:</span>
            <button
              type="button"
              onClick={handlePromoteAllInView}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
            >
              Promote All Eligible
            </button>
            <button
              type="button"
              onClick={handleRepeatAllInView}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
            >
              Repeat All
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 transition-colors cursor-pointer"
            >
              Reset to Defaults
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-mono border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Student Name</th>
                <th className="px-6 py-3.5">Current Class</th>
                <th className="px-6 py-3.5">Academic Performance</th>
                <th className="px-6 py-3.5">Fee Clearance</th>
                <th className="px-6 py-3.5">Next Target Level</th>
                <th className="px-6 py-3.5 text-right">Promotion Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                    No students match the selected class or status filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const decision = getDecision(s);
                  const isBlocked = isBlockedByFee(s);
                  const exempted = isExempt(s.studentId);

                  return (
                    <tr
                      key={s.studentId}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isBlocked ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        <div>
                          <span>{s.studentName}</span>
                          {exempted && (
                            <span className="block text-[11px] font-bold text-purple-700">
                              ✓ Fee Bond Exemption
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {s.currentClassLevelName}
                        {s.isTopClassLevel && (
                          <span className="ml-2 px-2 py-0.5 rounded text-3xs font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                            Top Level
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {s.averageScore !== undefined && s.averageScore !== null ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-xs font-bold tabular-nums border ${
                                s.averageScore >= 60
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : s.averageScore >= 40
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              Avg: {s.averageScore}%
                            </span>
                            {s.averageScore < 40 && (
                              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                                At-Risk
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No published exams</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {s.hasFeeDebt ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Debt: {currencySymbol}{s.feeDebtAmount.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleExemption(s.studentId)}
                              className={`text-[11px] font-semibold hover:underline cursor-pointer ${
                                exempted ? 'text-purple-700' : 'text-slate-500'
                              }`}
                            >
                              {exempted ? 'Revoke Exemption' : 'Grant Exemption'}
                            </button>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Cleared ✓
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {s.isTopClassLevel ? 'Graduating Cohort' : s.nextClassLevelName || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <select
                          value={decision}
                          onChange={(e) => handleDecisionChange(s.studentId, e.target.value as any)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                            decision === 'promote'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : decision === 'repeat'
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : decision === 'graduate'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-rose-50 text-rose-700 border-rose-300'
                          }`}
                        >
                          {!s.isTopClassLevel && <option value="promote">Promote to {s.nextClassLevelName}</option>}
                          <option value="repeat">Repeat {s.currentClassLevelName}</option>
                          <option value="graduate">Graduate Student</option>
                          <option value="withdraw">Withdraw Student</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Confirm Session Promotion</h3>
            <p className="text-xs text-slate-500 mb-4">
              Executing promotion from <span className="font-semibold">{roster.sessionLabel}</span> will enroll students into new session records. Historical academic and attendance records remain strictly immutable.
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-600">Promoted Students:</span>
                <span className="font-bold text-blue-600">{promoteCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Repeating Students:</span>
                <span className="font-bold text-amber-600">{repeatCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Graduating Students:</span>
                <span className="font-bold text-emerald-600">{graduateCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Withdrawn Students:</span>
                <span className="font-bold text-rose-600">{withdrawCount}</span>
              </div>
              {exemptedCount > 0 && (
                <div className="flex justify-between border-t border-slate-200 pt-1 text-purple-700">
                  <span className="font-medium">Fee Exemption Bonds:</span>
                  <span className="font-bold">{exemptedCount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePromotion}
                disabled={isExecuting}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isExecuting ? 'Executing...' : 'Confirm & Execute Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
