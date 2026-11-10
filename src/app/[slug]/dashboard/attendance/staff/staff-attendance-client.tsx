'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  CalendarDays,
  FileSpreadsheet,
  ScanLine,
  Settings,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Edit3,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  MapPin,
  Calendar,
  Copy,
} from 'lucide-react';

interface StaffAttendanceItem {
  staffId: string;
  staffName: string;
  roleBase: string;
  staffCode: string;
  attendancePin: string;
  userEmail: string | null;
  phone: string | null;
  recordId: string | null;
  status: 'present' | 'late' | 'absent' | 'excused' | 'half_day';
  clockInTime: string | null;
  clockOutTime: string | null;
  minutesLate: number;
  method: string;
  notes: string | null;
}

interface StaffAttendanceData {
  date: string;
  totalStaff: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  roster: StaffAttendanceItem[];
}

interface TenantAttendanceSettings {
  workStartTime: string;
  lateThresholdTime: string;
  workEndTime: string;
  campusLatitude: number | null;
  campusLongitude: number | null;
  campusRadiusMeters: number;
  enableGeofenceAttendance: boolean;
}

interface StaffAttendanceClientProps {
  slug: string;
  tenantName: string;
  initialDate: string;
  initialData: StaffAttendanceData;
  pendingLeavesCount: number;
  settings: TenantAttendanceSettings;
}

export default function StaffAttendanceClient({
  slug,
  tenantName,
  initialDate,
  initialData,
  pendingLeavesCount,
  settings: initialSettings,
}: StaffAttendanceClientProps) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [data, setData] = useState<StaffAttendanceData>(initialData);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<TenantAttendanceSettings>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);

  // Manual Mark / Edit Modal State
  const [editingStaff, setEditingStaff] = useState<StaffAttendanceItem | null>(null);
  const [editStatus, setEditStatus] = useState<string>('present');
  const [editClockIn, setEditClockIn] = useState<string>('');
  const [editClockOut, setEditClockOut] = useState<string>('');
  const [editMinutesLate, setEditMinutesLate] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Leave Requests Drawer State
  const [isLeavesOpen, setIsLeavesOpen] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [leaveCount, setLeaveCount] = useState(pendingLeavesCount);

  // Timesheet Export State
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().split('T')[0];
  });
  const [exportEndDate, setExportEndDate] = useState(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().split('T')[0];
  });
  const [exportingTimesheet, setExportingTimesheet] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchRoster = async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/attendance/staff?slug=${slug}&date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load attendance');
      setData(json);
    } catch (err: any) {
      showToast(err.message || 'Error loading attendance');
    } finally {
      setLoading(false);
    }
  };

  // Real-time Live Polling: automatically update today's attendance every 5 seconds
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (currentDate !== todayStr) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tenant/attendance/staff?slug=${slug}&date=${currentDate}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [slug, currentDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setCurrentDate(newDate);
    fetchRoster(newDate);
  };

  const openEditModal = (staff: StaffAttendanceItem) => {
    setEditingStaff(staff);
    setEditStatus(staff.status);
    setEditClockIn(staff.clockInTime ? staff.clockInTime.slice(11, 16) : '');
    setEditClockOut(staff.clockOutTime ? staff.clockOutTime.slice(11, 16) : '');
    setEditMinutesLate(staff.minutesLate || 0);
    setEditNotes(staff.notes || '');
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setSubmittingEdit(true);
    try {
      // Build ISO times if specified
      let fullClockIn: string | undefined = undefined;
      let fullClockOut: string | undefined = undefined;

      if (editClockIn) {
        fullClockIn = `${currentDate}T${editClockIn}:00.000Z`;
      }
      if (editClockOut) {
        fullClockOut = `${currentDate}T${editClockOut}:00.000Z`;
      }

      const res = await fetch('/api/tenant/attendance/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          staffId: editingStaff.staffId,
          date: currentDate,
          status: editStatus,
          clockInTime: fullClockIn,
          clockOutTime: fullClockOut,
          minutesLate: editMinutesLate,
          notes: editNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update record');

      showToast(`Updated attendance for ${editingStaff.staffName}`);
      setEditingStaff(null);
      fetchRoster(currentDate);
    } catch (err: any) {
      showToast(err.message || 'Error saving attendance');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/tenant/settings?slug=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workStartTime: settings.workStartTime,
          lateThresholdTime: settings.lateThresholdTime,
          workEndTime: settings.workEndTime,
          campusLatitude: settings.campusLatitude,
          campusLongitude: settings.campusLongitude,
          campusRadiusMeters: settings.campusRadiusMeters,
          enableGeofenceAttendance: settings.enableGeofenceAttendance,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save settings');

      showToast('Attendance work schedule updated successfully!');
      setIsSettingsOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Error updating settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const openLeavesDrawer = async () => {
    setIsLeavesOpen(true);
    setLoadingLeaves(true);
    try {
      const res = await fetch(`/api/tenant/attendance/staff/leave?slug=${slug}`);
      const json = await res.json();
      if (res.ok) {
        setLeaveRequests(json.requests || []);
        const pending = (json.requests || []).filter((r: any) => r.status === 'pending').length;
        setLeaveCount(pending);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const handleReviewLeave = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/tenant/attendance/staff/leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, requestId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to review request');

      showToast(`Leave request ${status}`);
      openLeavesDrawer();
      fetchRoster(currentDate);
    } catch (err: any) {
      showToast(err.message || 'Error reviewing leave');
    }
  };

  const handleExportTimesheet = async () => {
    setExportingTimesheet(true);
    try {
      const res = await fetch(
        `/api/tenant/attendance/staff/timesheet?slug=${slug}&startDate=${exportStartDate}&endDate=${exportEndDate}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch timesheet');

      const rows = (json.timesheet || []).map((t: any) => [
        t.staffCode,
        `"${t.staffName}"`,
        t.roleBase,
        t.expectedWorkingDays,
        t.presentDays,
        t.lateDays,
        t.totalLateMinutes,
        t.absentDays,
        t.excusedDays,
        `${t.attendancePercentage}%`,
      ]);

      const headers = [
        'Staff Code',
        'Staff Name',
        'Role',
        'Working Days',
        'Days Present',
        'Days Late',
        'Late (Mins)',
        'Days Absent',
        'Excused / Leave',
        'Attendance %',
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `staff-timesheet-${slug}-${exportStartDate}-to-${exportEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Timesheet CSV downloaded successfully!');
      setIsExportOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Export failed');
    } finally {
      setExportingTimesheet(false);
    }
  };

  // Filter roster
  const filteredRoster = (data.roster || []).filter((item) => {
    const matchQuery =
      item.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.staffCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roleBase.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchQuery && matchStatus;
  });

  const formatDisplayTime = (isoString: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-3 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff Attendance & Punctuality</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Admin Control
            </span>
            {currentDate === new Date().toISOString().split('T')[0] && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Real-Time
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time staff check-in roster, late arrival monitoring, and timesheet reports for {tenantName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Launch Dedicated Kiosk Terminal (Teachers cannot access admin dashboard) */}
          <Link
            href={`/${slug}/attendance/staff`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
            title="Open Dedicated School Attendance Terminal (Safely isolated from Admin Dashboard)"
          >
            <ScanLine className="w-4 h-4 text-emerald-400" />
            <span>Open Attendance Terminal</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>

          {/* Copy Terminal URL button */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                const isSubdomain = window.location.hostname.startsWith(`${slug}.`);
                const url = isSubdomain
                  ? `${window.location.origin}/attendance/staff`
                  : `${window.location.origin}/${slug}/attendance/staff`;
                navigator.clipboard.writeText(url);
                showToast('Kiosk URL copied to clipboard! Open on school tablet/station.');
              }
            }}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl transition-all shadow-2xs"
            title="Copy Terminal URL for School Tablet / Reception"
          >
            <Copy className="w-4 h-4 text-slate-600" />
          </button>

          {/* Leave Requests Button with Badge */}
          <button
            onClick={openLeavesDrawer}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs relative"
          >
            <CalendarDays className="w-4 h-4 text-slate-500" />
            <span>Leave Requests</span>
            {leaveCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center -ml-1">
                {leaveCount}
              </span>
            )}
          </button>

          {/* Export Timesheet */}
          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Timesheet</span>
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl transition-all shadow-2xs"
            title="Attendance Rules & Work Hours"
          >
            <Settings className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Date Bar & KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Date Selector Box */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-1 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-center">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-500" /> Date
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={currentDate}
              onChange={handleDateChange}
              className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {loading && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
          </div>
        </div>

        {/* Metric: Total Staff */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-600" /> Total Staff
          </div>
          <div className="text-2xl font-black text-slate-900">{data.totalStaff}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active personnel</div>
        </div>

        {/* Metric: Present */}
        <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Present (On Time)
          </div>
          <div className="text-2xl font-black text-emerald-700">{data.presentCount}</div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">Before {settings.lateThresholdTime}</div>
        </div>

        {/* Metric: Late */}
        <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Late Arrivals
          </div>
          <div className="text-2xl font-black text-amber-800">{data.lateCount}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Past {settings.lateThresholdTime} cut-off</div>
        </div>

        {/* Metric: Absent */}
        <div className="bg-red-50/50 p-3.5 rounded-2xl border border-red-200 shadow-2xs">
          <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-600" /> Unrecorded / Absent
          </div>
          <div className="text-2xl font-black text-red-700">{data.absentCount}</div>
          <div className="text-[11px] text-red-600 mt-0.5">No check-in record</div>
        </div>

        {/* Metric: Excused */}
        <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200 shadow-2xs">
          <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-purple-600" /> On Leave / Excused
          </div>
          <div className="text-2xl font-black text-purple-700">{data.excusedCount}</div>
          <div className="text-[11px] text-purple-600 mt-0.5">Authorized absences</div>
        </div>
      </div>

      {/* Roster Controls: Filter Bar & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff by name, code (STF-...), or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {[
            { key: 'all', label: 'All Staff' },
            { key: 'present', label: 'Present' },
            { key: 'late', label: 'Late' },
            { key: 'absent', label: 'Absent' },
            { key: 'excused', label: 'On Leave' },
          ].map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFilterStatus(pill.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === pill.key
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Staff Member</th>
                <th className="px-4 py-3.5">Staff Code & PIN</th>
                <th className="px-4 py-3.5">Today's Status</th>
                <th className="px-4 py-3.5">Clock In</th>
                <th className="px-4 py-3.5">Clock Out</th>
                <th className="px-4 py-3.5">Method</th>
                <th className="px-4 py-3.5">Notes</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No staff records match the selected filter for {currentDate}.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((item) => {
                  return (
                    <tr key={item.staffId} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Role */}
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">{item.staffName}</div>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {item.roleBase} • {item.userEmail || 'No email registered'}
                        </div>
                      </td>

                      {/* Staff Code & Kiosk PIN */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] inline-block">
                          {item.staffCode}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          PIN: <span className="font-mono font-bold text-slate-600">{item.attendancePin}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5">
                        {item.status === 'present' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Present
                          </span>
                        )}
                        {item.status === 'late' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Late (+{item.minutesLate}m)
                          </span>
                        )}
                        {item.status === 'absent' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <X className="w-3 h-3 text-rose-600" />
                            Absent
                          </span>
                        )}
                        {item.status === 'excused' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <CalendarDays className="w-3 h-3 text-purple-600" />
                            On Leave
                          </span>
                        )}
                        {item.status === 'half_day' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            Half Day
                          </span>
                        )}
                      </td>

                      {/* Clock In */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">{formatDisplayTime(item.clockInTime)}</div>
                        {item.minutesLate > 0 && (
                          <div className="text-[10px] text-amber-600 font-bold">+{item.minutesLate} mins late</div>
                        )}
                      </td>

                      {/* Clock Out */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">{formatDisplayTime(item.clockOutTime)}</div>
                        {!item.clockOutTime && item.clockInTime && (
                          <div className="text-[10px] text-blue-600 font-medium">In session</div>
                        )}
                      </td>

                      {/* Check-In Method */}
                      <td className="px-4 py-3.5 text-slate-500">
                        {item.method === 'kiosk_qr' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-mono">
                            <ScanLine className="w-3 h-3 text-emerald-600" /> QR Badge
                          </span>
                        )}
                        {item.method === 'kiosk_pin' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-mono">
                            Keypad PIN
                          </span>
                        )}
                        {item.method === 'mobile_gps' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium">
                            <MapPin className="w-3 h-3 text-blue-600" /> Mobile GPS
                          </span>
                        )}
                        {item.method === 'admin_manual' && (
                          <span className="text-[11px] text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded">
                            Admin Manual
                          </span>
                        )}
                        {item.method === 'none' && <span className="text-slate-300">—</span>}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate" title={item.notes || ''}>
                        {item.notes || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Edit3 className="w-3 h-3 text-slate-500" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Mark / Adjustment Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Adjust Attendance Record</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingStaff.staffName} ({editingStaff.staffCode}) • {currentDate}
                </p>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Attendance Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'present', label: 'Present' },
                    { id: 'late', label: 'Late' },
                    { id: 'absent', label: 'Absent' },
                    { id: 'excused', label: 'On Leave' },
                    { id: 'half_day', label: 'Half Day' },
                  ].map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setEditStatus(s.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        editStatus === s.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Clock In Time
                  </label>
                  <input
                    type="time"
                    value={editClockIn}
                    onChange={(e) => setEditClockIn(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Clock Out Time
                  </label>
                  <input
                    type="time"
                    value={editClockOut}
                    onChange={(e) => setEditClockOut(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {editStatus === 'late' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Minutes Late
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editMinutesLate}
                    onChange={(e) => setEditMinutesLate(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Administrative Note / Reason
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Traffic delay reported, official duty permission..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Requests Drawer */}
      {isLeavesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-slide-left">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-purple-600" />
                  Staff Leave & Permissions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and grant staff absence permissions. Approved leaves automatically reflect as Excused.
                </p>
              </div>
              <button
                onClick={() => setIsLeavesOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingLeaves ? (
                <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Loading leave requests...</span>
                </div>
              ) : leaveRequests.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No leave requests found</p>
                  <p className="text-xs text-slate-400 mt-1">Staff leave submissions will appear here.</p>
                </div>
              ) : (
                leaveRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{req.staff?.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {req.staff?.staffCode} • {req.staff?.roleBase}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
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

                    <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Period:</span>
                        <span className="font-bold text-slate-800">
                          {new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Type:</span>
                        <span className="font-bold text-purple-700 uppercase tracking-wide">{req.leaveType}</span>
                      </div>
                      <div className="pt-1 text-slate-700 italic border-t border-slate-200 mt-1">
                        "{req.reason}"
                      </div>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleReviewLeave(req.id, 'rejected')}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors border border-rose-200"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleReviewLeave(req.id, 'approved')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Excuse</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Staff Attendance Schedule & Rules</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure school opening hours, late arrival grace period, and geofencing.
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Work Start Time
                  </label>
                  <input
                    type="time"
                    value={settings.workStartTime}
                    onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-[10px] text-slate-400">Official resumption</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Late Cut-Off Time
                  </label>
                  <input
                    type="time"
                    value={settings.lateThresholdTime}
                    onChange={(e) => setSettings({ ...settings, lateThresholdTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-[10px] text-slate-400">Arrivals after this flagged Late</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Closing Time
                </label>
                <input
                  type="time"
                  value={settings.workEndTime}
                  onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-[10px] text-slate-400">School dismissal / clock-out target</span>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">Campus Geofence Verification</div>
                    <div className="text-[11px] text-slate-500">
                      Require teachers using mobile self-service to be on campus.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableGeofenceAttendance}
                    onChange={(e) => setSettings({ ...settings, enableGeofenceAttendance: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>

                {settings.enableGeofenceAttendance && (
                  <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={settings.campusLatitude ?? ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              campusLatitude: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="e.g. 6.5244"
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={settings.campusLongitude ?? ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              campusLongitude: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="e.g. 3.3792"
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white border border-slate-300"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase">
                        Permitted Radius (Meters)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={2000}
                        value={settings.campusRadiusMeters}
                        onChange={(e) => setSettings({ ...settings, campusRadiusMeters: Number(e.target.value) || 200 })}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white border border-slate-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Timesheet Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scale-up p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Export Monthly Staff Timesheet
              </h3>
              <button
                onClick={() => setIsExportOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Generates a comprehensive CSV timesheet aggregating total working days, days present, late arrivals, minutes late, absences, and attendance percentage.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsExportOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={exportingTimesheet}
                onClick={handleExportTimesheet}
                className="px-5 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {exportingTimesheet ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
