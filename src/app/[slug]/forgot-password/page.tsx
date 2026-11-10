'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft, Mail, ExternalLink } from 'lucide-react';

interface ForgotPasswordPageProps {
  params: Promise<{ slug: string }>;
}

export default function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { slug } = React.use(params);
  const router = useRouter();
  const pathname = usePathname() || '';
  const isPathRouted = pathname.startsWith(`/${slug}`);
  const loginHref = isPathRouted ? `/${slug}/login` : '/login';

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

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
    setSuccessMsg(null);
    setDevResetUrl(null);
    setLoading(true);

    try {
      const res = await fetch('/api/tenant/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, usernameOrEmail: usernameOrEmail.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit password reset request');
      }

      setSuccessMsg(data.message || 'If an account exists, a password reset link has been dispatched.');
      if (data.devResetUrl) {
        setDevResetUrl(data.devResetUrl);
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while processing your request.');
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
      {/* School Header */}
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
            <ArrowLeft className="w-3.5 h-3.5" />
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
                <KeyRound className="w-8 h-8 text-white" />
              </div>

              <h1 className="text-2xl font-black tracking-tight mb-1">
                Forgot Password?
              </h1>
              <p className="text-xs opacity-90 font-medium">
                Enter your details to receive a recovery link for {schoolName}
              </p>
            </div>

            <div className="p-8 sm:p-10">
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg ? (
                <div className="space-y-6 text-center">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg mb-2">Request Processed</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {successMsg}
                    </p>
                  </div>

                  {devResetUrl && (
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-left space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                        <Mail className="w-4 h-4 text-indigo-600" />
                        <span>Development Mode Quick Link:</span>
                      </div>
                      <p className="text-[11px] text-indigo-700">
                        Since SMTP may be in sandbox mode, you can test resetting your password immediately:
                      </p>
                      <Link
                        href={devResetUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                      >
                        <span>Open Reset Password Page</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100">
                    <Link
                      href={loginHref}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Return to Sign In</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Username or Email Address
                    </label>
                    <input
                      type="text"
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      placeholder={`e.g. admin@${slug}.edu, teacher@${slug}.edu, or student ID`}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-inner"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">
                      We'll send an official password reset link with instructions to your registered email.
                    </p>
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
                        <span>Dispatching Link...</span>
                      </>
                    ) : (
                      <span>Send Reset Link →</span>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <Link
                      href={loginHref}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
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

