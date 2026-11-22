'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { AdminAuthShell, type AdminAuthBrand } from '@/components/admin-auth-shell';

export function SuperAdminLoginClient({ brand }: { brand: AdminAuthBrand }) {
  const platformName = brand.name?.trim() || 'School Platform';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/auth/me')
      .then((res) => {
        if (active && res.ok) window.location.href = '/admin';
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
      setError(`We could not reach ${platformName}. Check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminAuthShell
      brand={brand}
      backHref="/"
      backLabel={`Back to ${platformName}`}
      panelEyebrow="Platform Administration"
      panelHeadline={
        <>
          Every school, <span className="italic text-zinc-300">in good hands.</span>
        </>
      }
      panelDescription="A focused workspace for multi-tenant operations, subscription plans, billing reconciliation, and global platform settings."
      panelHighlights={['School accounts', 'Plans & billing', 'Platform settings']}
    >
      <div className="adm-card rounded-2xl border p-6 shadow-xs sm:p-8">
        <div className="mb-7">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border adm-divider adm-surface adm-text-primary">
            <LockKeyhole size={18} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] adm-text-muted">
            Authorised personnel
          </p>
          <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] adm-text-primary">
            Sign in to <span data-no-translate="true">{platformName}</span>
          </h2>
          <p className="mt-1.5 text-[13px] leading-6 adm-text-secondary">
            Use your platform administrator account to continue.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-[13px] leading-5 text-rose-500"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-[12px] font-medium adm-text-secondary">
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
              className="adm-input h-11 w-full rounded-lg border px-3.5 text-[14px] transition-colors"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="admin-password" className="text-[12px] font-medium adm-text-secondary">
                Password
              </label>
              <Link
                href="/admin/forgot-password"
                className="text-[12px] font-medium adm-text-secondary hover:adm-text-primary hover:underline"
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
                className="adm-input h-11 w-full rounded-lg border py-2.5 pl-3.5 pr-11 text-[14px] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg adm-text-muted transition-colors hover:adm-text-primary cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="adm-btn-primary mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold cursor-pointer disabled:cursor-wait"
          >
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>

        <p className="mt-6 border-t adm-divider pt-4 text-[12px] leading-5 adm-text-muted">
          Access is limited to authorised <span data-no-translate="true">{platformName}</span> administrators.
        </p>
      </div>
    </AdminAuthShell>
  );
}
