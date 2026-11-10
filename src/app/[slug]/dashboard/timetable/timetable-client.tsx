'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  Plus,
  Trash2,
  Printer,
  Settings,
  AlertTriangle,
  CheckCircle2,
  X,
  Coffee,
  MapPin,
  RefreshCw,
  Sparkles,
  ArrowLeftRight,
  Copy,
} from 'lucide-react';
import { DAYS_OF_WEEK } from '@/lib/timetable-types';

interface PeriodItem {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  orderIndex: number;
  isBreak: boolean;
}

interface SlotItem {
  id: string;
  classLevelId: string;
  dayOfWeek: number;
  periodId: string;
  subjectId: string | null;
  staffId: string | null;
  room: string | null;
  subject?: { id: string; name: string } | null;
  staff?: { id: string; name: string } | null;
  period: PeriodItem;
}

interface TeachingAssignmentItem {
  subjectId: string;
  subjectName: string;
  staffId: string;
  staffName: string;
}

interface TimetableData {
  classLevel: { id: string; name: string } | null;
  periods: PeriodItem[];
  slots: SlotItem[];
  teachingAssignments: TeachingAssignmentItem[];
}

interface TimetableAdminClientProps {
  slug: string;
  tenantName: string;
  classes: Array<{ id: string; name: string }>;
  selectedClassId: string;
  initialData: TimetableData | null;
  isAdmin: boolean;
}

export default function TimetableAdminClient({
  slug,
  tenantName,
  classes,
  selectedClassId,
  initialData,
  isAdmin,
}: TimetableAdminClientProps) {
  const router = useRouter();
  const [data, setData] = useState<TimetableData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Slot Assignment Modal State
  const [activeSlotModal, setActiveSlotModal] = useState<{
    dayOfWeek: number;
    period: PeriodItem;
    existingSlot?: SlotItem | null;
  } | null>(null);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [room, setRoom] = useState<string>('');
  const [submittingSlot, setSubmittingSlot] = useState(false);
  const [clashWarning, setClashWarning] = useState<{
    message: string;
    clashDetails?: any;
  } | null>(null);

  // Periods Management Modal State
  const [isPeriodsModalOpen, setIsPeriodsModalOpen] = useState(false);
  const [periodsList, setPeriodsList] = useState<PeriodItem[]>(initialData?.periods || []);
  const [editingPeriod, setEditingPeriod] = useState<Partial<PeriodItem> | null>(null);
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Smart Operations State
  const [isAutoGenerateModalOpen, setIsAutoGenerateModalOpen] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceClassId, setCopySourceClassId] = useState(
    classes.find((c) => c.id !== selectedClassId)?.id || ''
  );
  const [isCopying, setIsCopying] = useState(false);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [swapSource, setSwapSource] = useState<{
    dayOfWeek: number;
    periodId: string;
    subjectName?: string;
  } | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleClassChange = (newClassId: string) => {
    router.push(`/${slug}/dashboard/timetable?classLevelId=${newClassId}`);
  };

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/timetable?slug=${slug}&classLevelId=${selectedClassId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load timetable');
      setData(json);
      setPeriodsList(json.periods || []);
    } catch (err: any) {
      showToast(err.message || 'Error reloading timetable');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    setIsAutoGenerating(true);
    try {
      const res = await fetch('/api/tenant/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          action: 'auto_generate',
          classLevelId: selectedClassId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Auto-generation failed');

      showToast(json.message || 'Timetable auto-generated successfully!');
      setIsAutoGenerateModalOpen(false);
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Error auto-generating timetable');
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const handleCopyClass = async () => {
    if (!copySourceClassId) return;
    setIsCopying(true);
    try {
      const res = await fetch('/api/tenant/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          action: 'copy_class',
          sourceClassLevelId: copySourceClassId,
          targetClassLevelId: selectedClassId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Copy failed');

      showToast(json.message || 'Timetable copied successfully!');
      setIsCopyModalOpen(false);
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Error copying timetable');
    } finally {
      setIsCopying(false);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      const res = await fetch('/api/tenant/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          action: 'clear_all',
          classLevelId: selectedClassId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to clear timetable');

      showToast(json.message || 'Timetable cleared.');
      setIsClearModalOpen(false);
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Error clearing timetable');
    } finally {
      setIsClearing(false);
    }
  };

  const handleExecuteSwap = async (targetDay: number, targetPeriodId: string, ignoreClash = false) => {
    if (!swapSource) return;
    if (swapSource.dayOfWeek === targetDay && swapSource.periodId === targetPeriodId) {
      setSwapSource(null);
      return;
    }

    setIsSwapping(true);
    try {
      const res = await fetch('/api/tenant/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          action: 'swap_slots',
          classLevelId: selectedClassId,
          slot1: { dayOfWeek: swapSource.dayOfWeek, periodId: swapSource.periodId },
          slot2: { dayOfWeek: targetDay, periodId: targetPeriodId },
          ignoreClash,
        }),
      });

      const json = await res.json();
      if (res.status === 409 && json.clash) {
        if (confirm(`${json.error}\n\nDo you want to override this clash?`)) {
          handleExecuteSwap(targetDay, targetPeriodId, true);
          return;
        } else {
          setSwapSource(null);
          return;
        }
      }

      if (!res.ok) throw new Error(json.error || 'Swap failed');

      showToast(json.message || 'Slots swapped successfully!');
      setSwapSource(null);
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Error swapping slots');
    } finally {
      setIsSwapping(false);
    }
  };

  const openAssignModal = (dayOfWeek: number, period: PeriodItem, existingSlot?: SlotItem | null) => {
    setActiveSlotModal({ dayOfWeek, period, existingSlot });
    setClashWarning(null);

    if (existingSlot) {
      setSelectedSubjectId(existingSlot.subjectId || '');
      setSelectedStaffId(existingSlot.staffId || '');
      setRoom(existingSlot.room || '');
    } else {
      setSelectedSubjectId('');
      setSelectedStaffId('');
      setRoom('');
    }
  };

  // When subject changes in modal, auto-fill teacher from TeachingAssignment
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setClashWarning(null);

    const assignment = data?.teachingAssignments?.find((ta) => ta.subjectId === subjectId);
    if (assignment) {
      setSelectedStaffId(assignment.staffId);
    }
  };

  const handleSaveSlot = async (ignoreClash = false) => {
    if (!activeSlotModal) return;
    setSubmittingSlot(true);

    try {
      const res = await fetch('/api/tenant/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          classLevelId: selectedClassId,
          dayOfWeek: activeSlotModal.dayOfWeek,
          periodId: activeSlotModal.period.id,
          subjectId: selectedSubjectId || null,
          staffId: selectedStaffId || null,
          room: room.trim() || null,
          ignoreClash,
        }),
      });

      const json = await res.json();

      if (res.status === 409 && json.clash) {
        setClashWarning({ message: json.error, clashDetails: json.clashDetails });
        return;
      }

      if (!res.ok) throw new Error(json.error || 'Failed to update timetable slot');

      showToast('Timetable updated successfully!');
      setActiveSlotModal(null);
      setClashWarning(null);
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Error updating slot');
    } finally {
      setSubmittingSlot(false);
    }
  };

  const handleClearSlot = async (dayOfWeek: number, periodId: string) => {
    if (!confirm('Clear this period slot?')) return;
    try {
      const res = await fetch(
        `/api/tenant/timetable?slug=${slug}&classLevelId=${selectedClassId}&dayOfWeek=${dayOfWeek}&periodId=${periodId}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to clear slot');

      showToast('Slot cleared.');
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Error clearing slot');
    }
  };

  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod?.name || !editingPeriod?.startTime || !editingPeriod?.endTime) return;

    setSavingPeriod(true);
    try {
      const res = await fetch('/api/tenant/timetable/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          id: editingPeriod.id || undefined,
          name: editingPeriod.name,
          startTime: editingPeriod.startTime,
          endTime: editingPeriod.endTime,
          orderIndex: editingPeriod.orderIndex ?? periodsList.length + 1,
          isBreak: editingPeriod.isBreak || false,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save period');

      showToast('Bell schedule period updated!');
      setEditingPeriod(null);
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Error saving period');
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleDeletePeriod = async (periodId: string) => {
    if (!confirm('Delete this period? Any timetable slots using this period will also be removed.')) return;
    try {
      const res = await fetch(`/api/tenant/timetable/periods?slug=${slug}&id=${periodId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete period');

      showToast('Period removed.');
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Error deleting period');
    }
  };

  // Build slot lookup: key = `${dayOfWeek}-${periodId}`
  const slotMap = new Map<string, SlotItem>();
  if (data?.slots) {
    for (const s of data.slots) {
      slotMap.set(`${s.dayOfWeek}-${s.periodId}`, s);
    }
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-3 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Class Timetable Manager</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Weekly Schedule
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Build and manage Monday to Friday class schedules with automated teacher conflict checks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Class Selector Dropdown */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
            <span className="text-xs font-bold text-slate-500">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="text-xs font-black text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Timetable</span>
          </button>

          {/* Periods / Bell Schedule Config (Admin Only) */}
          {isAdmin && (
            <button
              onClick={() => setIsPeriodsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Bell Schedule &amp; Periods</span>
            </button>
          )}
        </div>
      </div>

      {/* Smart Operations Bar (Admin Only) */}
      {isAdmin && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 print:hidden shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1 mr-1">
              Smart Actions:
            </span>

            {/* Auto-Generate Button */}
            <button
              onClick={() => setIsAutoGenerateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ Auto-Generate Schedule</span>
            </button>

            {/* Copy from Class Button */}
            {classes.length > 1 && (
              <button
                onClick={() => setIsCopyModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy from Class...</span>
              </button>
            )}

            {/* Clear Timetable Button */}
            {data?.slots && data.slots.length > 0 && (
              <button
                onClick={() => setIsClearModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Clear Timetable</span>
              </button>
            )}
          </div>

          {/* Classroom Hub Shortcut */}
          <Link
            href={`/${slug}/dashboard/classes`}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 pr-1"
          >
            <span>Classroom Allocations Hub</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {/* Swap Mode Active Banner */}
      {swapSource && (
        <div className="bg-indigo-600 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-lg animate-bounce-subtle print:hidden">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <ArrowLeftRight className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              Swap Mode Active: Click any destination slot on the grid to swap with <strong>"{swapSource.subjectName}"</strong> ({DAYS_OF_WEEK.find((d) => d.day === swapSource.dayOfWeek)?.short}).
            </span>
          </div>
          <button
            onClick={() => setSwapSource(null)}
            className="px-3 py-1 text-xs font-extrabold bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
          >
            Cancel Swap
          </button>
        </div>
      )}

      {/* Printable Sheet Header (Visible only when printing) */}
      <div className="hidden print:block text-center border-b border-slate-300 pb-4 mb-4">
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{tenantName}</h2>
        <h3 className="text-lg font-bold text-slate-700 mt-0.5">
          Official Class Timetable • {selectedClass?.name || 'Class Schedule'}
        </h3>
        <p className="text-xs text-slate-500">Monday to Friday Weekly Academic Schedule</p>
      </div>

      {/* Weekly Timetable Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200 border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 font-extrabold text-[11px] uppercase tracking-wider divide-x divide-slate-200">
                <th className="px-4 py-3.5 w-36 text-center">Period &amp; Time</th>
                {DAYS_OF_WEEK.map((d) => (
                  <th key={d.day} className="px-4 py-3.5 text-center min-w-[170px]">
                    <div>{d.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {!data?.periods || data.periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No periods configured. Click "Bell Schedule &amp; Periods" to set up your school day.
                  </td>
                </tr>
              ) : (
                data.periods.map((period) => {
                  // Dedicated full-width style for breaks (Short Break, Lunch Break)
                  if (period.isBreak) {
                    return (
                      <tr key={period.id} className="bg-slate-100/70 text-slate-600 divide-x divide-slate-200">
                        <td className="px-4 py-2.5 text-center font-bold font-mono text-[11px]">
                          <div>{period.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {period.startTime} – {period.endTime}
                          </div>
                        </td>
                        <td
                          colSpan={5}
                          className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-100/80"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Coffee className="w-3.5 h-3.5 text-amber-600" />
                            {period.name} ({period.startTime} – {period.endTime})
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  // Standard Academic Period Row
                  return (
                    <tr key={period.id} className="divide-x divide-slate-200 hover:bg-slate-50/50 transition-colors">
                      {/* Period Header Column */}
                      <td className="px-4 py-3 text-center bg-slate-50/40">
                        <div className="font-extrabold text-slate-900 text-xs">{period.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {period.startTime} – {period.endTime}
                        </div>
                      </td>

                      {/* Monday to Friday Slots */}
                      {DAYS_OF_WEEK.map((d) => {
                        const slotKey = `${d.day}-${period.id}`;
                        const slot = slotMap.get(slotKey);
                        const isThisSwapSource =
                          swapSource?.dayOfWeek === d.day && swapSource?.periodId === period.id;

                        return (
                          <td
                            key={d.day}
                            onClick={() => {
                              if (swapSource && !isThisSwapSource) {
                                handleExecuteSwap(d.day, period.id);
                              }
                            }}
                            className={`p-2 align-top h-24 relative group transition-all ${
                              swapSource && !isThisSwapSource
                                ? 'cursor-pointer hover:bg-indigo-50/60 ring-inset hover:ring-2 hover:ring-indigo-400'
                                : ''
                            } ${isThisSwapSource ? 'ring-2 ring-indigo-500 bg-indigo-50/70' : ''}`}
                          >
                            {slot?.subject ? (
                              <div
                                className={`h-full p-2.5 rounded-xl border flex flex-col justify-between transition-all shadow-2xs ${
                                  isThisSwapSource
                                    ? 'bg-indigo-100/70 border-indigo-400 ring-2 ring-indigo-500'
                                    : 'bg-blue-50/70 border-blue-200/80 hover:border-blue-400 group-hover:bg-blue-50'
                                }`}
                              >
                                <div>
                                  <div className="font-black text-slate-900 text-xs leading-tight">
                                    {slot.subject.name}
                                  </div>
                                  <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{slot.staff?.name || 'Unassigned Teacher'}</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between mt-2 pt-1 border-t border-blue-200/60">
                                  {slot.room ? (
                                    <span className="text-[10px] font-mono font-bold text-blue-700 flex items-center gap-0.5">
                                      <MapPin className="w-2.5 h-2.5" />
                                      {slot.room}
                                    </span>
                                  ) : (
                                    <span />
                                  )}

                                  {isAdmin && !swapSource && (
                                    <div className="flex items-center gap-1 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openAssignModal(d.day, period, slot);
                                        }}
                                        className="p-1 hover:text-blue-700 text-slate-400 rounded"
                                        title="Edit Slot"
                                      >
                                        <BookOpen className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSwapSource({
                                            dayOfWeek: d.day,
                                            periodId: period.id,
                                            subjectName: slot.subject?.name,
                                          });
                                        }}
                                        className="p-1 hover:text-indigo-700 text-slate-400 rounded"
                                        title="Swap with another slot"
                                      >
                                        <ArrowLeftRight className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleClearSlot(d.day, period.id);
                                        }}
                                        className="p-1 hover:text-rose-600 text-slate-400 rounded"
                                        title="Clear Slot"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}

                                  {isThisSwapSource && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-600 text-white animate-pulse">
                                      Moving
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Empty Slot */
                              <div
                                onClick={() => {
                                  if (!swapSource && isAdmin) {
                                    openAssignModal(d.day, period, null);
                                  }
                                }}
                                className={`h-full rounded-xl border border-dashed flex flex-col items-center justify-center p-2 transition-all ${
                                  swapSource
                                    ? 'border-indigo-300 bg-indigo-50/20 text-indigo-500 hover:border-indigo-500 hover:bg-indigo-100/40'
                                    : 'border-slate-200 text-slate-300 hover:border-blue-400 hover:bg-blue-50/30 hover:text-blue-600'
                                } ${isAdmin ? 'cursor-pointer' : ''}`}
                              >
                                {isAdmin && !swapSource && (
                                  <span className="text-[10px] font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                    <Plus className="w-3 h-3" /> Assign
                                  </span>
                                )}
                                {swapSource && (
                                  <span className="text-[10px] font-bold text-indigo-600 print:hidden">
                                    Place here
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Subject Balance & Quota Overview */}
      {data?.teachingAssignments && data.teachingAssignments.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Weekly Subject Distribution &amp; Balance</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of weekly periods allocated per subject for {selectedClass?.name}.
              </p>
            </div>
            <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
              Total Scheduled: {data.slots.filter((s) => s.subjectId).length} periods
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.teachingAssignments.map((ta) => {
              const count = data.slots.filter((s) => s.subjectId === ta.subjectId).length;
              return (
                <div
                  key={ta.subjectId}
                  className={`p-3 rounded-2xl border transition-all ${
                    count > 0
                      ? 'bg-slate-50/70 border-slate-200'
                      : 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 truncate" title={ta.subjectName}>
                      {ta.subjectName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {count} {count === 1 ? 'period' : 'periods'}/wk
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1 truncate">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{ta.staffName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slot Assignment Modal */}
      {activeSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {activeSlotModal.existingSlot ? 'Edit Timetable Slot' : 'Assign Timetable Slot'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedClass?.name} • {DAYS_OF_WEEK.find((d) => d.day === activeSlotModal.dayOfWeek)?.name} •{' '}
                  {activeSlotModal.period.name} ({activeSlotModal.period.startTime} – {activeSlotModal.period.endTime})
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveSlotModal(null);
                  setClashWarning(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Teacher Clash Warning Banner */}
              {clashWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-2">
                  <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Teacher Schedule Conflict!</span>
                  </div>
                  <p>{clashWarning.message}</p>
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setClashWarning(null)}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Choose Different Teacher
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveSlot(true)}
                      className="px-3 py-1 bg-amber-600 text-white rounded-lg font-extrabold hover:bg-amber-700"
                    >
                      Override Clash
                    </button>
                  </div>
                </div>
              )}

              {/* Subject Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Subject *
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Choose Subject --</option>
                  {data?.teachingAssignments?.map((ta) => (
                    <option key={ta.subjectId} value={ta.subjectId}>
                      {ta.subjectName} ({ta.staffName})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Subjects configured for {selectedClass?.name} with their assigned subject teachers.
                </p>
              </div>

              {/* Room / Hall */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Classroom / Laboratory (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Science Lab 2, Hall C, Room 14"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSlotModal(null);
                    setClashWarning(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingSlot || !selectedSubjectId}
                  onClick={() => handleSaveSlot(false)}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingSlot ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bell Schedule & Periods Editor Modal */}
      {isPeriodsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">School Bell Schedule &amp; Periods</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure the order, start, and end times of periods and break times for all class timetables.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsPeriodsModalOpen(false);
                  setEditingPeriod(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Period Form if editing/creating */}
              {editingPeriod && (
                <form onSubmit={handleSavePeriod} className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3">
                  <div className="font-extrabold text-xs text-blue-900">
                    {editingPeriod.id ? 'Edit Period' : 'Add New Period'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Period Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Period 8"
                        value={editingPeriod.name || ''}
                        onChange={(e) => setEditingPeriod({ ...editingPeriod, name: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={editingPeriod.startTime || ''}
                        onChange={(e) => setEditingPeriod({ ...editingPeriod, startTime: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">End Time</label>
                      <input
                        type="time"
                        required
                        value={editingPeriod.endTime || ''}
                        onChange={(e) => setEditingPeriod({ ...editingPeriod, endTime: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPeriod.isBreak || false}
                        onChange={(e) => setEditingPeriod({ ...editingPeriod, isBreak: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Is Break / Non-academic period (e.g. Lunch or Assembly)</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPeriod(null)}
                        className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingPeriod}
                        className="px-4 py-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        {savingPeriod ? 'Saving...' : 'Save Period'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Existing Periods Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Order</th>
                      <th className="px-4 py-2.5">Period Name</th>
                      <th className="px-4 py-2.5">Duration</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {periodsList.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{p.name}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700">
                          {p.startTime} – {p.endTime}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.isBreak ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Break
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Academic
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setEditingPeriod(p)}
                            className="text-blue-600 hover:underline font-bold text-xs mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePeriod(p.id)}
                            className="text-rose-600 hover:underline font-bold text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!editingPeriod && (
                <button
                  onClick={() =>
                    setEditingPeriod({
                      name: `Period ${periodsList.filter((p) => !p.isBreak).length + 1}`,
                      startTime: '14:30',
                      endTime: '15:15',
                      orderIndex: periodsList.length + 1,
                      isBreak: false,
                    })
                  }
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Another Period Slot
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto-Generate Timetable Confirmation Modal */}
      {isAutoGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Auto-Generate Timetable</h3>
                  <p className="text-xs text-slate-500">{selectedClass?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAutoGenerateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                The smart generator will distribute all <strong>{data?.teachingAssignments?.length || 0} subjects</strong> assigned to {selectedClass?.name} across Monday to Friday:
              </p>

              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 space-y-2 text-xs text-indigo-950">
                <div className="flex items-center gap-2 font-bold text-indigo-900">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Educational Period Balancing:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-indigo-800">
                  <li><strong>Morning Slots:</strong> Core subjects (Mathematics, English Language, Basic Sciences).</li>
                  <li><strong>Afternoon Slots:</strong> Humanities, Arts, Physical Education, and Electives.</li>
                  <li><strong>Zero Double-Bookings:</strong> Cross-checks specialist teachers across all classrooms.</li>
                </ul>
              </div>

              {data?.slots && data.slots.length > 0 && (
                <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  ⚠️ Note: Existing slots for {selectedClass?.name} will be replaced with the new generated schedule.
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAutoGenerateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isAutoGenerating}
                  onClick={handleAutoGenerate}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAutoGenerating ? 'Generating...' : '⚡ Confirm & Auto-Generate'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Timetable from Another Class Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Copy Schedule</h3>
                  <p className="text-xs text-slate-500">Target: {selectedClass?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Source Class Template *
                </label>
                <select
                  value={copySourceClassId}
                  onChange={(e) => setCopySourceClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Choose Class to Copy From --</option>
                  {classes
                    .filter((c) => c.id !== selectedClassId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Copies the period and subject positions. Teachers will be mapped to teachers assigned to {selectedClass?.name}.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCopying || !copySourceClassId}
                  onClick={handleCopyClass}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCopying ? 'Copying...' : 'Confirm Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Timetable Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Clear Class Timetable</h3>
                  <p className="text-xs text-slate-500">{selectedClass?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to clear all <strong>{data?.slots?.length || 0} slots</strong> from the timetable for {selectedClass?.name}? This action cannot be undone.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={handleClearAll}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isClearing ? 'Clearing...' : 'Yes, Clear All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
