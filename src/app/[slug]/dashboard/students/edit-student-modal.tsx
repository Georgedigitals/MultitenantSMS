'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, User, AlertCircle, Check } from 'lucide-react';
import ImageUploadInput from '@/components/image-upload-input';
import { isSeniorSecondaryClass } from '@/lib/curriculum-types';

interface StudentToEdit {
  id: string;
  name: string;
  admissionNo?: string | null;
  admissionNumber?: string | null;
  gender?: string | null;
  dob?: string | Date | null;
  studentEmail?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  height?: string | null;
  weight?: string | null;
  club?: string | null;
  favColor?: string | null;
  avatarUrl?: string | null;
  guardianContactInfo?: string | null;
  currentClassLevelId?: string;
  departmentTrack?: string | null;
}

interface EditStudentModalProps {
  slug: string;
  student: StudentToEdit;
  usableLevels: Array<{ id: string; name: string; orderIndex?: number }>;
  sessions: Array<{ id: string; label: string; isCurrent: boolean }>;
  currentSessionId?: string;
  onSuccess?: () => void;
}

export function EditStudentModal({
  slug,
  student,
  usableLevels,
  sessions,
  currentSessionId,
  onSuccess,
}: EditStudentModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states initialized with student data
  const [name, setName] = useState(student.name || '');
  const [admissionNo, setAdmissionNo] = useState(student.admissionNumber || student.admissionNo || '');
  const [gender, setGender] = useState(student.gender || 'male');
  const [dob, setDob] = useState(student.dob ? new Date(student.dob).toISOString().slice(0, 10) : '');
  const [studentEmail, setStudentEmail] = useState(student.studentEmail || '');
  const [classLevelId, setClassLevelId] = useState(
    student.currentClassLevelId || usableLevels[0]?.id || ''
  );
  const [sessionId, setSessionId] = useState(
    currentSessionId || sessions.find((s) => s.isCurrent)?.id || sessions[0]?.id || ''
  );
  const [guardianName, setGuardianName] = useState(student.guardianName || '');
  const [guardianPhone, setGuardianPhone] = useState(student.guardianPhone || '');
  const [guardianEmail, setGuardianEmail] = useState(student.guardianEmail || '');
  const [height, setHeight] = useState(student.height || '');
  const [weight, setWeight] = useState(student.weight || '');
  const [club, setClub] = useState(student.club || '');
  const [favColor, setFavColor] = useState(student.favColor || '');
  const [avatarUrl, setAvatarUrl] = useState(student.avatarUrl || '');
  const [departmentTrack, setDepartmentTrack] = useState(student.departmentTrack || 'general');

  const selectedClass = usableLevels.find((lvl) => lvl.id === classLevelId);
  const isSenior = isSeniorSecondaryClass(selectedClass);

  const handleOpen = () => {
    setName(student.name || '');
    setAdmissionNo(student.admissionNumber || student.admissionNo || '');
    setGender(student.gender || 'male');
    setDob(student.dob ? new Date(student.dob).toISOString().slice(0, 10) : '');
    setStudentEmail(student.studentEmail || '');
    setClassLevelId(student.currentClassLevelId || usableLevels[0]?.id || '');
    setDepartmentTrack(student.departmentTrack || 'general');
    setGuardianName(student.guardianName || '');
    setGuardianPhone(student.guardianPhone || '');
    setGuardianEmail(student.guardianEmail || '');
    setHeight(student.height || '');
    setWeight(student.weight || '');
    setClub(student.club || '');
    setFavColor(student.favColor || '');
    setAvatarUrl(student.avatarUrl || '');
    setError(null);
    setSuccess(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Student full name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tenant/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: student.id,
          slug,
          name: name.trim(),
          admissionNumber: admissionNo.trim(),
          admissionNo: admissionNo.trim(),
          gender,
          dob,
          studentEmail: studentEmail.trim() || null,
          guardianName: guardianName.trim() || null,
          guardianPhone: guardianPhone.trim() || null,
          guardianEmail: guardianEmail.trim() || null,
          guardianContactInfo: { height, weight, club, favColor, avatarUrl, departmentTrack },
          classLevelId,
          sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update student profile');
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        if (onSuccess) onSuccess();
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-1.5 shadow-2xs"
        title="Edit Student Profile"
      >
        <Pencil className="w-3.5 h-3.5" />
        <span>Edit</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Student Record</h3>
                  <p className="text-xs text-slate-500 font-medium">Update profile details & class level</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex flex-col min-h-0">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Student record updated successfully!</span>
                </div>
              )}

              <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Samuel Okon"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Admission Number
                    </label>
                    <input
                      type="text"
                      value={admissionNo}
                      onChange={(e) => setAdmissionNo(e.target.value)}
                      placeholder="e.g. STU-2026-001"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Class Level *
                    </label>
                    <select
                      value={classLevelId}
                      onChange={(e) => setClassLevelId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                    >
                      {usableLevels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Academic Session
                    </label>
                    <select
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} {s.isCurrent ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isSenior && (
                  <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
                    <label className="block text-xs font-bold uppercase tracking-wider text-blue-900 mb-1.5">
                      Senior Academic Department Track
                    </label>
                    <select
                      value={departmentTrack}
                      onChange={(e) => setDepartmentTrack(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-blue-300 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-2xs"
                    >
                      <option value="general">📚 General / Core Only</option>
                      <option value="science">🔬 Science Track</option>
                      <option value="arts">🎨 Arts & Humanities Track</option>
                      <option value="commercial">📊 Commercial Track</option>
                    </select>
                    <p className="text-[11px] text-blue-700 mt-1">
                      Determines which elective subject scores this student appears on for teachers and report cards.
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Report card profile</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Date of birth</label><input type="date" value={dob ? new Date(dob).toISOString().slice(0, 10) : ''} onChange={(e) => setDob(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Height</label><input value={height} onChange={(e) => setHeight(e.target.value)} maxLength={30} placeholder="e.g. 142 cm" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Weight</label><input value={weight} onChange={(e) => setWeight(e.target.value)} maxLength={30} placeholder="e.g. 38 kg" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Club / society</label><input value={club} onChange={(e) => setClub(e.target.value)} maxLength={100} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Favourite colour</label><input value={favColor} onChange={(e) => setFavColor(e.target.value)} maxLength={40} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></div>
                  </div>
                  <ImageUploadInput label="Student passport photo" value={avatarUrl} onChange={setAvatarUrl} endpoint="/api/tenant/upload" folder="students" helperText="Shown on the report card." previewShape="square" />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Student Login & Recovery Email
                    </h4>
                    {isSenior ? (
                      <span className="text-2xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        Recommended for Senior CBT & Portal
                      </span>
                    ) : (
                      <span className="text-2xs text-slate-400">Optional</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Student Personal Email
                    </label>
                    <input
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder={isSenior ? "student@example.com (Direct password resets & CBT notices)" : "student@example.com (Optional)"}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                    />
                    <p className="text-2xs text-slate-400 mt-1">
                      {isSenior
                        ? "If provided, student password resets are sent directly to this inbox. If blank, resets automatically route to the parent email."
                        : "Optional for primary/junior classes. If blank, resets automatically route to the parent email below."}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Parent / Guardian Contact Details
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Guardian Name
                      </label>
                      <input
                        type="text"
                        value={guardianName}
                        onChange={(e) => setGuardianName(e.target.value)}
                        placeholder="e.g. Mr. John Okon"
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Guardian Phone
                        </label>
                        <input
                          type="tel"
                          value={guardianPhone}
                          onChange={(e) => setGuardianPhone(e.target.value)}
                          placeholder="e.g. +234 801 234 5678"
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Guardian Email
                        </label>
                        <input
                          type="email"
                          value={guardianEmail}
                          onChange={(e) => setGuardianEmail(e.target.value)}
                          placeholder="e.g. guardian@gmail.com"
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
