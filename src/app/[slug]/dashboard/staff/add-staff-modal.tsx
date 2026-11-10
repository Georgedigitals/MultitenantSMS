'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploadInput from '@/components/image-upload-input';

interface AddStaffModalProps {
  slug: string;
}

export function AddStaffModal({ slug }: AddStaffModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [roleBase, setRoleBase] = useState<'teacher' | 'admin'>('teacher');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Success credentials display
  const [credentials, setCredentials] = useState<{ username: string; emailSent: boolean; smsSent: boolean } | null>(null);

  const resetForm = () => {
    setName('');
    setRoleBase('teacher');
    setEmail('');
    setPhone('');
    setAvatarUrl('');
    setError(null);
    setCredentials(null);
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
      setError('Please provide the staff member\'s full name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('Add an email address or phone number so login details can be delivered privately.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/tenant/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          roleBase,
          contactInfo: {
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            avatarUrl: avatarUrl || undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create staff member');
      }

      if (data.credentials) {
        setCredentials(data.credentials);
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the staff record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all duration-150 active:scale-95 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add Staff Member
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Staff Member</h3>
                  <p className="text-xs text-slate-500">Register new teacher or administrator</p>
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
            <div className="p-6">
              {credentials ? (
                /* Success State with Credentials Card */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 mb-1">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Staff Member & Login Account Created!
                    </div>
                    <p className="text-xs text-emerald-700">
                      {credentials.emailSent || credentials.smsSent
                        ? `A temporary password was sent directly to the staff member${credentials.emailSent && credentials.smsSent ? ' by email and SMS' : credentials.emailSent ? ' by email' : ' by SMS'}. The school cannot view it.`
                        : 'The school cannot view or retrieve the temporary password.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-sans">Login Portal:</span>
                      <span className="font-semibold text-slate-800">/{slug}/login</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-sans">Username:</span>
                      <span className="font-bold text-indigo-600">{credentials.username}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="ml-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Add Form */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Ngozi Balogun"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-hidden transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Role <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={roleBase}
                        onChange={(e) => setRoleBase(e.target.value as 'teacher' | 'admin')}
                        className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-hidden transition font-medium"
                      >
                        <option value="teacher">Teacher / Academic Staff</option>
                        <option value="admin">School Administrator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+234..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-hidden transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. teacher@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-hidden transition"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      A temporary password will be sent to this email, or by SMS if only a phone is provided.
                    </p>
                  </div>

                  <div>
                    <ImageUploadInput label="Passport photo" value={avatarUrl} onChange={setAvatarUrl} endpoint="/api/tenant/upload" folder="staff" helperText="Used on staff ID cards. PNG, JPEG or WebP up to 5MB." previewShape="square" />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
                      className="px-5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {loading ? 'Creating Account...' : 'Create Staff Member'}
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
