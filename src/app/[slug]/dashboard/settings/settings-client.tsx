'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ImageUploadInput from '@/components/image-upload-input';
import { PinsManagerClient } from '../results/pins/pins-manager-client';

interface ClassLevel {
  id: string;
  name: string;
  orderIndex: number;
}

interface Term {
  id: string;
  name: string;
  isCurrent: boolean;
  totalSchoolDays: number | null;
}

interface AcademicSession {
  id: string;
  label: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
  terms: Term[];
}

interface TenantSettingsData {
  id: string;
  slug: string;
  name: string;
  status: string;
  trialEndsAt: string | null;
  branding: {
    primaryColor?: string;
    accentColor?: string;
    logoUrl?: string | null;
    fontHeading?: string;
    fontBody?: string;
  };
  pinPrice: number;
  admissionNumberPrefix: string | null;
  blockPromotionOnFeeBalance: boolean;
  blockResultOnFeeBalance?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  hasOnlinePayment?: boolean;
  lowestClassLevelId: string | null;
  highestClassLevelId: string | null;
  plan: {
    name: string;
    studentCeiling: number;
    pinRequired: boolean;
  };
}

interface PinFeeDetails {
  tenantPinPrice: number;
  platformFeePercent: number;
  platformFeePerPin: number;
  tenantNetPayoutPerPin: number;
  currency: string;
}

interface SettingsClientProps {
  slug: string;
  tenant: TenantSettingsData;
  sessions: AcademicSession[];
  allClassLevels: ClassLevel[];
  pinFees: PinFeeDetails;
}

type SettingsTab = 'profile' | 'academic' | 'pin' | 'policy' | 'security';

export default function SettingsClient({
  slug,
  tenant,
  sessions,
  allClassLevels,
  pinFees,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Form State
  const [name, setName] = useState(tenant.name);
  const [logoUrl, setLogoUrl] = useState(tenant.branding.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(tenant.branding.primaryColor || '#0F172A');
  const [accentColor, setAccentColor] = useState(tenant.branding.accentColor || '#2563EB');

  // Academic Class Range State
  const [lowestClassLevelId, setLowestClassLevelId] = useState(tenant.lowestClassLevelId || allClassLevels[0]?.id || '');
  const [highestClassLevelId, setHighestClassLevelId] = useState(
    tenant.highestClassLevelId || allClassLevels[allClassLevels.length - 1]?.id || ''
  );
  const [admissionNumberPrefix, setAdmissionNumberPrefix] = useState(tenant.admissionNumberPrefix || '');

  // PIN Monetization State
  const [pinPrice, setPinPrice] = useState(tenant.pinPrice || 1000);

  // Policy State
  const [blockPromotionOnFeeBalance, setBlockPromotionOnFeeBalance] = useState(tenant.blockPromotionOnFeeBalance);
  const [blockResultOnFeeBalance, setBlockResultOnFeeBalance] = useState(tenant.blockResultOnFeeBalance ?? true);
  const [bankName, setBankName] = useState(tenant.bankName || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(tenant.bankAccountNumber || '');
  const [bankAccountName, setBankAccountName] = useState(tenant.bankAccountName || '');
  const [hasOnlinePayment, setHasOnlinePayment] = useState(tenant.hasOnlinePayment ?? true);

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI feedback states
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Academic Sessions & Terms state
  const [sessionsList, setSessionsList] = useState<AcademicSession[]>(sessions);
  const [sessionActionLoading, setSessionActionLoading] = useState<string | null>(null);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState('');
  const [newSessionStart, setNewSessionStart] = useState('');
  const [newSessionEnd, setNewSessionEnd] = useState('');
  const [newSessionIsCurrent, setNewSessionIsCurrent] = useState(false);

  // Live PIN Calculation preview
  const platformPercent = pinFees.platformFeePercent || 10;
  const platformCut = Math.round((pinPrice * platformPercent) / 100);
  const schoolCut = pinPrice - platformCut;

  const currentSession = sessionsList.find((s) => s.isCurrent) || sessionsList[0] || null;
  const admissionNumberYear = currentSession?.label.match(/\b(20\d{2})\b/)?.[1] || String(new Date().getFullYear());
  const currentTerm = currentSession?.terms.find((t) => t.isCurrent) || currentSession?.terms[0] || null;

  const handleActivateSession = async (sessionId: string) => {
    setSessionActionLoading(sessionId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/tenant/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate_session', sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to activate academic session');

      setSessionsList((prev) =>
        prev.map((s) => ({
          ...s,
          isCurrent: s.id === sessionId,
          terms:
            s.id === sessionId
              ? s.terms.map((t, idx) => ({ ...t, isCurrent: idx === 0 }))
              : s.terms.map((t) => ({ ...t, isCurrent: false })),
        }))
      );
      setSuccessMsg(data.message || 'Academic session activated successfully');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to activate session');
    } finally {
      setSessionActionLoading(null);
    }
  };

  const handleActivateTerm = async (termId: string, parentSessionId: string) => {
    setSessionActionLoading(termId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/tenant/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate_term', termId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to activate term');

      setSessionsList((prev) =>
        prev.map((s) => ({
          ...s,
          isCurrent: s.id === parentSessionId,
          terms: s.terms.map((t) => ({
            ...t,
            isCurrent: t.id === termId,
          })),
        }))
      );
      setSuccessMsg(data.message || 'Term activated successfully');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to activate term');
    } finally {
      setSessionActionLoading(null);
    }
  };

  const handleSaveSchoolDays = async (termId: string, totalSchoolDays: number | null) => {
    if (!Number.isInteger(totalSchoolDays) || totalSchoolDays === null || totalSchoolDays < 1 || totalSchoolDays > 300) {
      setErrorMsg('Enter a whole number of school days between 1 and 300.');
      return;
    }

    setSessionActionLoading(`school-days:${termId}`);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/tenant/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_term_school_days', termId, totalSchoolDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save school days');

      setSessionsList((prev) => prev.map((session) => ({
        ...session,
        terms: session.terms.map((term) => term.id === termId
          ? { ...term, totalSchoolDays: data.totalSchoolDays }
          : term
        ),
      })));
      setSuccessMsg('Term school days saved.');
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to save school days');
    } finally {
      setSessionActionLoading(null);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionLabel.trim() || !newSessionStart || !newSessionEnd) {
      setErrorMsg('Please specify session label, start date, and end date');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/tenant/sessions?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newSessionLabel.trim(),
          startDate: newSessionStart,
          endDate: newSessionEnd,
          isCurrent: newSessionIsCurrent,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create academic session');

      // Refresh list
      const refreshRes = await fetch(`/api/tenant/sessions?slug=${slug}`);
      const refreshData = await refreshRes.json();
      if (refreshData.sessions) {
        setSessionsList(
          refreshData.sessions.map((s: any) => ({
            id: s.id,
            label: s.label,
            isCurrent: s.isCurrent,
            startDate: s.startDate,
            endDate: s.endDate,
            terms: s.terms.map((t: any) => ({
              id: t.id,
              name: t.name,
              isCurrent: t.isCurrent,
              totalSchoolDays: t.totalSchoolDays ?? null,
            })),
          }))
        );
      }

      setShowAddSessionModal(false);
      setNewSessionLabel('');
      setNewSessionStart('');
      setNewSessionEnd('');
      setNewSessionIsCurrent(false);
      setSuccessMsg(`Academic Session ${newSessionLabel} registered successfully!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create academic session');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    // Validate passwords if attempting to change
    if (newPassword || oldPassword) {
      if (!oldPassword) {
        setErrorMsg('Please enter your current password to change it.');
        setSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        setErrorMsg('New password must be at least 6 characters long.');
        setSaving(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('New password and confirmation do not match.');
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/tenant/settings?slug=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          branding: {
            primaryColor,
            accentColor,
            logoUrl: logoUrl.trim() || null,
          },
          pinPrice: Number(pinPrice),
          admissionNumberPrefix: admissionNumberPrefix.trim(),
          blockPromotionOnFeeBalance,
          blockResultOnFeeBalance,
          bankName: bankName.trim() || null,
          bankAccountNumber: bankAccountNumber.trim() || null,
          bankAccountName: bankAccountName.trim() || null,
          hasOnlinePayment,
          lowestClassLevelId: lowestClassLevelId || null,
          highestClassLevelId: highestClassLevelId || null,
          oldPassword: oldPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccessMsg('Settings saved successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-slate-900 text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">School Settings &amp; Configuration</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Manage branding, academic structure, PIN pricing, and financial controls for {tenant.name}.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {tenant.plan.name} Tier
          </span>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:underline">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
           School Profile &amp; Branding
        </button>

        <button
          onClick={() => setActiveTab('academic')}
          className={`px-4 py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'academic'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
           Academic Structure &amp; Classes
        </button>

        <button
          onClick={() => setActiveTab('pin')}
          className={`px-4 py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'pin'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
           Result PIN Monetization
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`px-4 py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'policy'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
           Financial &amp; Promotion Policies
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'security'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
           Security &amp; Credentials
        </button>
      </div>

      {/* Tab 1: Profile & Branding */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">School Identity &amp; Branding</h2>
            <p className="text-xs text-slate-500">Configure your institution&apos;s public name and visual portal identity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                School Official Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Displayed across portal headers, student report cards, and receipts.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Subdomain Slug
              </label>
              <input
                type="text"
                disabled
                value={`${tenant.slug}.localhost:3000`}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-500 cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Custom domain aliases can be configured via Enterprise subscription.</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <ImageUploadInput
              label="Official School Crest / Logo"
              value={logoUrl}
              onChange={setLogoUrl}
              endpoint="/api/tenant/upload"
              folder="logos"
              helperText="Renders on portal navigation bars, login screens, and official student report card covers."
              recommendedDimensions="Square 512x512 PNG, JPEG, WebP or GIF up to 5MB"
              previewShape="square"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Primary Brand Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32 px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs text-slate-800"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Used for sidebar background, badges, and report card banners.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Accent Highlight Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-32 px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs text-slate-800"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Used for buttons, links, and active indicators.</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Academic Structure */}
      {activeTab === 'academic' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label htmlFor="admission-prefix" className="block text-xs font-bold uppercase tracking-wider text-slate-700">Admission Number Prefix</label>
            <p className="mt-1 text-xs text-slate-600">New students get a school-facing number like <strong>{(admissionNumberPrefix.trim() || slug).toUpperCase()}/{admissionNumberYear}/0001</strong>. The year comes from the selected academic session. Leave blank to use your school URL name.</p>
            <input
              id="admission-prefix"
              value={admissionNumberPrefix}
              onChange={(event) => setAdmissionNumberPrefix(event.target.value.toUpperCase())}
              maxLength={12}
              pattern="[A-Z0-9-]{1,12}"
              placeholder={slug.toUpperCase()}
              className="mt-3 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono font-semibold text-slate-900"
            />
            <p className="mt-1 text-[11px] text-slate-500">Letters, numbers and hyphens only. Saving this changes numbers assigned to future students; existing admission numbers remain as they are.</p>
          </section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Academic Structure &amp; Class Ladder</h2>
              <p className="text-xs text-slate-500">Configure your institution&apos;s active academic year, terms, and authorized class ladder.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddSessionModal(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Academic Session</span>
              </button>
              <Link
                href="/dashboard/promotion"
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                Promotions
              </Link>
            </div>
          </div>

          {/* Current Academic Session Summary */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Current Active Academic Session</span>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {currentSession ? currentSession.label : 'No Active Session Configured'}
              </div>
              <span className="text-xs text-slate-500">
                Active Term: <strong className="text-blue-600">{currentTerm?.name || '1st Term'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider border border-emerald-200">
                Live Portal Session
              </span>
            </div>
          </div>

          {/* Academic Sessions & Terms List */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Academic Sessions &amp; Terms Roster
            </h3>

            <div className="space-y-3">
              {sessionsList.map((sess) => (
                <div
                  key={sess.id}
                  className={`p-4 rounded-xl border transition-all ${
                    sess.isCurrent
                      ? 'bg-blue-50/40 border-blue-300 shadow-2xs'
                      : 'bg-slate-50/50 border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-extrabold text-slate-900 font-mono">
                        {sess.label}
                      </span>
                      {sess.isCurrent ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wider uppercase border border-emerald-200">
                          Active Academic Year
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold uppercase">
                          Inactive Session
                        </span>
                      )}
                    </div>

                    {!sess.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleActivateSession(sess.id)}
                        disabled={sessionActionLoading === sess.id}
                        className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {sessionActionLoading === sess.id ? 'Activating...' : 'Activate This Session'}
                      </button>
                    )}
                  </div>

                  {/* Terms within this session */}
                  <div className="pt-3">
                    <span className="text-[11px] font-semibold text-slate-500 block mb-2">Terms in this Academic Year:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {sess.terms.map((t) => (
                        <div
                          key={t.id}
                          className={`p-2.5 rounded-lg border text-xs ${
                            t.isCurrent && sess.isCurrent
                              ? 'bg-white border-blue-500 shadow-xs'
                              : 'bg-white/80 border-slate-200 text-slate-600'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 block">{t.name}</span>
                              {t.isCurrent && sess.isCurrent && (
                                <span className="text-[10px] text-blue-600 font-semibold font-mono block">Current Active Term</span>
                              )}
                            </div>
                            {(!t.isCurrent || !sess.isCurrent) && (
                              <button
                                type="button"
                                onClick={() => handleActivateTerm(t.id, sess.id)}
                                disabled={sessionActionLoading === t.id}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {sessionActionLoading === t.id ? 'Setting...' : 'Set Active'}
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex items-end gap-2 border-t border-slate-100 pt-2">
                            <label className="flex-1 text-[10px] font-semibold text-slate-500">
                              School days in this term
                              <input
                                type="number"
                                min={1}
                                max={300}
                                step={1}
                                value={t.totalSchoolDays ?? ''}
                                onChange={(event) => {
                                  const value = event.target.value === '' ? null : Number(event.target.value);
                                  setSessionsList((prev) => prev.map((session) => ({
                                    ...session,
                                    terms: session.terms.map((term) => term.id === t.id
                                      ? { ...term, totalSchoolDays: value }
                                      : term
                                    ),
                                  })));
                                }}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-900"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleSaveSchoolDays(t.id, t.totalSchoolDays)}
                              disabled={sessionActionLoading === `school-days:${t.id}`}
                              className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                            >
                              {sessionActionLoading === `school-days:${t.id}` ? 'Saving…' : 'Save days'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Class Range Ladder */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Authorized School Class Range</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Defines the lowest and highest class levels permitted for student enrollments and fee items in your school.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lowest Class Level
                </label>
                <select
                  value={lowestClassLevelId}
                  onChange={(e) => setLowestClassLevelId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {allClassLevels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Highest Class Level
                </label>
                <select
                  value={highestClassLevelId}
                  onChange={(e) => setHighestClassLevelId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {allClassLevels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
              
              <p className="leading-relaxed">
                <strong>Enrollment Protection:</strong> Raising the lowest class level or lowering the highest class level will be blocked if active student enrollments exist in the removed tiers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Unified PIN Monetization & Batch Management */}
      {activeTab === 'pin' && (
        <PinsManagerClient
          slug={slug}
          schoolName={tenant.name}
          initialPinPrice={pinPrice}
          onPriceChange={(newPrice) => setPinPrice(newPrice)}
        />
      )}

      {/* Tab 4: Financial & Promotion Policy */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Financial &amp; Promotion Clearance Policies</h2>
            <p className="text-xs text-slate-500">Configure automated controls for fee collection and academic promotion barriers.</p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Block Student Promotion on Outstanding Fee Balance
                </span>
                <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                  When enabled, students with unpaid fee balances in the current academic session cannot be advanced to the next class during end-of-session promotion runs until fees are cleared by the bursar.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={blockPromotionOnFeeBalance}
                  onChange={(e) => setBlockPromotionOnFeeBalance(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="pt-2 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${blockPromotionOnFeeBalance ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>Status: {blockPromotionOnFeeBalance ? 'Policy Active & Enforced' : 'Disabled (Promotion Allowed Regardless of Balance)'}</span>
            </div>
          </div>

          {/* Policy 2: Block Exam Result on Unpaid Fees */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Block Result Checking on Outstanding School Fees
                </span>
                <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                  When enabled, students/parents with unpaid fees cannot access continuous assessment scores or terminal report cards (even if they possess a valid Result PIN) until fees are cleared by the bursar.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={blockResultOnFeeBalance}
                  onChange={(e) => setBlockResultOnFeeBalance(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="pt-2 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${blockResultOnFeeBalance ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>Status: {blockResultOnFeeBalance ? 'Fee Clearance Enforced on Results' : 'Disabled (Results Accessible with PIN Alone)'}</span>
            </div>
          </div>

          {/* School Fee Payment Configuration */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div>
              <span className="text-sm font-bold text-slate-900 block">
                School Fee Payment Options
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                School fees either use this school’s own payment gateway account or direct bank transfer. These payments do not go through the platform account.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Zenith Bank / GTBank"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="e.g. 1029384756"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="e.g. School Bursary Account"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasOnlinePayment}
                  onChange={(e) => setHasOnlinePayment(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Allow online school-fee checkout using the school’s Paystack account
                </span>
              </label>
            </div>
            <Link href={`/${slug}/dashboard/settings/payments`} className="inline-flex rounded-lg border border-emerald-800 px-4 py-2.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50">Configure this school’s Paystack key →</Link>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Save your changes to update result verification policies and bank account displays.
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Policies & Bank Details'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: Security & Passwords */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Administrator Security &amp; Credentials</h2>
            <p className="text-xs text-slate-500">Update your school administrator password and view active session protections.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                placeholder="Enter current password..."
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <input
                type="password"
                placeholder="Enter new secure password (min 6 chars)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Re-type new password..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {/* Add Academic Session Modal */}
      {showAddSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Academic Session</h3>
                <p className="text-xs text-slate-500">Register a new academic year. Standard 3 terms will be created automatically.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSessionModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Academic Session Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026/2027"
                  value={newSessionLabel}
                  onChange={(e) => setNewSessionLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Format: YYYY/YYYY (e.g. 2026/2027)</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newSessionStart}
                    onChange={(e) => setNewSessionStart(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newSessionEnd}
                    onChange={(e) => setNewSessionEnd(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSessionIsCurrent}
                    onChange={(e) => setNewSessionIsCurrent(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Set as active current academic session immediately
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1 pl-6">
                  If checked, the portal and gradebooks will switch to this session right away.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSessionModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{saving ? 'Creating Session...' : 'Create Academic Session'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
