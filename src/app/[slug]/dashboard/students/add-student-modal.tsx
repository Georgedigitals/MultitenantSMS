'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Copy, Check, ShieldCheck, Mail, Phone, ExternalLink, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import ImageUploadInput from '@/components/image-upload-input';

interface AddStudentModalProps {
  slug: string;
  usableLevels: Array<{ id: string; name: string }>;
  sessions: Array<{ id: string; label: string; isCurrent: boolean }>;
  defaultSessionId?: string;
}

export function AddStudentModal({
  slug,
  usableLevels,
  sessions,
  defaultSessionId,
}: AddStudentModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to check if a class level is early years (Nursery, Creche, KG, Primary 1-3)
  const isEarlyYearsClass = (levelId: string) => {
    const level = usableLevels.find((l) => l.id === levelId);
    if (!level) return false;
    return /nursery|creche|kg|kindergarten|primary\s*[1-3]\b/i.test(level.name);
  };

  // Form states
  const [name, setName] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [classLevelId, setClassLevelId] = useState(usableLevels[0]?.id || '');
  const [sessionId, setSessionId] = useState(
    defaultSessionId || sessions.find((s) => s.isCurrent)?.id || sessions[0]?.id || ''
  );
  const [createStudentAccount, setCreateStudentAccount] = useState(!isEarlyYearsClass(usableLevels[0]?.id || ''));
  const [studentEmail, setStudentEmail] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [club, setClub] = useState('');
  const [favColor, setFavColor] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Onboarding slip state
  const [onboardingSlip, setOnboardingSlip] = useState<{
    student: {
      name: string;
      admissionNumber: string;
      className: string;
      sessionLabel: string;
    };
    studentPortal: {
      created: boolean;
      username?: string | null;
      temporaryPin?: string | null;
      studentEmail?: string | null;
      emailSent?: boolean;
      reason?: string;
    };
    parentPortal: {
      username: string;
      accountCreated: boolean;
      activationUrl?: string | null;
      emailSent: boolean;
      smsSent: boolean;
    };
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleClassChange = (newLevelId: string) => {
    setClassLevelId(newLevelId);
    setCreateStudentAccount(!isEarlyYearsClass(newLevelId));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const resetForm = () => {
    setName('');
    setAdmissionNumber('');
    const initialClassId = usableLevels[0]?.id || '';
    setClassLevelId(initialClassId);
    setCreateStudentAccount(!isEarlyYearsClass(initialClassId));
    setStudentEmail('');
    setSessionId(defaultSessionId || sessions.find((s) => s.isCurrent)?.id || sessions[0]?.id || '');
    setGuardianName('');
    setGuardianPhone('');
    setGuardianEmail('');
    setGender('');
    setDob('');
    setHeight('');
    setWeight('');
    setClub('');
    setFavColor('');
    setAvatarUrl('');
    setError(null);
    setOnboardingSlip(null);
    setCopiedKey(null);
  };

  const handleOpen = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleClose = () => {
    resetForm();
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please provide the student's full name.");
      return;
    }
    if (!classLevelId) {
      setError('Please select an enrolled class level.');
      return;
    }
    if (!sessionId) {
      setError('Please select an academic session.');
      return;
    }
    if (!guardianEmail.trim() && !guardianPhone.trim()) {
      setError('Add a parent or guardian email or phone number to set up parent portal access.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/tenant/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          admissionNumber: admissionNumber.trim() || undefined,
          classLevelId,
          sessionId,
          createStudentAccount,
          studentEmail: studentEmail.trim() || undefined,
          guardianContactInfo: {
            name: guardianName.trim() || undefined,
            phone: guardianPhone.trim() || undefined,
            email: guardianEmail.trim() || undefined,
            gender: gender || undefined,
            dob: dob || undefined,
            height: height.trim() || undefined,
            weight: weight.trim() || undefined,
            club: club.trim() || undefined,
            favColor: favColor.trim() || undefined,
            avatarUrl: avatarUrl || undefined,
          },
        }),
      });

      let data: any = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server returned unexpected response (${res.status}). Please try again.`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to enroll student');
      }

      const selectedClass = usableLevels.find((l) => l.id === classLevelId);
      const selectedSession = sessions.find((s) => s.id === sessionId);

      setOnboardingSlip({
        student: {
          name: data.student?.name || name.trim(),
          admissionNumber: data.student?.admissionNumber || admissionNumber.trim() || 'Assigned',
          className: selectedClass?.name || 'Assigned Class',
          sessionLabel: selectedSession?.label || '',
        },
        studentPortal: data.studentPortal || {
          created: false,
          reason: 'Parent-managed only',
        },
        parentPortal: data.parentPortal || {
          username: guardianEmail || guardianPhone,
          accountCreated: true,
          emailSent: Boolean(guardianEmail),
          smsSent: Boolean(guardianPhone),
        },
      });

      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred while enrolling the student');
    } finally {
      setLoading(false);
    }
  };

  const getFullSlipText = () => {
    if (!onboardingSlip) return '';
    const parts = [
      `🎓 STUDENT ENROLLMENT SLIP`,
      `School: ${slug.toUpperCase()}`,
      `Student: ${onboardingSlip.student.name}`,
      `Class: ${onboardingSlip.student.className} (${onboardingSlip.student.sessionLabel})`,
      `Admission No: ${onboardingSlip.student.admissionNumber}`,
      ``,
      `👨‍👩‍👦 PARENT PORTAL`,
      `Username: ${onboardingSlip.parentPortal.username}`,
      onboardingSlip.parentPortal.activationUrl
        ? `Activation Link: ${onboardingSlip.parentPortal.activationUrl}`
        : `Access: Existing active parent account`,
      ``,
    ];

    if (onboardingSlip.studentPortal.created) {
      parts.push(
        `🧑‍🎓 STUDENT PORTAL`,
        `Username: ${onboardingSlip.studentPortal.username}`,
        `Initial PIN: ${onboardingSlip.studentPortal.temporaryPin}`,
        `Portal URL: /${slug}/portal`
      );
    } else {
      parts.push(`🧑‍🎓 STUDENT PORTAL: Parent-Managed Only (Young Learner)`);
    }

    return parts.join('\n');
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 hover:shadow-lg transition-all duration-150 active:scale-95 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Enroll New Student
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Enroll Student</h3>
                  <p className="text-xs text-slate-500">Register student record, class enrollment, and portal access</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto">
              {onboardingSlip ? (
                /* Onboarding Slip Card */
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-900">
                        {onboardingSlip.student.name} Successfully Enrolled!
                      </h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Class: <span className="font-semibold">{onboardingSlip.student.className}</span> • Admission No: <span className="font-semibold">{onboardingSlip.student.admissionNumber}</span>
                      </p>
                    </div>
                  </div>

                  {/* Parent Portal Onboarding Section */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                        <h5 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Parent / Guardian Portal</h5>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {onboardingSlip.parentPortal.accountCreated ? 'New Account Created' : 'Linked to Existing Parent'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1.5">
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Username:</span>
                        <span className="font-semibold text-slate-800 font-mono">{onboardingSlip.parentPortal.username}</span>
                      </div>
                      {onboardingSlip.parentPortal.activationUrl ? (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[11px]">One-Click Activation Link:</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(onboardingSlip.parentPortal.activationUrl!, 'parentLink')}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
                            >
                              {copiedKey === 'parentLink' ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-600">Copied Link!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-700 break-all select-all">
                            {onboardingSlip.parentPortal.activationUrl}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            The parent can click this link to set their own password directly. Valid for 48 hours.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 pt-1">
                          The parent already has an active portal login and can access this student immediately.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Student Portal Onboarding Section */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">2</span>
                        <h5 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Student Portal Access</h5>
                      </div>
                      {onboardingSlip.studentPortal.created ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Account Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          Parent-Managed Only
                        </span>
                      )}
                    </div>

                    {onboardingSlip.studentPortal.created ? (
                      <div className="text-xs text-slate-600 space-y-2">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Login Username:</span>
                          <span className="font-bold text-slate-900 font-mono">{onboardingSlip.studentPortal.username}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Initial 6-Digit PIN:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                              {onboardingSlip.studentPortal.temporaryPin}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(onboardingSlip.studentPortal.temporaryPin!, 'studentPin')}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                            >
                              {copiedKey === 'studentPin' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        {onboardingSlip.studentPortal.studentEmail ? (
                          <p className="text-[11px] text-emerald-600 pt-1">
                            ✓ Login credentials were sent directly to student email ({onboardingSlip.studentPortal.studentEmail}).
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 pt-1">
                            Share this PIN with the student for their initial portal sign-in.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">
                        No student login account was created for this student. Perfect for early childhood and young learners; attendance, homework, and report cards are managed exclusively through the parent portal.
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getFullSlipText(), 'fullSlip')}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    >
                      {copiedKey === 'fullSlip' ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">Slip Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-600" />
                          <span>Copy WhatsApp / Print Slip</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Enrollment Form */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Student Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Samuel Adeyemi"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-hidden transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Admission Number
                      </label>
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                        Leave blank to auto-generate
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. APEX/2026/0001 (Auto-generated if blank)"
                      value={admissionNumber}
                      onChange={(e) => setAdmissionNumber(e.target.value)}
                      className="w-full text-xs font-mono rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-hidden transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Class Level <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={classLevelId}
                        onChange={(e) => handleClassChange(e.target.value)}
                        required
                        className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-hidden transition font-medium"
                      >
                        {usableLevels.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Academic Session <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        required
                        className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-hidden transition font-medium"
                      >
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label} {s.isCurrent ? '(Current)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Age-Smart Student Portal Account Card */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createStudentAccount}
                        onChange={(e) => setCreateStudentAccount(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>Enable Student Portal Account</span>
                          {isEarlyYearsClass(classLevelId) && !createStudentAccount && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-200">
                              Early years: Parent-managed recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {createStudentAccount
                            ? 'Student will be able to log in with their Admission Number to view timetables, CBT tests, and report cards.'
                            : 'No student login created. All academic records, fee bills, and reports are managed via the parent portal.'}
                        </p>
                      </div>
                    </label>

                    {createStudentAccount && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Student Personal Email <span className="text-slate-400 font-normal">(Optional — for high school / senior students)</span>
                        </label>
                        <input
                          type="email"
                          placeholder="student@example.com (Optional)"
                          value={studentEmail}
                          onChange={(e) => setStudentEmail(e.target.value)}
                          className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-hidden transition"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          If entered, student login instructions will be sent directly to the student rather than the parent inbox.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Parent / Guardian Information */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Parent / Guardian Contact
                      </span>
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                        Receives activation link &amp; fee bills
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Guardian Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Mr. & Mrs. Adeyemi"
                          value={guardianName}
                          onChange={(e) => setGuardianName(e.target.value)}
                          className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-hidden transition"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Guardian Phone Number <span className="text-slate-400 font-normal">(→ activation SMS)</span>
                          </label>
                          <input
                            type="tel"
                            placeholder="e.g. 08012345678"
                            value={guardianPhone}
                            onChange={(e) => setGuardianPhone(e.target.value)}
                            className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-hidden transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Guardian Email <span className="text-slate-400 font-normal">(→ one-click activation link)</span>
                          </label>
                          <input
                            type="email"
                            placeholder="parent@example.com"
                            value={guardianEmail}
                            onChange={(e) => setGuardianEmail(e.target.value)}
                            className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-hidden transition"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Profile for Report Cards */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="pt-1 space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Student Profile (Optional — for report cards)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gender</label>
                          <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5"
                          >
                            <option value="">Not provided</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date of birth</label>
                          <input
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Height</label>
                          <input
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            maxLength={30}
                            placeholder="e.g. 142 cm"
                            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Weight</label>
                          <input
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            maxLength={30}
                            placeholder="e.g. 38 kg"
                            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Club / society</label>
                          <input
                            value={club}
                            onChange={(e) => setClub(e.target.value)}
                            maxLength={100}
                            placeholder="e.g. Chess Club"
                            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Favourite colour</label>
                          <input
                            value={favColor}
                            onChange={(e) => setFavColor(e.target.value)}
                            maxLength={40}
                            placeholder="e.g. Green"
                            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5"
                          />
                        </div>
                      </div>
                      <ImageUploadInput
                        label="Student passport photo"
                        value={avatarUrl}
                        onChange={setAvatarUrl}
                        endpoint="/api/tenant/upload"
                        folder="students"
                        helperText="Used on the student's report card."
                        previewShape="square"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={loading}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {loading ? 'Enrolling Student...' : 'Enroll Student'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
