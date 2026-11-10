'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  CalendarDays,
  Plus,
  AlertCircle,
  X,
} from 'lucide-react';

interface MyAttendanceClientProps {
  slug: string;
  staff: {
    id: string;
    name: string;
  };
  todayRecord: {
    status: string;
    clockInTime: string | null;
    clockOutTime: string | null;
    minutesLate: number;
    method: string;
    notes: string | null;
  } | null;
  history: Array<{
    id: string;
    date: string;
    status: string;
    clockInTime: string | null;
    clockOutTime: string | null;
    minutesLate: number;
    method: string;
  }>;
  leaveRequests: Array<{
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: string;
    adminNotes: string | null;
    createdAt: string;
  }>;
}

export default function MyAttendanceClient({
  slug,
  staff,
  todayRecord: initialTodayRecord,
  history: initialHistory,
  leaveRequests: initialLeaveRequests,
}: MyAttendanceClientProps) {
  const todayRecord = initialTodayRecord;
  const history = initialHistory;
  const [leaveRequests, setLeaveRequests] = useState(initialLeaveRequests);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Leave Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLeave(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/tenant/attendance/staff/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          leaveType,
          startDate,
          endDate,
          reason: leaveReason,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit leave request');

      showToast('Leave request submitted successfully for administrative review!');
      setIsLeaveModalOpen(false);
      setLeaveReason('');
      setStartDate('');
      setEndDate('');

      if (json.request) {
        setLeaveRequests([
          {
            id: json.request.id,
            leaveType: json.request.leaveType,
            startDate: json.request.startDate.split('T')[0],
            endDate: json.request.endDate.split('T')[0],
            reason: json.request.reason,
            status: json.request.status,
            adminNotes: null,
            createdAt: json.request.createdAt,
          },
          ...leaveRequests,
        ]);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to submit leave request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const formatDisplayTime = (isoString: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  // Calculate attendance rate
  const totalDays = history.length;
  const attendedDays = history.filter((h) => h.status === 'present' || h.status === 'late').length;
  const attendanceRate = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-3 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Attendance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome, {staff.name}. Review attendance records and manage leave requests.
          </p>
        </div>

        <button
          onClick={() => setIsLeaveModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Request Leave / Permission</span>
        </button>
      </div>

      {errorBanner && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Attendance summary">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Today’s attendance</p>
          <p className="mt-2 text-lg font-black text-slate-900">
            {todayRecord?.clockInTime
              ? todayRecord.status === 'late' ? `Checked in late · ${formatDisplayTime(todayRecord.clockInTime)}` : `Checked in · ${formatDisplayTime(todayRecord.clockInTime)}`
              : 'No check-in recorded yet'}
          </p>
          {todayRecord?.clockOutTime && <p className="mt-1 text-sm text-slate-600">Checked out at {formatDisplayTime(todayRecord.clockOutTime)}</p>}
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Attendance is recorded at the school office. Present your staff ID card to the administrator at the attendance terminal when you arrive and leave.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Attendance rate</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{attendanceRate}%</p>
          <p className="mt-1 text-sm text-slate-600">{attendedDays} of {totalDays} recorded days</p>
        </div>
      </section>

      {/* 30-Day Attendance History */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">Attendance History (Last 30 Days)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Your recent attendance records and punctuality timestamps.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {attendedDays} of {totalDays} days recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-100">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Clock In</th>
                <th className="px-4 py-3">Clock Out</th>
                <th className="px-4 py-3">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No recent attendance logs recorded yet.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-slate-900">
                      {new Date(item.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3.5">
                      {item.status === 'present' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Present
                        </span>
                      )}
                      {item.status === 'late' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Late (+{item.minutesLate}m)
                        </span>
                      )}
                      {item.status === 'absent' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Absent
                        </span>
                      )}
                      {item.status === 'excused' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Excused
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-slate-800">
                      {formatDisplayTime(item.clockInTime)}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-slate-800">
                      {formatDisplayTime(item.clockOutTime)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 capitalize">
                      {item.method.replace('_', ' ')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">My Leave & Permission Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">Submitted requests and administrative approval status.</p>
          </div>
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Request
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {leaveRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">No leave requests submitted.</div>
          ) : (
            leaveRequests.map((req) => (
              <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm capitalize">{req.leaveType} Leave</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        req.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : req.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {req.startDate} to {req.endDate} • "{req.reason}"
                  </div>
                  {req.adminNotes && (
                    <div className="text-xs text-slate-700 mt-1 bg-slate-50 p-2 rounded-lg">
                      Admin remark: {req.adminNotes}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 sm:text-right">
                  Requested {new Date(req.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Leave Request Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scale-up p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-purple-600" />
                Request Leave / Permission
              </h3>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Leave Category
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual / Personal Leave</option>
                  <option value="official">Official Duty / School Assignment</option>
                  <option value="compassionate">Compassionate Leave</option>
                  <option value="maternity">Maternity / Paternity Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason / Explanation
                </label>
                <textarea
                  required
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Explain reason for absence..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingLeave ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
