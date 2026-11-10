'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldAlert } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Live password validation criteria
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
      setError('Please choose a password meeting the enterprise security requirements.');
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
    <div className="w-full max-w-[440px]">
      <div className="rounded-[14px] border border-[#e5e9ed] bg-white p-5 sm:p-9 shadow-xs">
        <div className="mb-8">
          <div className="mb-5 flex size-10 items-center justify-center rounded-full border border-[#dce9df] text-[#17834b]">
            <LockKeyhole size={18} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#177343]">Account Security</p>
          <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.04em] text-[#102d43]">Set new password</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#5d6d78]">
            Create a secure, strong password for your Super Admin account.
          </p>
        </div>

        {!token && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-[#fcd34d] bg-[#fffbeb] p-3.5 sm:p-4 text-[13px] leading-5 text-[#92400e] break-words"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[#b45309]" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#78350f]">Invalid Reset Link</p>
                <p className="mt-1">
                  No reset token was found in the URL. Please verify you clicked the complete link in your email.
                </p>
                <Link
                  href="/admin/forgot-password"
                  className="mt-3 inline-block font-semibold text-[#17834b] hover:underline"
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
            className="mb-5 rounded-md border border-[#e8c3bd] bg-[#fff6f4] px-3.5 py-3 text-[13px] leading-5 text-[#8e3024] break-words"
          >
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] p-4 sm:p-5 text-[#065f46]">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#10b981]" />
                <div className="min-w-0 flex-1 text-[13px] leading-5">
                  <p className="font-bold text-[#047857]">Password Updated Successfully</p>
                  <p className="mt-1 text-[#065f46] break-words">
                    Your Super Admin password has been updated. All previous active sessions have been terminated.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/admin/login"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#17834b] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#126b3d]"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : (
          token && (
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
              <div>
                <label htmlFor="new-password" className="mb-2 block text-[13px] font-medium text-[#263548]">
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
                    className="h-12 w-full rounded-md border border-[#cfd8cf] bg-white py-3 pl-3.5 pr-12 text-[14px] text-[#263548] outline-none placeholder:text-[#8693a0] transition-[border-color,box-shadow] focus:border-[#17834b] focus:ring-2 focus:ring-[#17834b]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-[#657580] transition-colors hover:text-[#17834b]"
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-[13px] font-medium text-[#263548]">
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
                    className="h-12 w-full rounded-md border border-[#cfd8cf] bg-white py-3 pl-3.5 pr-12 text-[14px] text-[#263548] outline-none placeholder:text-[#8693a0] transition-[border-color,box-shadow] focus:border-[#17834b] focus:ring-2 focus:ring-[#17834b]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-[#657580] transition-colors hover:text-[#17834b]"
                  >
                    {showConfirm ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Checklist */}
              <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[12px] text-[#475569]">
                <p className="mb-2 font-semibold text-[#1e293b]">Security requirements:</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-[#15803d]' : 'text-[#64748b]'}`}>
                    <Check size={13} className={hasMinLength ? 'opacity-100' : 'opacity-30'} />
                    <span>12+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-[#15803d]' : 'text-[#64748b]'}`}>
                    <Check size={13} className={hasUpper ? 'opacity-100' : 'opacity-30'} />
                    <span>Uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLower ? 'text-[#15803d]' : 'text-[#64748b]'}`}>
                    <Check size={13} className={hasLower ? 'opacity-100' : 'opacity-30'} />
                    <span>Lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-[#15803d]' : 'text-[#64748b]'}`}>
                    <Check size={13} className={hasNumber ? 'opacity-100' : 'opacity-30'} />
                    <span>Number (0–9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-[#15803d]' : 'text-[#64748b]'}`}>
                    <Check size={13} className={hasSymbol ? 'opacity-100' : 'opacity-30'} />
                    <span>Special symbol (!@#$)</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isSatisfied}
                className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#17834b] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#126b3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b] disabled:cursor-not-allowed disabled:bg-[#789180]"
              >
                {loading ? 'Securing account…' : 'Update password'}
                {!loading && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </form>
          )
        )}

        <p className="mt-6 border-t border-[#e5e9ed] pt-5 text-[12px] leading-5 text-[#657580]">
          Changed your mind?{' '}
          <Link href="/admin/login" className="font-semibold text-[#17834b] hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-[#657580] px-3">
        BMS Platform Administration <span className="inline-block px-1 text-[#aab2ab]">·</span> Dedicated School Infrastructure
      </p>
    </div>
  );
}

export default function SuperAdminResetPasswordPage() {
  return (
    <main data-ui="accent-ladder" className="min-h-svh bg-white text-[#102d43]">
      <header className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#16734d]"
        >
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-[#17834b] text-white">
            <BookOpen size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-[-0.02em]">BMS</span>
            <span className="mt-0.5 block text-[11px] text-[#657580]">School operations</span>
          </span>
        </Link>

        <Link
          href="/admin/login"
          className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-[13px] font-medium text-[#657580] transition-colors hover:text-[#102d43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Back to sign in</span>
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-8 px-5 pb-8 sm:px-8 lg:min-h-[calc(100svh-104px)] lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 lg:px-12 lg:pb-12">
        {/* Left Column Brand Banner */}
        <section className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden rounded-[18px] bg-[#0b2f48] px-10 py-10 text-white lg:flex xl:px-14 xl:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12]">
            <div className="absolute -right-24 top-[-90px] size-[390px] rounded-full border border-white" />
            <div className="absolute -right-6 top-[-25px] size-[255px] rounded-full border border-white" />
            <div className="absolute bottom-[-135px] left-[-90px] size-[340px] rounded-full border border-white" />
            <div className="absolute bottom-[-62px] left-[-18px] size-[195px] rounded-full border border-white" />
          </div>

          <div className="relative z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#63d28b]">
            <span className="size-1.5 rounded-full bg-[#63d28b]" />
            Platform Security Infrastructure
          </div>

          <div className="relative z-10 max-w-[510px] py-16">
            <p className="mb-5 text-[13px] font-medium text-[#63d28b]">Administrative Integrity</p>
            <h1 className="max-w-[480px] text-[clamp(2.6rem,4.2vw,4.25rem)] font-medium leading-[1.06] tracking-[-0.055em]">
              Choose a strong, <span className="text-[#63d28b]">unique password.</span>
            </h1>
            <p className="mt-6 max-w-[410px] text-[15px] leading-7 text-[#d4e0e6]">
              Your password protects platform operations and tenant management. Upon reset, all previous active sessions are instantly terminated.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/20 pt-5 text-[12px] text-[#d4e0e6]">
            <span>Session revocation</span>
            <span className="size-1 rounded-full bg-[#63d28b]" aria-hidden="true" />
            <span>Encrypted bcrypt hashes</span>
            <span className="size-1 rounded-full bg-[#63d28b]" aria-hidden="true" />
            <span>Automated alert notification</span>
          </div>
        </section>

        {/* Right Column Reset Form */}
        <section className="flex items-center justify-center py-4 sm:py-8 lg:py-12">
          <Suspense
            fallback={
              <div className="flex w-full max-w-[440px] items-center justify-center py-20 text-[14px] text-[#657580]">
                Loading reset verification…
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

