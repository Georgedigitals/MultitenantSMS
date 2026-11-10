'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTenantTrialStatus } from '@/lib/trial';

interface TrialBannerProps {
  slug: string;
  status: string;
  trialEndsAt?: string | Date | null;
  planName?: string;
  userRole?: string;
}

export default function TrialBanner({
  slug,
  status,
  trialEndsAt,
  planName = 'Platform Plan',
  userRole = 'school_admin',
}: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDismissed = sessionStorage.getItem(`trial_banner_dismissed_${slug}`);
      if (isDismissed === 'true') {
        setDismissed(true);
      }
    }
  }, [slug]);

  // Only show trial banner if tenant is in trial status and user is school_admin or teacher
  if (status !== 'trial' || (userRole !== 'school_admin' && userRole !== 'teacher')) {
    return null;
  }

  const trialInfo = getTenantTrialStatus({ status, trialEndsAt });

  // Do not dismiss if trial has expired or <= 3 days left (critical notification)
  const isUrgent = trialInfo.isExpired || trialInfo.daysRemaining <= 3;
  if (dismissed && !isUrgent) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`trial_banner_dismissed_${slug}`, 'true');
    }
  };

  // 1. Expired past grace period
  if (trialInfo.isExpired && !trialInfo.isGracePeriod) {
    return (
      <div className="print:hidden bg-rose-950 text-rose-100 border-b border-rose-800 px-4 py-3 sm:px-6 shadow-md transition-all">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-900 border border-rose-700 text-rose-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <p className="text-sm font-medium">
              <strong className="font-semibold text-white">Free Trial Expired:</strong> Your trial for <span className="font-semibold text-rose-200">{planName}</span> has ended. Activate your subscription to restore school access.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/${slug}/dashboard/subscription`}
              className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg bg-white text-rose-950 hover:bg-rose-50 text-xs font-semibold shadow-sm transition-colors"
            >
              Activate Subscription
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Urgent Expiry (<= 3 days left)
  if (trialInfo.daysRemaining <= 3) {
    return (
      <div className="print:hidden bg-amber-900 text-amber-100 border-b border-amber-700 px-4 py-2.5 sm:px-6 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-800 text-amber-200">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <p className="text-xs sm:text-sm">
              <strong className="font-semibold text-white">Trial Ending Soon:</strong> Only <span className="font-bold underline text-amber-200">{trialInfo.daysRemaining} day{trialInfo.daysRemaining === 1 ? '' : 's'}</span> left in your {planName} trial.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/${slug}/dashboard/subscription`}
              className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-md bg-amber-300 hover:bg-amber-200 text-amber-950 text-xs font-bold shadow-sm transition-colors"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Standard Active Trial (> 3 days left)
  return (
    <div className="print:hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-slate-100 border-b border-indigo-900/60 px-4 py-2.5 sm:px-6 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-900/80 border border-indigo-700/50 text-indigo-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </span>
          <p className="text-xs sm:text-sm text-slate-200">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mr-2">
              Free Trial
            </span>
            You have <strong className="font-semibold text-white">{trialInfo.daysRemaining} days remaining</strong> on your <span className="text-indigo-200 font-medium">{planName}</span> trial.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/${slug}/dashboard/subscription`}
            className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors"
          >
            View Pricing Plans
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
