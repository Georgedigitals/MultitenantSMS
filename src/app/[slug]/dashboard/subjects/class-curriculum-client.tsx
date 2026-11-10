'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Check, Layers, AlertCircle, Sparkles, Filter, Save, CheckCircle2, ChevronDown, X } from 'lucide-react';
import {
  isSeniorSecondaryClass,
  DepartmentTrack,
  TenantCurriculumConfig,
  ClassSubjectOffering,
  getOfferingDepartments,
} from '@/lib/curriculum-types';

interface ClassCurriculumClientProps {
  slug: string;
  classLevels: Array<{ id: string; name: string; orderIndex: number }>;
  allSubjects: Array<{ id: string; name: string }>;
  initialCurriculum: TenantCurriculumConfig;
}

const TRACK_OPTIONS: Array<{
  id: DepartmentTrack;
  label: string;
  icon: string;
  desc: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}> = [
  {
    id: 'science',
    label: 'Science Track',
    icon: '🔬',
    desc: 'Physics, Chemistry, Biology, Further Maths',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
  },
  {
    id: 'arts',
    label: 'Arts & Humanities',
    icon: '🎭',
    desc: 'Literature, Government, CRS/IRS, History',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
  },
  {
    id: 'commercial',
    label: 'Commercial Track',
    icon: '📊',
    desc: 'Accounting, Commerce, Economics',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
  },
  {
    id: 'general',
    label: 'General Elective (All Tracks)',
    icon: '🌐',
    desc: 'Open to every senior student across all departments',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
];

export function ClassCurriculumClient({
  slug,
  classLevels,
  allSubjects,
  initialCurriculum,
}: ClassCurriculumClientProps) {
  const router = useRouter();

  // Selected class level
  const [selectedClassId, setSelectedClassId] = useState<string>(classLevels[0]?.id || '');
  const [curriculum, setCurriculum] = useState<TenantCurriculumConfig>(initialCurriculum);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdownSubjectId, setOpenDropdownSubjectId] = useState<string | null>(null);

  // Close multi-select dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dept-dropdown-container')) {
        setOpenDropdownSubjectId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedClass = classLevels.find((c) => c.id === selectedClassId);
  const isSenior = isSeniorSecondaryClass(selectedClass);

  // Current class offerings
  const currentOfferings: ClassSubjectOffering[] = curriculum.classes[selectedClassId] || [];
  const offeringsMap = new Map<string, ClassSubjectOffering>(
    currentOfferings.map((o) => [o.subjectId, o])
  );

  const handleToggleSubject = (subjectId: string) => {
    setSuccessMsg(null);
    setErrorMsg(null);

    const exists = offeringsMap.has(subjectId);
    let updated: ClassSubjectOffering[];

    if (exists) {
      // Remove subject from this class
      updated = currentOfferings.filter((o) => o.subjectId !== subjectId);
    } else {
      // Add subject as Core by default
      updated = [
        ...currentOfferings,
        {
          subjectId,
          isElective: false,
          department: isSenior ? 'general' : undefined,
          departments: isSenior ? ['general'] : undefined,
        },
      ];
    }

    setCurriculum((prev) => ({
      ...prev,
      classes: {
        ...prev.classes,
        [selectedClassId]: updated,
      },
    }));
  };

  const handleTypeChange = (subjectId: string, isElective: boolean) => {
    setSuccessMsg(null);
    setErrorMsg(null);

    const updated: ClassSubjectOffering[] = currentOfferings.map((o) => {
      if (o.subjectId === subjectId) {
        const existingDepts = getOfferingDepartments(o);
        return {
          ...o,
          isElective,
          department: isElective ? ((existingDepts[0] || 'general') as DepartmentTrack) : undefined,
          departments: isElective ? existingDepts : undefined,
        };
      }
      return o;
    });

    setCurriculum((prev) => ({
      ...prev,
      classes: {
        ...prev.classes,
        [selectedClassId]: updated,
      },
    }));
  };

  const handleToggleDepartment = (subjectId: string, track: DepartmentTrack) => {
    setSuccessMsg(null);
    setErrorMsg(null);

    const offering = offeringsMap.get(subjectId);
    if (!offering) return;

    const currentDepts = getOfferingDepartments(offering);
    let nextDepts: DepartmentTrack[];

    if (track === 'general') {
      nextDepts = ['general'];
    } else {
      // User clicked a specific department (science, arts, commercial)
      const withoutGeneral = currentDepts.filter((d) => d !== 'general');
      if (withoutGeneral.includes(track)) {
        nextDepts = withoutGeneral.filter((d) => d !== track);
        if (nextDepts.length === 0) {
          nextDepts = ['general']; // Fallback if none left
        }
      } else {
        nextDepts = [...withoutGeneral, track];
      }
    }

    const updated: ClassSubjectOffering[] = currentOfferings.map((o) => {
      if (o.subjectId === subjectId) {
        return {
          ...o,
          isElective: true,
          department: (nextDepts[0] || 'general') as DepartmentTrack,
          departments: nextDepts,
        };
      }
      return o;
    });

    setCurriculum((prev) => ({
      ...prev,
      classes: {
        ...prev.classes,
        [selectedClassId]: updated,
      },
    }));
  };

  const handleSelectAllTracks = (subjectId: string) => {
    setSuccessMsg(null);
    setErrorMsg(null);
    const nextDepts: DepartmentTrack[] = ['science', 'arts', 'commercial'];
    const updated: ClassSubjectOffering[] = currentOfferings.map((o) => {
      if (o.subjectId === subjectId) {
        return {
          ...o,
          isElective: true,
          department: 'science' as DepartmentTrack,
          departments: nextDepts,
        };
      }
      return o;
    });

    setCurriculum((prev) => ({
      ...prev,
      classes: {
        ...prev.classes,
        [selectedClassId]: updated,
      },
    }));
  };

  const handleSelectAllAsCore = () => {
    setSuccessMsg(null);
    const updated: ClassSubjectOffering[] = allSubjects.map((s) => ({
      subjectId: s.id,
      isElective: false,
      department: isSenior ? 'general' : undefined,
      departments: isSenior ? ['general'] : undefined,
    }));

    setCurriculum((prev) => ({
      ...prev,
      classes: {
        ...prev.classes,
        [selectedClassId]: updated,
      },
    }));
  };

  const handleClearAll = () => {
    setSuccessMsg(null);
    setCurriculum((prev) => ({
      ...prev,
      classes: {
        ...prev.classes,
        [selectedClassId]: [],
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/tenant/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, curriculum }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save curriculum');
      }

      setSuccessMsg('Class curriculum offerings updated successfully!');
      router.refresh();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const filteredSubjects = allSubjects.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Class Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <label htmlFor="class-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Select Class Level
            </label>
            <select
              id="class-select"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSuccessMsg(null);
                setErrorMsg(null);
              }}
              className="mt-0.5 block w-full sm:w-64 rounded-xl border-slate-200 text-sm font-bold text-slate-900 focus:border-blue-600 focus:ring-blue-600 py-1.5"
            >
              {classLevels.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} {isSeniorSecondaryClass(lvl) ? '★ (Senior)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Class Mode Badge */}
        <div className="flex items-center gap-3">
          {isSenior ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Senior Class: Core + Electives Supported</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Junior / Primary: 100% Core Curriculum (Zero Elective Overhead)</span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Curriculum'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter / Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Filter subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-lg border-slate-200 px-3 py-1.5 focus:border-blue-600 focus:ring-blue-600"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-slate-500 mr-1">
            {currentOfferings.length} of {allSubjects.length} subjects active
          </span>
          <button
            type="button"
            onClick={handleSelectAllAsCore}
            className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Subjects Configuration Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5 w-16 text-center">Status</th>
              <th className="px-6 py-3.5">Subject Name</th>
              <th className="px-6 py-3.5">Curriculum Role</th>
              {isSenior && <th className="px-6 py-3.5">Department Track</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSubjects.length === 0 ? (
              <tr>
                <td colSpan={isSenior ? 4 : 3} className="px-6 py-12 text-center text-slate-400">
                  No subjects match your search query.
                </td>
              </tr>
            ) : (
              filteredSubjects.map((sub) => {
                const offering = offeringsMap.get(sub.id);
                const isOffered = !!offering;
                const isElective = offering?.isElective || false;
                const dept = offering?.department || 'general';

                return (
                  <tr
                    key={sub.id}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      isOffered ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    {/* Checkbox / Toggle */}
                    <td className="px-6 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isOffered}
                        onChange={() => handleToggleSubject(sub.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>

                    {/* Subject Name */}
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <span>{sub.name}</span>
                      </div>
                    </td>

                    {/* Curriculum Role (Core vs Elective) */}
                    <td className="px-6 py-3.5">
                      {!isOffered ? (
                        <span className="text-xs text-slate-400 font-medium">Not offered</span>
                      ) : !isSenior ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          Core (All Students)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={isElective ? 'elective' : 'core'}
                            onChange={(e) => {
                              const makeElective = e.target.value === 'elective';
                              handleTypeChange(sub.id, makeElective);
                            }}
                            className="text-xs font-bold rounded-lg border-slate-200 py-1 pl-2 pr-6 focus:border-blue-500 focus:ring-blue-500 bg-white"
                          >
                            <option value="core">Core (Compulsory)</option>
                            <option value="elective">Elective (Track)</option>
                          </select>
                        </div>
                      )}
                    </td>

                    {/* Department Track (Only in Senior School) */}
                    {isSenior && (
                      <td className="px-6 py-3.5">
                        {!isOffered || !isElective ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            General Core (All Students)
                          </span>
                        ) : (
                          <div className="relative dept-dropdown-container inline-block text-left">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenDropdownSubjectId(
                                  openDropdownSubjectId === sub.id ? null : sub.id
                                )
                              }
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {(() => {
                                  const depts = getOfferingDepartments(offering);
                                  if (
                                    depts.length === 3 &&
                                    depts.includes('science') &&
                                    depts.includes('arts') &&
                                    depts.includes('commercial')
                                  ) {
                                    return (
                                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        All 3 Tracks (Sci, Art, Com)
                                      </span>
                                    );
                                  }
                                  if (depts.includes('general')) {
                                    return (
                                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        🌐 General Elective
                                      </span>
                                    );
                                  }
                                  return depts.map((d) => {
                                    const opt = TRACK_OPTIONS.find((t) => t.id === d);
                                    if (!opt) return null;
                                    return (
                                      <span
                                        key={d}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${opt.badgeBg} ${opt.badgeText} ${opt.badgeBorder}`}
                                      >
                                        {opt.icon} {opt.label.replace(' Track', '').replace(' & Humanities', '')}
                                      </span>
                                    );
                                  });
                                })()}
                              </div>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                            </button>

                            {/* Floating Dropdown Popover */}
                            {openDropdownSubjectId === sub.id && (
                              <div className="absolute right-0 sm:left-0 mt-1.5 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    Assigned Department Tracks
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setOpenDropdownSubjectId(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="space-y-1.5">
                                  {(() => {
                                    const depts = getOfferingDepartments(offering);
                                    return TRACK_OPTIONS.map((opt) => {
                                      const isChecked =
                                        opt.id === 'general'
                                          ? depts.includes('general')
                                          : depts.includes(opt.id) && !depts.includes('general');

                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() => handleToggleDepartment(sub.id, opt.id)}
                                          className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition cursor-pointer border ${
                                            isChecked
                                              ? `${opt.badgeBg} ${opt.badgeBorder}`
                                              : 'bg-white hover:bg-slate-50 border-transparent'
                                          }`}
                                        >
                                          <div
                                            className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                                              isChecked
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'border-slate-300 bg-white'
                                            }`}
                                          >
                                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-xs">{opt.icon}</span>
                                              <span className="text-xs font-bold text-slate-900 truncate">
                                                {opt.label}
                                              </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                              {opt.desc}
                                            </p>
                                          </div>
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>

                                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllTracks(sub.id)}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                                  >
                                    Select All Tracks
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOpenDropdownSubjectId(null)}
                                    className="px-3 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

