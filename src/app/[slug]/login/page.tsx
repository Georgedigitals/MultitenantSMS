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
    primaryColor: '#141414',
    accentColor: '#1d5fbf',
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
            primaryColor: data.branding.primaryColor || '#141414',
            accentColor: data.branding.accentColor || '#1d5fbf',
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
      className="min-h-screen bg-[#f4f3f1] font-sans text-[#0a0a0a] flex flex-col antialiased"
      style={{
        ['--brand-primary' as any]: branding.primaryColor,
        ['--brand-accent' as any]: branding.accentColor,
      }}
    >
      {/* Minimal Architectural Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#e4e2dd]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href={homeHref} className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={schoolName}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-[6px] flex items-center justify-center font-semibold text-sm shrink-0"
                style={{
                  backgroundColor: branding.primaryColor || '#141414',
                  color: branding.textOnPrimary || '#FFFFFF',
                }}
              >
                {schoolName.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-[15px] tracking-[-0.01em] text-[#0a0a0a] truncate max-w-[200px] sm:max-w-xs">
              {schoolName}
            </span>
          </Link>

          <Link
            href={homeHref}
            className="h-9 px-3.5 rounded-[6px] text-[13px] font-medium border border-[#d4d1ca] bg-white text-[#0a0a0a] hover:bg-[#f4f3f1] transition-colors inline-flex items-center gap-2"
          >
            <span aria-hidden="true">←</span>
            <span>School website</span>
          </Link>
        </div>
      </header>

      {/* Main Centered Ledger Sign-In */}
      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px]">
          <div className="bg-white rounded-[8px] border border-[#e4e2dd] p-7 sm:p-9">
            <div className="pb-6 border-b border-[#efede9]">
              <div className="flex items-center gap-3 mb-4">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt={schoolName}
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-[6px] flex items-center justify-center font-semibold text-base text-white"
                    style={{
                      backgroundColor: branding.primaryColor || '#141414',
                      color: branding.textOnPrimary || '#FFFFFF',
                    }}
                  >
                    <GraduationCap className="w-5 h-5" />
                  </div>
                )}
              </div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                Sign in to {schoolName}
              </h1>
              <p className="mt-1 text-[13px] text-[#66645e]">
                Use your staff, student, or parent portal credentials.
              </p>
            </div>

            <div className="pt-6">
              {error && (
                <div className="mb-5 p-3.5 rounded-[6px] bg-[#ffedea] border border-[#f2c6c1] text-[#831c1e] text-[13px] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="tenant-login-username" className="block text-[13px] font-medium text-[#0a0a0a] mb-1.5">
                    Username or email
                  </label>
                  <input
                    id="tenant-login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admission number or email"
                    required
                    className="w-full h-10 px-3.5 rounded-[6px] bg-white border border-[#d4d1ca] text-[#0a0a0a] text-[14px] placeholder-[#8b8880] focus:outline-none focus:border-[#0a0a0a] transition-colors"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="tenant-login-password" className="block text-[13px] font-medium text-[#0a0a0a]">
                      Password
                    </label>
                    <Link
                      href={isPathRouted ? `/${slug}/forgot-password` : '/forgot-password'}
                      className="text-[12px] font-medium text-[#66645e] hover:text-[#0a0a0a] underline underline-offset-4 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="tenant-login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full h-10 pl-3.5 pr-16 rounded-[6px] bg-white border border-[#d4d1ca] text-[#0a0a0a] text-[14px] placeholder-[#8b8880] focus:outline-none focus:border-[#0a0a0a] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66645e] hover:text-[#0a0a0a] text-[12px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> <span>Show</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 px-4 rounded-[6px] bg-[#141414] hover:bg-[#2a2a2a] text-white text-[14px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-[#efede9] flex items-center justify-between text-[12px] font-medium text-[#66645e]">
                <Link
                  href={resultsHref}
                  className="hover:text-[#0a0a0a] transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Check term result</span>
                </Link>
                <Link
                  href={homeHref}
                  className="hover:text-[#0a0a0a] transition-colors"
                >
                  Home page →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
