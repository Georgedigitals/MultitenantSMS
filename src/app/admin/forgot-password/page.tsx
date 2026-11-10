'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, KeyRound, Mail } from 'lucide-react';

export default function SuperAdminForgotPasswordPage() {
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
            Security &amp; Account Recovery
          </div>

          <div className="relative z-10 max-w-[510px] py-16">
            <p className="mb-5 text-[13px] font-medium text-[#63d28b]">Platform Security Infrastructure</p>
            <h1 className="max-w-[480px] text-[clamp(2.6rem,4.2vw,4.25rem)] font-medium leading-[1.06] tracking-[-0.055em]">
              Safe, verified <span className="text-[#63d28b]">account recovery.</span>
            </h1>
            <p className="mt-6 max-w-[410px] text-[15px] leading-7 text-[#d4e0e6]">
              Password reset links are cryptographically signed, single-use, and valid for 15 minutes to guarantee absolute administrative isolation.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/20 pt-5 text-[12px] text-[#d4e0e6]">
            <span>SHA-256 tokens</span>
            <span className="size-1 rounded-full bg-[#63d28b]" aria-hidden="true" />
            <span>Anti-enumeration</span>
            <span className="size-1 rounded-full bg-[#63d28b]" aria-hidden="true" />
            <span>Automated session revocation</span>
          </div>
        </section>

        {/* Right Column Recovery Form */}
        <section className="flex items-center justify-center py-4 sm:py-8 lg:py-12">
          <div className="w-full max-w-[430px]">
            <div className="rounded-[14px] border border-[#e5e9ed] bg-white p-5 sm:p-9 shadow-xs">
              <div className="mb-8">
                <div className="mb-5 flex size-10 items-center justify-center rounded-full border border-[#dce9df] text-[#17834b]">
                  <KeyRound size={18} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#177343]">Account Recovery</p>
                <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.04em] text-[#102d43]">Reset password</h2>
                <p className="mt-2 text-[14px] leading-6 text-[#5d6d78]">
                  Enter your registered work email to receive a secure recovery link.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-5 rounded-md border border-[#e8c3bd] bg-[#fff6f4] px-3.5 py-3 text-[13px] leading-5 text-[#8e3024] break-words"
                >
                  {error}
                </div>
              )}

              {submitted ? (
                <div className="space-y-5">
                  <div className="rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] p-4 text-[#065f46]">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#10b981]" />
                      <div className="min-w-0 flex-1 text-[13px] leading-5">
                        <p className="font-semibold text-[#047857]">Recovery Link Dispatched</p>
                        <p className="mt-1 text-[#065f46] break-words">
                          If an account is associated with <strong className="break-all font-semibold text-[#047857]">{email}</strong>, a secure reset link has been dispatched to your inbox.
                        </p>
                        <p className="mt-2 text-[12px] text-[#047857] leading-relaxed">
                          Please check your inbox (and spam folder). The link will expire in <strong>15 minutes</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href="/admin/login"
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#17834b] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#126b3d]"
                    >
                      <span>Return to Sign In</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setError(null);
                    }}
                    className="w-full text-center text-[12px] font-medium text-[#657580] hover:text-[#102d43] hover:underline"
                  >
                    Didn&apos;t receive an email? Try another address
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
                  <div>
                    <label htmlFor="recovery-email" className="mb-2 block text-[13px] font-medium text-[#263548]">
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
                        className="h-12 w-full rounded-md border border-[#cfd8cf] bg-white px-3.5 text-[14px] text-[#263548] outline-none placeholder:text-[#8693a0] transition-[border-color,box-shadow] focus:border-[#17834b] focus:ring-2 focus:ring-[#17834b]/15"
                      />
                      <Mail
                        size={17}
                        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8693a0]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#17834b] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#126b3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b] disabled:cursor-wait disabled:bg-[#789180]"
                  >
                    {loading ? 'Dispatching link…' : 'Send password reset link'}
                    {!loading && <ArrowRight size={16} aria-hidden="true" />}
                  </button>
                </form>
              )}

              <p className="mt-6 border-t border-[#e5e9ed] pt-5 text-[12px] leading-5 text-[#657580]">
                Remembered your password?{' '}
                <Link href="/admin/login" className="font-semibold text-[#17834b] hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-[#657580] px-3">
              BMS Platform Administration <span className="inline-block px-1 text-[#aab2ab]">·</span> Dedicated School Infrastructure
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

