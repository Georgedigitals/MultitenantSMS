'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { GraduationCap, AlertCircle, Eye, EyeOff, FileText } from 'lucide-react';

interface TenantLoginPageProps {
  params: Promise<{ slug: string }>;
}

export default function TenantLoginPage({ params }: TenantLoginPageProps) {
  const { slug } = React.use(params);
  const router = useRouter();
  const pathname = usePathname() || '';
  const isPathRouted = pathname.startsWith(`/${slug}`);
  const homeHref = isPathRouted ? `/${slug}` : '/';
  const resultsHref = isPathRouted ? `/${slug}/results/check` : '/results/check';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [schoolName, setSchoolName] = useState<string>(
    slug.charAt(0).toUpperCase() + slug.slice(1)
  );
  const [branding, setBranding] = useState<{
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
    textOnPrimary?: string;
    textOnAccent?: string;
  }>({
    primaryColor: '#1E3A8A',
    accentColor: '#2563EB',
    logoUrl: null,
    textOnPrimary: '#FFFFFF',
    textOnAccent: '#FFFFFF',
  });

  useEffect(() => {
    // 1. Fetch tenant public branding
    fetch(`/api/tenant/branding?slug=${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.name) {
          setSchoolName(data.name);
        }
        if (data?.branding) {
          setBranding({
            primaryColor: data.branding.primaryColor || '#1E3A8A',
            accentColor: data.branding.accentColor || '#2563EB',
            logoUrl: data.branding.logoUrl || null,
            textOnPrimary: data.branding.textOnPrimary || '#FFFFFF',
            textOnAccent: data.branding.textOnAccent || '#FFFFFF',
          });
        }
      })
      .catch(() => { });

    // 2. Check if already authenticated
    fetch(`/api/tenant/auth/me?slug=${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          const role = data.user?.role || '';
          if (role === 'student' || role === 'parent') {
            router.push(isPathRouted ? `/${slug}/portal` : '/portal');
          } else {
            router.push(isPathRouted ? `/${slug}/dashboard` : '/dashboard');
          }
        }
      })
      .catch(() => { });
  }, [slug, router, isPathRouted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanUsername = username.trim();

    try {
      const res = await fetch('/api/tenant/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, username: cleanUsername, password }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (_) { }

      if (!res.ok) {
        setError(
          data.error ||
          (res.status === 404
            ? 'School portal or account not found (404). Please verify the school database is running.'
            : `Authentication failed (${res.status})`)
        );
        setLoading(false);
        return;
      }

      // Route by role: on wildcard subdomain, route cleanly to /portal or /dashboard
      const role = data?.user?.role || '';
      if (role === 'student' || role === 'parent') {
        window.location.href = isPathRouted ? `/${slug}/portal` : '/portal';
      } else {
        window.location.href = isPathRouted ? `/${slug}/dashboard` : '/dashboard';
      }
    } catch (err: any) {
      console.error('Login submit error:', err);
      setError(err?.message || 'An unexpected error occurred during login. Please try again.');
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
      {/* Header matching tenant home page theme */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
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
            href="/"
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all shadow-2xs"
          >
            <span className="text-slate-400">←</span>
            <span>Back to School Website</span>
          </Link>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Header Banner colored with tenant branding gradient */}
            <div
              className="p-8 text-center text-white relative"
              style={{
                background: `linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.accentColor} 100%)`,
                color: branding.textOnPrimary || '#FFFFFF',
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl mx-auto mb-4 border border-white/20 shadow-lg">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt={schoolName}
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <GraduationCap className="w-8 h-8 text-white" />
                )}
              </div>

              <h1 className="text-2xl font-black tracking-tight mb-1">
                Portal Authentication
              </h1>
              <p className="text-xs opacity-90 font-medium">
                Sign in to access your {schoolName} account
              </p>
            </div>

            {/* Form Body */}
            <div className="p-8 sm:p-10">
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Username or Email Address
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your school account username or email"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-inner"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Password
                    </label>
                    <Link
                      href={isPathRouted ? `/${slug}/forgot-password` : '/forgot-password'}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-xs font-medium p-1 transition-colors flex items-center gap-1"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-4 h-4" /> <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" /> <span>Show</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl text-white text-sm font-extrabold shadow-lg hover:opacity-95 transition-all disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2"
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
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Sign In to Account →</span>
                  )}
                </button>
              </form>

              {/* Bottom Navigation Link */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
                <Link
                  href={resultsHref}
                  className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Online Result Checker</span>
                </Link>
                <Link
                  href={homeHref}
                  className="hover:text-slate-900 transition-colors"
                >
                  School Home Page →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
