'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { TenantAuthShell } from '@/components/tenant-auth-shell';
import { getTemplateThemeTokens, type TenantTemplateId } from '@/lib/template-theme';

interface ForgotPasswordClientProps {
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

export default function ForgotPasswordClient({
  slug,
  schoolName,
  motto,
  templateId,
  branding,
}: ForgotPasswordClientProps) {
  const pathname = usePathname() || '';
  const isPathRouted = pathname.startsWith(`/${slug}`);
  const loginHref = isPathRouted ? `/${slug}/login` : '/login';

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const primary = branding.primaryColor || '#1D3251';
  const accent = branding.accentColor || '#C8A45D';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const theme = getTemplateThemeTokens(templateId, primary, accent);

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
    <TenantAuthShell
      slug={slug}
      schoolName={schoolName}
      motto={motto}
      templateId={templateId}
      branding={branding}
      heading="Reset your password"
      subheading="Enter your email address or username and we'll send you a secure recovery link."
    >
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          {devResetUrl && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
              <p className="font-semibold">Development Reset Link:</p>
              <a
                href={devResetUrl}
                className="inline-flex items-center gap-1 font-medium underline break-all"
              >
                <span>Open reset page</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          )}
          <Link
            href={loginHref}
            className={`w-full h-11 ${theme.buttonRadius} text-[13.5px] font-semibold inline-flex items-center justify-center transition-opacity hover:opacity-90`}
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            Return to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#2d2b26] mb-1.5">
              Email or Username
            </label>
            <input
              type="text"
              required
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="e.g. teacher@school.edu"
              className="w-full h-11 px-3.5 rounded-xl border border-[#d8d4ca] bg-[#faf9f6] text-[14px] text-[#171614] placeholder:text-[#9a958b] focus:bg-white focus:outline-none focus:border-[#171614] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-11 ${theme.buttonRadius} text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs`}
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            {loading ? 'Sending recovery link...' : 'Send reset link'}
          </button>

          <div className="pt-2 text-center">
            <Link
              href={loginHref}
              className="text-[12.5px] font-semibold underline underline-offset-4 hover:opacity-75"
              style={{ color: primary }}
            >
              ← Back to sign in
            </Link>
          </div>
        </form>
      )}
    </TenantAuthShell>
  );
}
