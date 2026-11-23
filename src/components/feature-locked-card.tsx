import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Lock, Sparkles } from 'lucide-react';

interface FeatureLockedCardProps {
  slug: string;
  featureTitle: string;
  description: string;
  highlights?: string[];
  primaryColor?: string;
  platformName?: string;
  currentPlanName?: string;
}

export function FeatureLockedCard({
  slug,
  featureTitle,
  description,
  highlights = [],
  primaryColor = '#4f46e5',
  platformName = 'School Platform',
  currentPlanName,
}: FeatureLockedCardProps) {
  return (
    <div className="mx-auto max-w-2xl py-8 sm:py-12">
      <section className="overflow-hidden rounded-2xl border border-[#e6e4de] bg-white shadow-[0_8px_30px_rgba(17,17,16,0.06)]">
        {/* School-Branded Top Banner */}
        <div
          className="relative overflow-hidden px-6 py-7 text-white sm:px-8"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, color-mix(in srgb, ${primaryColor} 68%, #0f172a) 100%)`,
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl"
          />
          <div className="relative z-10 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/25 backdrop-blur-xs">
              <Lock className="w-5 h-5 text-white" />
            </span>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/95">
                <Sparkles className="w-3 h-3" />
                Plan Upgrade Module
              </span>
              <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-white">
                {featureTitle} isn&apos;t enabled on your current plan
              </h1>
              {currentPlanName && (
                <p className="mt-1 text-xs text-white/80">
                  Current tier: <strong className="font-semibold text-white">{currentPlanName}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <p className="text-sm leading-6 text-[#4a4b50]">{description}</p>

          {highlights.length > 0 && (
            <div className="rounded-xl border border-[#e6e4de] bg-[#faf9f6] p-4 space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#717278]">
                What&apos;s included when unlocked
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#141518]">
                {highlights.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <Link
              href={`/${slug}/dashboard/subscription`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              <span>View Upgrade Plans</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/${slug}/dashboard`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#d5d2ca] bg-white px-4 text-sm font-medium text-[#141518] hover:bg-[#f2f0eb] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Overview</span>
            </Link>
          </div>

          <p className="border-t border-[#efede9] pt-4 text-xs text-[#717278]">
            Need this module enabled on a custom contract? Contact your school administrator or{' '}
            <span data-no-translate="true" className="font-medium text-[#141518]">
              {platformName}
            </span>{' '}
            support to request access.
          </p>
        </div>
      </section>
    </div>
  );
}
