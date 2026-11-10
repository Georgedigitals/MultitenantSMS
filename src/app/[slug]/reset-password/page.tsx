'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

interface ResetPasswordPageProps {
  params: Promise<{ slug: string }>;
}

function ResetPasswordContent({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const isPathRouted = pathname.startsWith(`/${slug}`);
  const loginHref = isPathRouted ? `/${slug}/login` : '/login';
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';
  const mode = searchParams.get('mode') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const [schoolName, setSchoolName] = useState<string>(
    slug.charAt(0).toUpperCase() + slug.slice(1)
  );
  const [branding, setBranding] = useState<{
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
    textOnPrimary?: string;
  }>({
    primaryColor: '#1E3A8A',
    accentColor: '#2563EB',
    logoUrl: null,
    textOnPrimary: '#FFFFFF',
  });

  useEffect(() => {
    fetch(`/api/tenant/branding?slug=${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.name) setSchoolName(data.name);
        if (data?.branding) {
          setBranding({
            primaryColor: data.branding.primaryColor || '#1E3A8A',
            accentColor: data.branding.accentColor || '#2563EB',
            logoUrl: data.branding.logoUrl || null,
            textOnPrimary: data.branding.textOnPrimary || '#FFFFFF',
          });
        }
      })
      .catch(() => {});
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Password reset token is missing from the URL. Please use the complete link sent to your email.');
      return;
    }

    if (password.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter identical passwords.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/tenant/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          token,
          newPassword: password,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'An error occurred while resetting your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col antialiased"
      style={{
        ['--brand-primary' as any]: branding.primaryColor,
        ['--brand-accent' as any]: branding.accentColor,
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href={loginHref} className="flex items-center gap-3 group">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={schoolName}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-xs shrink-0"
                style={{
                  backgroundColor: branding.primaryColor,
                  color: branding.textOnPrimary || '#FFFFFF',
                }}
              >
                {schoolName.charAt(0)}
              </div>
            )}
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              {schoolName}
            </span>
          </Link>

          <Link
            href={loginHref}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all shadow-2xs"
          >
            <span>Back to Login</span>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Header Banner */}
            <div
              className="p-8 text-center text-white relative"
              style={{
                background: `linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.accentColor} 100%)`,
                color: branding.textOnPrimary || '#FFFFFF',
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-lg">
                <Lock className="w-8 h-8 text-white" />
              </div>

              <h1 className="text-2xl font-black tracking-tight mb-1">
                {mode === 'activate' ? 'Activate Your Portal Account' : 'Choose New Password'}
              </h1>
              <p className="text-xs opacity-90 font-medium">
                {mode === 'activate'
                  ? `Welcome! Set a secure password to complete your ${schoolName} setup`
                  : emailParam ? `Account: ${emailParam}` : `Secure your ${schoolName} account`}
              </p>
            </div>

            <div className="p-8 sm:p-10">
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {isSuccess ? (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 text-xl mb-2">
                      {mode === 'activate' ? 'Account Activated Successfully!' : 'Password Successfully Reset!'}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                      {mode === 'activate'
                        ? 'Your portal account is now active and your password has been securely set. You can sign in immediately.'
                        : 'Your account security credentials have been updated. You can now sign in immediately with your new password.'}
                    </p>
                  </div>

                  <Link
                    href={loginHref}
                    className="w-full py-3.5 px-4 rounded-xl text-white text-sm font-extrabold shadow-lg hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    style={{
                      backgroundColor: branding.primaryColor,
                      color: branding.textOnPrimary || '#FFFFFF',
                    }}
                  >
                    <span>Sign In to Your Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : !token ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900">Missing Reset Token</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This password reset link is invalid or incomplete. Please request a fresh password recovery link.
                  </p>
                  <Link
                    href={`/${slug}/forgot-password`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    <span>Request New Reset Link</span>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        minLength={8}
                        className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-xs font-medium p-1 transition-colors flex items-center gap-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Must be at least 8 characters long</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      minLength={8}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-inner"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-xl text-white text-sm font-extrabold shadow-lg hover:opacity-95 transition-all disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                    style={{
                      backgroundColor: branding.primaryColor,
                      color: branding.textOnPrimary || '#FFFFFF',
                    }}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Save New Password &amp; Sign In →</span>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <Link
                      href={`/${slug}/login`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      <span>Cancel and Return to Login</span>
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { slug } = React.use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">Loading...</div>}>
      <ResetPasswordContent slug={slug} />
    </Suspense>
  );
}

