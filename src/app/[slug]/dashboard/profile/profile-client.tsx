'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CreditCard, Save } from 'lucide-react';
import ImageUploadInput from '@/components/image-upload-input';

interface StaffProfileClientProps {
  slug: string;
  role: string;
  primaryColor: string;
  initialProfile: {
    name: string;
    avatarUrl: string;
    signatureUrl: string;
    phone: string;
    bloodGroup: string;
    dob: string;
    email: string;
  };
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function StaffProfileClient({
  slug,
  role,
  primaryColor,
  initialProfile,
}: StaffProfileClientProps) {
  const router = useRouter();
  const [name, setName] = useState(initialProfile.name);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl);
  const [signatureUrl, setSignatureUrl] = useState(initialProfile.signatureUrl);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [bloodGroup, setBloodGroup] = useState(initialProfile.bloodGroup);
  const [dob, setDob] = useState(initialProfile.dob);
  const [email, setEmail] = useState(initialProfile.email);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/tenant/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          avatarUrl: avatarUrl || null,
          signatureUrl: signatureUrl || null,
          phone: phone || null,
          bloodGroup: bloodGroup || null,
          dob: dob || null,
          email: email || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update profile.');
      setMessage({
        type: 'success',
        text: 'Profile & ID card details updated! Your new photo and details are now synced across your account and Staff ID Card.',
      });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Update failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#141518]">
            My Profile &amp; ID Card Details
          </h1>
          <p className="text-[13.5px] text-[#6b6963] mt-1">
            Upload your passport photo and personal details used on your dashboard avatar and official Staff ID Card.
          </p>
        </div>
        {role === 'school_admin' && (
          <Link
            href={`/${slug}/dashboard/id-cards`}
            className="h-9 px-4 rounded-lg border border-[#dcd9d0] bg-white hover:bg-[#f5f3ee] text-[12.5px] font-semibold text-[#141518] inline-flex items-center gap-1.5 shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>View ID Cards</span>
          </Link>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white border border-[#e6e4de] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImageUploadInput
            label="Passport / Profile Photo"
            value={avatarUrl}
            onChange={setAvatarUrl}
            endpoint="/api/tenant/upload"
            folder="avatars"
            helperText="Appears on your official School ID Card and top-right workspace avatar."
            recommendedDimensions="Square portrait photo up to 5MB"
            previewShape="square"
          />

          <ImageUploadInput
            label="Digital Signature (For Report Cards)"
            value={signatureUrl}
            onChange={setSignatureUrl}
            endpoint="/api/tenant/upload"
            folder="signatures"
            helperText="Upload a transparent PNG signature. Automatically printed on your students' official report cards."
            recommendedDimensions="Wide transparent PNG (e.g. 400x140)"
            previewShape="square"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#efede8]">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3d3e42] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-[#dcd9d0] bg-[#faf9f6] focus:bg-white text-sm text-[#141518]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3d3e42] mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +234 800 000 0000"
              className="w-full h-10 px-3.5 rounded-xl border border-[#dcd9d0] bg-[#faf9f6] focus:bg-white text-sm text-[#141518]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3d3e42] mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. principal@school.edu"
              className="w-full h-10 px-3.5 rounded-xl border border-[#dcd9d0] bg-[#faf9f6] focus:bg-white text-sm text-[#141518]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3d3e42] mb-1">Blood Group (For ID Card)</label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-[#dcd9d0] bg-[#faf9f6] focus:bg-white text-sm text-[#141518]"
            >
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg || 'Not specified'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3d3e42] mb-1">Date of Birth (For ID Card)</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-[#dcd9d0] bg-[#faf9f6] focus:bg-white text-sm text-[#141518]"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
            style={{ backgroundColor: primaryColor }}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Profile & ID Details'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
