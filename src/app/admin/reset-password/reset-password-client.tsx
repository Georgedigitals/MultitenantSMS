'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Check, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldAlert } from 'lucide-react';
import { AdminAuthShell, type AdminAuthBrand } from '@/components/admin-auth-shell';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const hasMinLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const is16Plus = password.length >= 16;
  const isSatisfied = is16Plus || (hasMinLength && hasUpper && hasLower && hasNumber && hasSymbol);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Missing reset token. Please use the exact link sent to your email.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isSatisfied) {
      setError('Please choose a password meeting the security requirements.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || 'Failed to reset password. The link may have expired.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Unable to reach the server. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm-card rounded-2xl border p-6 shadow-xs sm:p-8">
      <div className="mb-7">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border adm-divider adm-surface adm-text-primary">
          <LockKeyhole size={18} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] adm-text-muted">
          Account security
        </p>
        <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] adm-text-primary">
          Set new password
        </h2>
        <p className="mt-1.5 text-[13px] leading-6 adm-text-secondary">
          Create a strong password for your Super Admin account.
        </p>
      </div>

      {!token && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] leading-5"
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-500">Invalid reset link</p>
              <p className="mt-1 adm-text-secondary">
                No reset token was found in the URL. Please verify you clicked the complete link in your email.
              </p>
              <Link
                href="/admin/forgot-password"
                className="mt-3 inline-block font-semibold adm-text-primary hover:underline"
              >
                Request a new recovery link →
              </Link>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-[13px] leading-5 text-rose-500 break-words"
        >
          {error}
        </div>
      )}

      {success ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1 text-[13px] leading-5">
                <p className="font-semibold text-emerald-500">Password updated successfully</p>
                <p className="mt-1 adm-text-secondary break-words">
                  Your Super Admin password has been updated. All previous active sessions have been terminated.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/admin/login"
            className="adm-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold"
          >
            <span>Proceed to sign in</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        token && (
          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-[12px] font-medium adm-text-secondary">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="adm-input h-11 w-full rounded-lg border py-2.5 pl-3.5 pr-11 text-[14px] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg adm-text-muted transition-colors hover:adm-text-primary cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-[12px] font-medium adm-text-secondary">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="adm-input h-11 w-full rounded-lg border py-2.5 pl-3.5 pr-11 text-[14px] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg adm-text-muted transition-colors hover:adm-text-primary cursor-pointer"
                >
                  {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border adm-divider adm-surface p-3.5 text-[12px]">
              <p className="mb-2 font-semibold adm-text-primary">Security requirements:</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-500' : 'adm-text-muted'}`}>
                  <Check size={13} className={hasMinLength ? 'opacity-100' : 'opacity-30'} />
                  <span>12+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-500' : 'adm-text-muted'}`}>
                  <Check size={13} className={hasUpper ? 'opacity-100' : 'opacity-30'} />
                  <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-500' : 'adm-text-muted'}`}>
                  <Check size={13} className={hasLower ? 'opacity-100' : 'opacity-30'} />
                  <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-500' : 'adm-text-muted'}`}>
                  <Check size={13} className={hasNumber ? 'opacity-100' : 'opacity-30'} />
                  <span>Number (0–9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-500' : 'adm-text-muted'}`}>
                  <Check size={13} className={hasSymbol ? 'opacity-100' : 'opacity-30'} />
                  <span>Special symbol (!@#$)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isSatisfied}
              className="adm-btn-primary mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? 'Securing account…' : 'Update password'}
              {!loading && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </form>
        )
      )}

      <p className="mt-6 border-t adm-divider pt-4 text-[12px] leading-5 adm-text-muted">
        Changed your mind?{' '}
        <Link href="/admin/login" className="font-semibold adm-text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function SuperAdminResetPasswordClient({ brand }: { brand: AdminAuthBrand }) {
  return (
    <AdminAuthShell
      brand={brand}
      backHref="/admin/login"
      backLabel="Back to sign in"
      panelEyebrow="Platform Security Infrastructure"
      panelHeadline={
        <>
          Choose a strong, <span className="italic text-zinc-300">unique password.</span>
        </>
      }
      panelDescription="Your password protects platform operations and tenant management. Upon reset, all previous active sessions are instantly terminated."
      panelHighlights={['Session revocation', 'Encrypted bcrypt hashes', 'Automated alert notification']}
    >
      <Suspense
        fallback={
          <div className="adm-card rounded-2xl border p-8 text-center text-[13px] adm-text-muted">
            Loading reset verification…
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AdminAuthShell>
  );
}
