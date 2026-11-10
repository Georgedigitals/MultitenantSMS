'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  Printer,
  Sparkles,
  Coffee,
  User,
  MapPin,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { DAYS_OF_WEEK } from '@/lib/timetable-types';

interface StudentTimetableClientProps {
  slug: string;
  schoolName: string;
  studentName: string;
  className: string;
  isParent: boolean;
  wards: Array<{ id: string; name: string; classLevel: string }>;
  currentWardId: string;
  timetableData: any;
  todaySchedule: any;
}

export default function StudentTimetableClient({
  slug,
  schoolName,
  studentName,
  className,
  isParent,
  wards,
  currentWardId,
  timetableData,
  todaySchedule,
}: StudentTimetableClientProps) {
  const router = useRouter();

  // Slot lookup
  const slotMap = new Map<string, any>();
  if (timetableData?.slots) {
    for (const s of timetableData.slots) {
      slotMap.set(`${s.dayOfWeek}-${s.periodId}`, s);
    }
  }

  const activeSlot = todaySchedule?.activeSlot;
  const upcomingSlot = todaySchedule?.upcomingSlot;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Class Timetable</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {className}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Weekly academic schedule and live period tracker for {studentName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Ward Switcher for Parents */}
          {isParent && wards.length > 1 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-xs font-bold text-slate-500">Child:</span>
              <select
                value={currentWardId}
                onChange={(e) => router.push(`/${slug}/portal/timetable?wardId=${e.target.value}`)}
                className="text-xs font-black text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.classLevel})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Timetable</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Header */}
      <div className="hidden print:block text-center border-b border-slate-300 pb-4 mb-4">
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{schoolName}</h2>
        <h3 className="text-lg font-bold text-slate-700 mt-0.5">
          Weekly Class Timetable • {className}
        </h3>
        <p className="text-xs text-slate-500">Student: {studentName}</p>
      </div>

      {/* Live "Today's Schedule" Hero Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
        {/* Active Class Right Now */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-5 shadow-md flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Right Now
            </span>
            {activeSlot ? (
              <div>
                <h3 className="text-xl font-black text-white">{activeSlot.subject?.name || 'Class Period'}</h3>
                <p className="text-xs text-blue-200 mt-1 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  <span>{activeSlot.staff?.name || 'Teacher'}</span>
                  {activeSlot.room && (
                    <>
                      <span>•</span>
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{activeSlot.room}</span>
                    </>
                  )}
                </p>
                <div className="text-[11px] font-mono text-emerald-300 font-bold mt-2">
                  {activeSlot.period.startTime} – {activeSlot.period.endTime} ({activeSlot.period.name})
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-extrabold text-white">No active class period right now</h3>
                <p className="text-xs text-blue-300/80 mt-1">
                  {todaySchedule?.isWeekend
                    ? 'Weekend - Enjoy your break!'
                    : 'Check your upcoming classes below.'}
                </p>
              </div>
            )}
          </div>
          <BookOpen className="w-12 h-12 text-blue-400/20 z-0 shrink-0" />
        </div>

        {/* Up Next */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-slate-500" />
              Next Class Today
            </span>
            {upcomingSlot ? (
              <div>
                <h3 className="text-lg font-black text-slate-900">{upcomingSlot.subject?.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  <span>{upcomingSlot.staff?.name || 'Teacher'}</span>
                  {upcomingSlot.room && <span>• {upcomingSlot.room}</span>}
                </p>
                <div className="text-[11px] font-mono text-blue-600 font-bold mt-1.5">
                  Starts at {upcomingSlot.period.startTime} ({upcomingSlot.period.name})
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-bold text-slate-700">No further periods scheduled today</h3>
                <p className="text-xs text-slate-400 mt-0.5">Classes for today have completed.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Timetable Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs print:border-none print:shadow-none">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Complete Weekly Timetable (Monday – Friday)
          </h2>
          <span className="text-xs text-slate-400">Class: {className}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200 border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-extrabold text-[11px] uppercase tracking-wider divide-x divide-slate-200">
                <th className="px-4 py-3.5 w-32 text-center">Period &amp; Time</th>
                {DAYS_OF_WEEK.map((d) => (
                  <th key={d.day} className="px-4 py-3.5 text-center min-w-[150px]">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {!timetableData?.periods || timetableData.periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Timetable for {className} has not been published yet.
                  </td>
                </tr>
              ) : (
                timetableData.periods.map((period: any) => {
                  if (period.isBreak) {
                    return (
                      <tr key={period.id} className="bg-slate-100/70 text-slate-600 divide-x divide-slate-200">
                        <td className="px-4 py-2 text-center font-bold font-mono text-[11px]">
                          <div>{period.name}</div>
                          <div className="text-[10px] text-slate-400">{period.startTime} – {period.endTime}</div>
                        </td>
                        <td
                          colSpan={5}
                          className="px-4 py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-100/80"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Coffee className="w-3.5 h-3.5 text-amber-600" />
                            {period.name} ({period.startTime} – {period.endTime})
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={period.id} className="divide-x divide-slate-200 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-center bg-slate-50/40">
                        <div className="font-extrabold text-slate-900 text-xs">{period.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {period.startTime} – {period.endTime}
                        </div>
                      </td>

                      {DAYS_OF_WEEK.map((d) => {
                        const slot = slotMap.get(`${d.day}-${period.id}`);

                        return (
                          <td key={d.day} className="p-2 align-top h-20">
                            {slot?.subject ? (
                              <div className="h-full p-2 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col justify-between shadow-2xs">
                                <div>
                                  <div className="font-black text-slate-900 text-xs leading-tight">
                                    {slot.subject.name}
                                  </div>
                                  <div className="text-[10px] text-slate-600 mt-0.5 truncate">
                                    {slot.staff?.name || 'Teacher'}
                                  </div>
                                </div>
                                {slot.room && (
                                  <div className="text-[9px] font-mono font-bold text-blue-700 flex items-center gap-0.5 mt-1">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {slot.room}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="h-full rounded-xl border border-dashed border-slate-100 flex items-center justify-center text-slate-300 text-[10px]">
                                —
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
    </div>
  );
}
