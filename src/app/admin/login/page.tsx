'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Eye, EyeOff, LockKeyhole } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    let active = true;

    fetch('/api/admin/auth/me')
      .then((res) => {
        if (active && res.ok) window.location.href = '/admin';
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || 'We could not sign you in. Check your details and try again.');
        return;
      }

      window.location.href = '/admin';
    } catch {
      setError('We could not reach BMS. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main data-ui="accent-ladder" className="min-h-svh bg-white text-[#102d43]">
      <header className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="group inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#16734d]">
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-[#17834b] text-white">
            <BookOpen size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-[-0.02em]">BMS</span>
            <span className="mt-0.5 block text-[11px] text-[#657580]">School operations</span>
          </span>
        </Link>

        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-[13px] font-medium text-[#657580] transition-colors hover:text-[#102d43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
        >
          <span className="hidden sm:inline">Back to BMS</span>
          <span className="sm:hidden">Home</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-8 px-5 pb-8 sm:px-8 lg:min-h-[calc(100svh-104px)] lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 lg:px-12 lg:pb-12">
        <section className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden rounded-[18px] bg-[#0b2f48] px-10 py-10 text-white lg:flex xl:px-14 xl:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12]">
            <div className="absolute -right-24 top-[-90px] size-[390px] rounded-full border border-white" />
            <div className="absolute -right-6 top-[-25px] size-[255px] rounded-full border border-white" />
            <div className="absolute bottom-[-135px] left-[-90px] size-[340px] rounded-full border border-white" />
            <div className="absolute bottom-[-62px] left-[-18px] size-[195px] rounded-full border border-white" />
          </div>

          <div className="relative z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#63d28b]">
            <span className="size-1.5 rounded-full bg-[#63d28b]" />
            Platform administration
          </div>

          <div className="relative z-10 max-w-[510px] py-16">
            <p className="mb-5 text-[13px] font-medium text-[#63d28b]">For the people behind the schools</p>
            <h1 className="max-w-[480px] text-[clamp(2.6rem,4.2vw,4.25rem)] font-medium leading-[1.06] tracking-[-0.055em]">
              Every school, <span className="text-[#63d28b]">in good hands.</span>
            </h1>
            <p className="mt-6 max-w-[410px] text-[15px] leading-7 text-[#d4e0e6]">
              A focused workspace for platform operations, school plans and service-wide settings.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/20 pt-5 text-[12px] text-[#d4e0e6]">
            <span>School accounts</span>
            <span className="size-1 rounded-full bg-[#63d28b]" aria-hidden="true" />
            <span>Plans &amp; billing</span>
            <span className="size-1 rounded-full bg-[#63d28b]" aria-hidden="true" />
            <span>Platform settings</span>
          </div>
        </section>

        <section className="flex items-center justify-center py-4 sm:py-8 lg:py-12">
          <div className="w-full max-w-[430px]">
            <div className="mb-8 lg:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#17834b]">Platform administration</p>
              <h1 className="mt-3 max-w-[360px] text-[34px] font-medium leading-[1.08] tracking-[-0.045em] text-[#102d43]">
                Every school, <span className="text-[#17834b]">in good hands.</span>
              </h1>
              <p className="mt-3 max-w-[380px] text-[14px] leading-6 text-[#5d6d78]">
                Sign in to manage school accounts and platform settings.
              </p>
            </div>

            <div className="rounded-[14px] border border-[#e5e9ed] bg-white p-6 sm:p-9">
              <div className="mb-8">
                <div className="mb-5 flex size-10 items-center justify-center rounded-full border border-[#dce9df] text-[#17834b]">
                  <LockKeyhole size={18} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#177343]">Authorised personnel</p>
                <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.04em] text-[#102d43]">Sign in to BMS</h2>
                <p className="mt-2 text-[14px] leading-6 text-[#5d6d78]">
                  Use your platform administrator account to continue.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-5 rounded-md border border-[#e8c3bd] bg-[#fff6f4] px-3.5 py-3 text-[13px] leading-5 text-[#8e3024]"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
                <div>
                  <label htmlFor="admin-email" className="mb-2 block text-[13px] font-medium text-[#263548]">
                    Work email
                  </label>
                  <input
                    id="admin-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@yourorganisation.com"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    className="h-12 w-full rounded-md border border-[#cfd8cf] bg-white px-3.5 text-[14px] text-[#263548] outline-none placeholder:text-[#8693a0] transition-[border-color,box-shadow] focus:border-[#17834b] focus:ring-2 focus:ring-[#17834b]/15"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="admin-password" className="text-[13px] font-medium text-[#263548]">
                      Password
                    </label>
                    <Link
                      href="/admin/forgot-password"
                      className="text-[12px] font-medium text-[#17834b] transition-colors hover:text-[#126b3d] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="admin-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      className="h-12 w-full rounded-md border border-[#cfd8cf] bg-white py-3 pl-3.5 pr-12 text-[14px] text-[#263548] outline-none placeholder:text-[#8693a0] transition-[border-color,box-shadow] focus:border-[#17834b] focus:ring-2 focus:ring-[#17834b]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-[#657580] transition-colors hover:text-[#17834b] focus-visible:outline-2 focus-visible:outline-[#17834b]"
                    >
                      {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#17834b] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#126b3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b] disabled:cursor-wait disabled:bg-[#789180]"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                  {!loading && <ArrowRight size={16} aria-hidden="true" />}
                </button>
              </form>

              <p className="mt-6 border-t border-[#e5e9ed] pt-5 text-[12px] leading-5 text-[#657580]">
                Access is limited to authorised BMS platform administrators.
              </p>
            </div>

            <p className="mt-6 text-center text-[11px] leading-5 text-[#657580]">
              BMS platform access <span className="px-1.5 text-[#aab2ab]">·</span> Your school accounts remain separate and protected.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
