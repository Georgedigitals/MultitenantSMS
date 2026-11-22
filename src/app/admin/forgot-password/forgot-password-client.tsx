'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { AdminAuthShell, type AdminAuthBrand } from '@/components/admin-auth-shell';

export function SuperAdminForgotPasswordClient({ brand }: { brand: AdminAuthBrand }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || 'Failed to dispatch password reset link. Please try again.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Unable to reach the server. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminAuthShell
      brand={brand}
      backHref="/admin/login"
      backLabel="Back to sign in"
      panelEyebrow="Security & Account Recovery"
      panelHeadline={
        <>
          Safe, verified <span className="italic text-zinc-300">account recovery.</span>
        </>
      }
      panelDescription="Password reset links are cryptographically signed, single-use, and valid for 15 minutes to guarantee administrative isolation."
      panelHighlights={['SHA-256 tokens', 'Anti-enumeration', 'Automated session revocation']}
    >
      <div className="adm-card rounded-2xl border p-6 shadow-xs sm:p-8">
        <div className="mb-7">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border adm-divider adm-surface adm-text-primary">
            <KeyRound size={18} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] adm-text-muted">
            Account recovery
          </p>
          <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] adm-text-primary">
            Reset password
          </h2>
          <p className="mt-1.5 text-[13px] leading-6 adm-text-secondary">
            Enter your registered work email to receive a secure recovery link.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-[13px] leading-5 text-rose-500 break-words"
          >
            {error}
          </div>
        )}

        {submitted ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1 text-[13px] leading-5 adm-text-primary">
                  <p className="font-semibold text-emerald-500">Recovery link dispatched</p>
                  <p className="mt-1 adm-text-secondary break-words">
                    If an account is associated with{' '}
                    <strong className="break-all font-semibold adm-text-primary">{email}</strong>, a
                    secure reset link has been sent to your inbox.
                  </p>
                  <p className="mt-2 text-[12px] adm-text-muted leading-relaxed">
                    Please check your inbox and spam folder. The link expires in <strong>15 minutes</strong>.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/admin/login"
              className="adm-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold"
            >
              <span>Return to sign in</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setError(null);
              }}
              className="w-full text-center text-[12px] font-medium adm-text-muted hover:adm-text-primary hover:underline cursor-pointer"
            >
              Didn&apos;t receive an email? Try another address
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
            <div>
              <label htmlFor="recovery-email" className="mb-1.5 block text-[12px] font-medium adm-text-secondary">
                Work email
              </label>
              <div className="relative">
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@yourorganisation.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  className="adm-input h-11 w-full rounded-lg border pl-3.5 pr-10 text-[14px] transition-colors"
                />
                <Mail
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 adm-text-muted"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="adm-btn-primary mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold cursor-pointer disabled:cursor-wait"
            >
              {loading ? 'Dispatching link…' : 'Send password reset link'}
              {!loading && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </form>
        )}

        <p className="mt-6 border-t adm-divider pt-4 text-[12px] leading-5 adm-text-muted">
          Remembered your password?{' '}
          <Link href="/admin/login" className="font-semibold adm-text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AdminAuthShell>
  );
}
