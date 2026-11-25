'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { TenantAuthShell } from '@/components/tenant-auth-shell';
import { getTemplateThemeTokens, type TenantTemplateId } from '@/lib/template-theme';

interface TenantLoginClientProps {
  slug: string;
  schoolName: string;
  motto?: string;
  templateId: TenantTemplateId;
  branding: {
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
    textOnPrimary?: string;
    textOnAccent?: string;
  };
}

export default function TenantLoginClient({
  slug,
  schoolName,
  motto,
  templateId,
  branding,
}: TenantLoginClientProps) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const isPathRouted = pathname.startsWith(`/${slug}`);
  const forgotHref = isPathRouted ? `/${slug}/forgot-password` : '/forgot-password';
  const resultsHref = isPathRouted ? `/${slug}/results/check` : '/results/check';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const primary = branding.primaryColor || '#1D3251';
  const accent = branding.accentColor || '#C8A45D';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const theme = getTemplateThemeTokens(templateId, primary, accent);

  useEffect(() => {
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
      .catch(() => {});
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
      } catch (_) {}

      if (!res.ok) {
        setError(
          data.error ||
            (res.status === 404
              ? 'School portal or account not found (404). Please verify the school account.'
              : `Authentication failed (${res.status})`)
        );
        setLoading(false);
        return;
      }

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
    <TenantAuthShell
      slug={slug}
      schoolName={schoolName}
      motto={motto}
      templateId={templateId}
      branding={branding}
      heading="Portal sign in"
      subheading={`Sign in with your ${schoolName} staff, parent, or student credentials.`}
    >
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-[#2d2b26] mb-1.5">
            Email, Username, or Admission ID
          </label>
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin@school.edu or ADM/2026/001"
            className="w-full h-11 px-3.5 rounded-xl border border-[#d8d4ca] bg-[#faf9f6] text-[14px] text-[#171614] placeholder:text-[#9a958b] focus:bg-white focus:outline-none focus:border-[#171614] transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[12px] font-semibold text-[#2d2b26]">Password or PIN</label>
            <Link
              href={forgotHref}
              className="text-[12px] font-semibold hover:underline"
              style={{ color: primary }}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#d8d4ca] bg-[#faf9f6] text-[14px] text-[#171614] placeholder:text-[#9a958b] focus:bg-white focus:outline-none focus:border-[#171614] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6d685c] hover:text-[#171614] p-1 cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full h-11 ${theme.buttonRadius} text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs`}
          style={{ backgroundColor: primary, color: textOnPrimary }}
        >
          {loading ? 'Signing in...' : 'Sign in to portal'}
        </button>
      </form>

      <div className={`pt-4 border-t ${theme.borderClass} flex items-center justify-between text-[12px] text-[#6d685c]`}>
        <span>Need term results?</span>
        <Link
          href={resultsHref}
          className="font-semibold underline underline-offset-4 hover:opacity-75"
          style={{ color: primary }}
        >
          Open Result Checker →
        </Link>
      </div>
    </TenantAuthShell>
  );
}
