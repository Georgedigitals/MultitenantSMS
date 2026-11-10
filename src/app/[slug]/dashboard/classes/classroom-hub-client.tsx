'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ArrowRight,
  UserCheck,
  Calendar,
  FileText,
  Search,
  Plus,
  X,
  RefreshCw,
  Sliders,
  Check,
} from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  orderIndex: number;
  division: 'early_years' | 'primary' | 'junior_secondary' | 'senior_secondary';
  isEarlyYears: boolean;
  formTeacher: { id: string; name: string } | null;
  studentCount: number;
  subjects: Array<{
    id: string;
    name: string;
    isElective: boolean;
    assignedTeacher: { id: string; name: string } | null;
  }>;
  totalSubjects: number;
  assignedSubjects: number;
  issues: string[];
  readiness: 'ready' | 'needs_attention' | 'unconfigured';
}

interface StaffOption {
  id: string;
  name: string;
  roleBase: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface ClassroomHubClientProps {
  slug: string;
  schoolName: string;
}

export function ClassroomHubClient({ slug, schoolName }: ClassroomHubClientProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentSession, setCurrentSession] = useState<{ id: string; label: string } | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectOption[]>([]);

  // Filtering & Search
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Selected Classroom Drawer
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchHubData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenant/classes/hub?slug=${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load classroom hub data');

      setCurrentSession(data.currentSession || null);
      setClasses(data.classes || []);
      setStaffList(data.staffList || []);
      setAllSubjects(data.allSubjects || []);
    } catch (err: any) {
      setError(err?.message || 'An error occurred while fetching classroom data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, [slug]);

  // Selected Class details
  const activeClass = classes.find((c) => c.id === selectedClassId) || null;

  // Perform Classroom Action
  const handleClassAction = async (payload: any) => {
    setSavingAction(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await fetch('/api/tenant/classes/hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          sessionId: currentSession?.id,
          classLevelId: selectedClassId,
          ...payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setActionSuccess(data.message || 'Updated successfully');
      setTimeout(() => setActionSuccess(null), 3000);
      await fetchHubData(true);
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to update classroom');
      const cleanMsg = msg.includes('Transaction') || msg.includes('TURBOPACK')
        ? 'Database operation timed out. Please try assigning again.'
        : msg;
      setActionError(cleanMsg);
    } finally {
      setSavingAction(false);
    }
  };

  // Division counts
  const earlyYearsCount = classes.filter((c) => c.division === 'early_years').length;
  const primaryCount = classes.filter((c) => c.division === 'primary').length;
  const jssCount = classes.filter((c) => c.division === 'junior_secondary').length;
  const sssCount = classes.filter((c) => c.division === 'senior_secondary').length;

  // Filtered classes
  const filteredClasses = classes.filter((c) => {
    const matchesDivision =
      selectedDivision === 'all' ||
      (selectedDivision === 'early_years' && c.division === 'early_years') ||
      (selectedDivision === 'primary' && c.division === 'primary') ||
      (selectedDivision === 'junior_secondary' && c.division === 'junior_secondary') ||
      (selectedDivision === 'senior_secondary' && c.division === 'senior_secondary');

    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDivision && matchesSearch;
  });

  const readyClassesCount = classes.filter((c) => c.readiness === 'ready').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5" />
              Classroom Command Hub
            </span>
            {currentSession && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {currentSession.label}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Classes &amp; Teacher Allocations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage form teachers, class curriculums, and subject specialists across all grades in one unified cockpit.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchHubData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href={`/${slug}/dashboard/students`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Enroll Students</span>
          </Link>
        </div>
      </div>

      {/* Progress & Readiness Stat Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Active Classes</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{classes.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Enabled in school ladder</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fully Configured</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {readyClassesCount} <span className="text-xs font-bold text-slate-400">/ {classes.length}</span>
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">Ready for results &amp; attendance</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Needs Attention</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {classes.filter((c) => c.readiness === 'needs_attention').length}
          </div>
          <p className="text-[11px] text-amber-600/80 mt-0.5 font-medium">Missing teacher or subjects</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Enrolled Students</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {classes.reduce((sum, c) => sum + c.studentCount, 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Across all classrooms</p>
        </div>
      </div>

      {/* Division Navigation Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedDivision('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedDivision === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Classes ({classes.length})
          </button>
          {earlyYearsCount > 0 && (
            <button
              onClick={() => setSelectedDivision('early_years')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedDivision === 'early_years'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Early Years ({earlyYearsCount})
            </button>
          )}
          {primaryCount > 0 && (
            <button
              onClick={() => setSelectedDivision('primary')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedDivision === 'primary'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Primary ({primaryCount})
            </button>
          )}
          {jssCount > 0 && (
            <button
              onClick={() => setSelectedDivision('junior_secondary')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedDivision === 'junior_secondary'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Junior Secondary ({jssCount})
            </button>
          )}
          {sssCount > 0 && (
            <button
              onClick={() => setSelectedDivision('senior_secondary')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedDivision === 'senior_secondary'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Senior Secondary ({sssCount})
            </button>
          )}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search class name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-hidden transition"
          />
        </div>
      </div>

      {/* Classroom Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium text-xs bg-white rounded-3xl border border-slate-200">
          Loading classroom allocations...
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="p-12 text-center text-slate-500 font-medium text-xs bg-white rounded-3xl border border-slate-200">
          No classes match your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const isReady = cls.readiness === 'ready';
            const isAttention = cls.readiness === 'needs_attention';

            return (
              <div
                key={cls.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-4">
                  {/* Top Bar: Class Name & Readiness Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {cls.division.replace('_', ' ')}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition">
                        {cls.name}
                      </h3>
                    </div>

                    {isReady && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ready
                      </span>
                    )}
                    {isAttention && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Attention
                      </span>
                    )}
                    {!isReady && !isAttention && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Unconfigured
                      </span>
                    )}
                  </div>

                  {/* Form Teacher Indicator */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500 uppercase tracking-wider">
                        {cls.isEarlyYears ? 'Class Teacher' : 'Form Teacher'}
                      </span>
                      {cls.formTeacher ? (
                        <span className="text-emerald-700 font-semibold text-[10px]">Assigned</span>
                      ) : (
                        <span className="text-amber-600 font-bold text-[10px]">Missing</span>
                      )}
                    </div>
                    <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                        {cls.formTeacher ? cls.formTeacher.name.charAt(0) : '?'}
                      </div>
                      <span className="truncate">{cls.formTeacher?.name || 'No Form Teacher Assigned'}</span>
                    </div>
                  </div>

                  {/* Curriculum & Allocation Progress */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Subjects Assigned:</span>
                      <span className="font-bold text-slate-800">
                        {cls.assignedSubjects} / {cls.totalSubjects}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          cls.totalSubjects > 0 && cls.assignedSubjects === cls.totalSubjects
                            ? 'bg-emerald-500'
                            : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${cls.totalSubjects > 0 ? (cls.assignedSubjects / cls.totalSubjects) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Issues Callout if any */}
                  {cls.issues.length > 0 && (
                    <div className="space-y-1">
                      {cls.issues.slice(0, 2).map((iss, i) => (
                        <p key={i} className="text-[11px] text-amber-700 flex items-center gap-1.5 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="truncate">{iss}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Students count & Manage button */}
                <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cls.studentCount} students</span>
                  </div>

                  <button
                    onClick={() => setSelectedClassId(cls.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 group-hover:translate-x-0.5 transition cursor-pointer"
                  >
                    <span>Manage Class</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CLASSROOM DRAWER / MODAL WORKSPACE */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{activeClass.name}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                      {activeClass.division.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeClass.isEarlyYears
                      ? 'Class Teacher Model: Single teacher takes roll-call and core subjects.'
                      : 'Subject Specialist Model: Dedicated teachers assigned per course.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedClassId(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {actionSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {actionError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* 1. Form Teacher / Class Teacher Section */}
              <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {activeClass.isEarlyYears ? 'Class Teacher (Primary Form Master)' : 'Form Teacher (Class Mistress/Master)'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Responsible for daily roll-call, conduct remarks, and broadsheet submission.
                    </p>
                  </div>

                  {activeClass.isEarlyYears && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ⚡ 1-Click All Subjects Support
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Assigned Teacher
                    </label>
                    <select
                      value={activeClass.formTeacher?.id || ''}
                      onChange={(e) =>
                        handleClassAction({
                          action: 'set_form_teacher',
                          staffId: e.target.value || null,
                        })
                      }
                      disabled={savingAction}
                      className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-hidden transition cursor-pointer"
                    >
                      <option value="">-- No Form Teacher Assigned --</option>
                      {staffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.roleBase})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Primary & Nursery Magic Button */}
                  {activeClass.isEarlyYears && (
                    <div className="pt-2 sm:pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          const teacherId = activeClass.formTeacher?.id;
                          if (!teacherId) {
                            alert('Please select a teacher from the dropdown first.');
                            return;
                          }
                          handleClassAction({
                            action: 'assign_class_teacher_all',
                            staffId: teacherId,
                          });
                        }}
                        disabled={savingAction || !activeClass.formTeacher}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-600/20 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Assign to ALL {activeClass.totalSubjects} Subjects</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Subjects & Specialists Allocation Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      Subject Offerings &amp; Assigned Teachers
                    </h4>
                    <p className="text-xs text-slate-500">
                      {activeClass.isEarlyYears
                        ? 'All subjects assigned to the class teacher by default. You can override individual specialist subjects below.'
                        : 'Assign specialist teachers for each course taught in this class.'}
                    </p>
                  </div>

                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
                    {activeClass.assignedSubjects} / {activeClass.totalSubjects} assigned
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4">Assigned Teacher</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Curriculum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {activeClass.subjects.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            No subjects added to this class curriculum yet.
                          </td>
                        </tr>
                      ) : (
                        activeClass.subjects.map((sub) => (
                          <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {sub.name}
                              {sub.isElective && (
                                <span className="ml-2 text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  Elective
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-4">
                              <select
                                value={sub.assignedTeacher?.id || ''}
                                onChange={(e) =>
                                  handleClassAction({
                                    action: 'assign_subject_teacher',
                                    subjectId: sub.id,
                                    staffId: e.target.value || null,
                                  })
                                }
                                disabled={savingAction}
                                className="w-full max-w-xs text-xs font-medium rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:border-blue-500 outline-hidden transition cursor-pointer"
                              >
                                <option value="">-- Unassigned --</option>
                                {staffList.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {sub.assignedTeacher ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Check className="w-3 h-3" /> Assigned
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  Missing
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  handleClassAction({
                                    action: 'toggle_class_subject',
                                    subjectId: sub.id,
                                    enabled: false,
                                  })
                                }
                                disabled={savingAction}
                                className="text-[11px] font-bold text-red-600 hover:text-red-700 transition cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Add Subject to Class Dropdown */}
                <div className="pt-2 flex items-center gap-2">
                  <select
                    id="addSubjectSelect"
                    defaultValue=""
                    className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="" disabled>
                      + Add Subject to {activeClass.name}...
                    </option>
                    {allSubjects
                      .filter((s) => !activeClass.subjects.some((sub) => sub.id === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const sel = document.getElementById('addSubjectSelect') as HTMLSelectElement;
                      if (sel && sel.value) {
                        handleClassAction({
                          action: 'toggle_class_subject',
                          subjectId: sel.value,
                          enabled: true,
                        });
                        sel.value = '';
                      }
                    }}
                    disabled={savingAction}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
                  >
                    Add to Curriculum
                  </button>
                </div>
              </div>

              {/* 3. Class Quick Shortcuts */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-blue-950">Next Steps &amp; Direct Shortcuts</h5>
                    <p className="text-[11px] text-blue-700">Jump straight into this classroom's timetable or results broadsheet.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/${slug}/dashboard/timetable?classLevelId=${activeClass.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs transition"
                  >
                    <span>Timetable</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                  <Link
                    href={`/${slug}/dashboard/results/broadsheet?classLevelId=${activeClass.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition"
                  >
                    <span>Results Broadsheet</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedClassId(null)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

