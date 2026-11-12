'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, UserCheck, AlertCircle, Check } from 'lucide-react';
import ImageUploadInput from '@/components/image-upload-input';

interface StaffToEdit {
  id: string;
  name: string;
  roleBase: 'teacher' | 'admin' | string;
  staffCode?: string | null;
  attendancePin?: string | null;
  contactInfo?: {
    email?: string;
    phone?: string;
    designation?: string;
    avatarUrl?: string;
    bloodGroup?: string;
  } | null;
}

interface EditStaffModalProps {
  slug: string;
  staff: StaffToEdit;
  onSuccess?: () => void;
}

export function EditStaffModal({ slug, staff, onSuccess }: EditStaffModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(staff.name || '');
  const [roleBase, setRoleBase] = useState<'teacher' | 'admin'>(
    staff.roleBase === 'admin' ? 'admin' : 'teacher'
  );
  const [phone, setPhone] = useState(staff.contactInfo?.phone || '');
  const [email, setEmail] = useState(staff.contactInfo?.email || '');
  const [designation, setDesignation] = useState(staff.contactInfo?.designation || '');
  const [bloodGroup, setBloodGroup] = useState(staff.contactInfo?.bloodGroup || '');
  const [avatarUrl, setAvatarUrl] = useState(staff.contactInfo?.avatarUrl || '');
  const [staffCode, setStaffCode] = useState(staff.staffCode || '');
  const [attendancePin, setAttendancePin] = useState(staff.attendancePin || '1234');

  const handleOpen = () => {
    setName(staff.name || '');
    setRoleBase(staff.roleBase === 'admin' ? 'admin' : 'teacher');
    setPhone(staff.contactInfo?.phone || '');
    setEmail(staff.contactInfo?.email || '');
    setDesignation(staff.contactInfo?.designation || '');
    setBloodGroup(staff.contactInfo?.bloodGroup || '');
    setAvatarUrl(staff.contactInfo?.avatarUrl || '');
    setStaffCode(staff.staffCode || '');
    setAttendancePin(staff.attendancePin || '1234');
    setError(null);
    setSuccess(false);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Staff member full name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tenant/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staff.id,
          slug,
          name: name.trim(),
          roleBase,
          contactInfo: {
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            designation: designation.trim() || undefined,
            avatarUrl: avatarUrl || undefined,
            bloodGroup: bloodGroup || undefined,
          },
          staffCode: staffCode.trim() || undefined,
          attendancePin: attendancePin.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update staff member details');
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
        title="Edit Staff Member"
      >
        <Pencil className="w-3.5 h-3.5" />
        <span>Edit</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Staff Record</h3>
                  <p className="text-xs text-slate-500 font-medium">Update profile details & role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Staff profile updated successfully!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Jane Doe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Base System Role *
                </label>
                <select
                  value={roleBase}
                  onChange={(e) => setRoleBase(e.target.value as 'teacher' | 'admin')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                >
                  <option value="teacher">Teacher / Academic Staff</option>
                  <option value="admin">School Administrator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +234 802 345 6789"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. teacher@school.edu"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Official Designation / Title
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Mathematics Master"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-2xs font-bold"
                  >
                    <option value="">Not specified</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <ImageUploadInput label="Passport photo" value={avatarUrl} onChange={setAvatarUrl} endpoint="/api/tenant/upload" folder="staff" helperText="Used on staff ID cards. PNG, JPEG or WebP up to 5MB." previewShape="square" />

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Staff Code
                  </label>
                  <input
                    type="text"
                    value={staffCode}
                    onChange={(e) => setStaffCode(e.target.value)}
                    placeholder="e.g. STF-1042"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-400">Used for QR Badges</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kiosk PIN (4 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={attendancePin}
                    onChange={(e) => setAttendancePin(e.target.value)}
                    placeholder="1234"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-400">Tablet terminal check-in</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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
