'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TenantAuthShell } from '@/components/tenant-auth-shell';
import { getTemplateThemeTokens, type TenantTemplateId } from '@/lib/template-theme';

interface ResetPasswordClientProps {
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

function ResetPasswordInner({
  slug,
  schoolName,
  motto,
  templateId,
  branding,
}: ResetPasswordClientProps) {
  const pathname = usePathname() || '';
  const isPathRouted = pathname.startsWith(`/${slug}`);
  const loginHref = isPathRouted ? `/${slug}/login` : '/login';
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const primary = branding.primaryColor || '#1D3251';
  const accent = branding.accentColor || '#C8A45D';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const theme = getTemplateThemeTokens(templateId, primary, accent);

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
    <TenantAuthShell
      slug={slug}
      schoolName={schoolName}
      motto={motto}
      templateId={templateId}
      branding={branding}
      heading="Choose a new password"
      subheading={
        emailParam
          ? `Set a strong new password for ${emailParam}.`
          : `Create a new password for your ${schoolName} account.`
      }
    >
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>Your password has been updated successfully. You can now sign in with your new credentials.</span>
          </div>
          <Link
            href={loginHref}
            className={`w-full h-11 ${theme.buttonRadius} text-[13.5px] font-semibold inline-flex items-center justify-center transition-opacity hover:opacity-90`}
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            Continue to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#2d2b26] mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#d8d4ca] bg-[#faf9f6] text-[14px] text-[#171614] focus:bg-white focus:outline-none focus:border-[#171614]"
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

          <div>
            <label className="block text-[12px] font-semibold text-[#2d2b26] mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full h-11 px-3.5 rounded-xl border border-[#d8d4ca] bg-[#faf9f6] text-[14px] text-[#171614] focus:bg-white focus:outline-none focus:border-[#171614]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-11 ${theme.buttonRadius} text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs`}
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            {loading ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      )}
    </TenantAuthShell>
  );
}

export default function ResetPasswordClient(props: ResetPasswordClientProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF9F5]" />}>
      <ResetPasswordInner {...props} />
    </Suspense>
  );
}
