'use client';

import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Search } from 'lucide-react';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
import { getTenantUrl } from '@/lib/tenant-url';
import type { CmsBrandConfig } from '@/lib/public-site-cms-schema';

export interface SchoolTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  lowestClass?: string | null;
  highestClass?: string | null;
  primaryColor?: string;
  logoUrl?: string | null;
  createdAt: string;
}

interface SchoolsDirectoryClientProps {
  initialSchools: SchoolTenant[];
  directoryAvailable?: boolean;
  brand?: Partial<CmsBrandConfig>;
}

const levelFilters = [
  { id: 'all', label: 'All schools' },
  { id: 'early', label: 'Nursery & early years' },
  { id: 'primary', label: 'Primary' },
  { id: 'secondary', label: 'Junior & senior secondary' },
  { id: 'through', label: 'Nursery to SSS' },
];

function schoolMatchesLevel(school: SchoolTenant, level: string) {
  const lowest = school.lowestClass?.toLowerCase() || '';
  const highest = school.highestClass?.toLowerCase() || '';
  const includesEarly =
    lowest.includes('nursery') ||
    lowest.includes('pre-school') ||
    lowest.includes('preschool') ||
    lowest.includes('early');
  const includesPrimary = lowest.includes('primary') || highest.includes('primary');
  const includesSecondary =
    lowest.includes('jss') ||
    lowest.includes('junior secondary') ||
    highest.includes('sss') ||
    highest.includes('senior secondary');

  if (level === 'early') return includesEarly;
  if (level === 'primary') return includesPrimary || includesEarly;
  if (level === 'secondary') return includesSecondary;
  if (level === 'through') return includesEarly && includesSecondary;
  return true;
}

export function SchoolsDirectoryClient({
  initialSchools,
  directoryAvailable = true,
  brand,
}: SchoolsDirectoryClientProps) {
  const platformName = brand?.name || 'School Platform';
  const primaryColor = brand?.primaryColor || '#141518';
  const accentColor = brand?.accentColor || '#17834b';

  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copyErrorSlug, setCopyErrorSlug] = useState<string | null>(null);

  const filteredSchools = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return initialSchools.filter((school) => {
      const matchesSearch =
        !term ||
        school.name.toLocaleLowerCase().includes(term) ||
        school.slug.toLocaleLowerCase().includes(term);
      return matchesSearch && schoolMatchesLevel(school, selectedLevel);
    });
  }, [initialSchools, search, selectedLevel]);

  const handleCopyLink = async (slug: string) => {
    const cleanSlug = slug.replace(/-\d{10,}$/, '');
    try {
      await navigator.clipboard.writeText(getTenantUrl(cleanSlug, '/'));
      setCopiedSlug(slug);
      setCopyErrorSlug(null);
      window.setTimeout(() => setCopiedSlug((current) => (current === slug ? null : current)), 2000);
    } catch {
      setCopyErrorSlug(slug);
      setCopiedSlug(null);
      window.setTimeout(() => setCopyErrorSlug((current) => (current === slug ? null : current)), 3000);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedLevel('all');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f6] text-[#141518] antialiased">
      <PublicNavbar brand={brand} />

      <main className="flex-1">
        {/* Editorial Directory Hero */}
        <section className="text-white" style={{ backgroundColor: primaryColor }}>
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[1fr_.85fr] md:items-end lg:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
                <span data-no-translate="true">{platformName}</span> directory
              </p>
              <h1 className="tenant-editorial-display mt-4 max-w-[14ch] text-4xl font-normal leading-[1.03] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
                Find your school’s online portal.
              </h1>
            </div>
            <p className="max-w-xl text-sm leading-7 text-white/75 sm:text-base md:justify-self-end">
              Search for your school by name or portal address to open its website, student &amp; parent portal, or online result checker.
            </p>
          </div>
        </section>

        <section
          className="mx-auto w-full max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-12 lg:px-10"
          aria-labelledby="directory-heading"
        >
          <div className="flex flex-col gap-4 border-b border-[#e6e4de] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="directory-heading" className="text-2xl font-semibold tracking-[-0.025em] text-[#141518]">
                Active school portals
              </h2>
              <p className="mt-1.5 text-sm text-[#5a5b60]">
                Filter by name, slug, or school level to jump straight to your workspace.
              </p>
            </div>
            <p className="font-mono text-xs font-medium text-[#717278]" aria-live="polite">
              {filteredSchools.length} {filteredSchools.length === 1 ? 'school' : 'schools'} listed
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
            <div>
              <label htmlFor="school-search" className="mb-1.5 block text-xs font-semibold text-[#141518]">
                Search schools
              </label>
              <div className="flex min-h-11 items-center gap-3 rounded-xl border border-[#d5d2ca] bg-white px-3.5 shadow-[0_1px_2px_rgba(17,17,16,0.03)] focus-within:border-[#141518]">
                <Search size={16} className="shrink-0 text-[#717278]" aria-hidden="true" />
                <input
                  id="school-search"
                  type="search"
                  placeholder="Enter your school name or portal slug…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[#141518] outline-none placeholder:text-[#8c8d94]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="px-2 py-1 text-xs font-medium text-[#5a5b60] hover:text-[#141518] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <label className="block text-xs font-semibold text-[#141518]">
              School level
              <select
                value={selectedLevel}
                onChange={(event) => setSelectedLevel(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-[#d5d2ca] bg-white px-3.5 text-sm font-normal text-[#141518] shadow-[0_1px_2px_rgba(17,17,16,0.03)] focus:border-[#141518] focus:outline-none"
              >
                {levelFilters.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!directoryAvailable ? (
            <div className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-6" role="status">
              <h3 className="text-base font-semibold text-amber-950">
                The school directory is temporarily unavailable.
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-amber-900/80">
                Please try again shortly. Your school’s direct portal address may still be available from your school office.
              </p>
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-[#e6e4de] bg-white px-6 py-10 text-center sm:px-8" role="status">
              <h3 className="text-lg font-semibold text-[#141518]">
                {initialSchools.length === 0
                  ? 'No school portals are listed yet.'
                  : 'No matching schools found.'}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5a5b60]">
                {initialSchools.length === 0
                  ? `When schools launch on ${platformName}, their public portals appear here.`
                  : 'Check the spelling, try a shorter search, or reset the school-level filter.'}
              </p>
              {(search || selectedLevel !== 'all') && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredSchools.map((school) => {
                const portalUrl = getTenantUrl(school.slug, '/');
                const loginPath = getTenantUrl(school.slug, '/login');
                const publicSitePath = getTenantUrl(school.slug, '/');
                const resultsPath = getTenantUrl(school.slug, '/results/check');
                const initial = school.name.trim().charAt(0).toLocaleUpperCase() || 'S';
                const isCopied = copiedSlug === school.slug;
                const hasLevels = Boolean(school.lowestClass || school.highestClass);

                return (
                  <article
                    key={school.id}
                    className="flex min-h-full flex-col rounded-2xl border border-[#e6e4de] bg-white p-5 shadow-[0_1px_3px_rgba(17,17,16,0.04)] transition-all hover:border-[#cfcbb8] sm:p-6"
                  >
                    <div className="flex items-start gap-3.5">
                      {school.logoUrl ? (
                        <img
                          src={school.logoUrl}
                          alt={`${school.name} logo`}
                          className="h-11 w-11 shrink-0 rounded-xl border border-[#e6e4de] bg-white object-contain p-1"
                        />
                      ) : (
                        <span
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-bold text-white"
                          style={{ backgroundColor: school.primaryColor || accentColor }}
                          aria-hidden="true"
                        >
                          {initial}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-[15.5px] font-semibold leading-snug text-[#141518]">
                          {school.name}
                        </h3>
                        {hasLevels ? (
                          <p className="mt-0.5 text-xs text-[#717278]">
                            {[school.lowestClass, school.highestClass].filter(Boolean).join(' – ')}
                          </p>
                        ) : (
                          <p className="mt-0.5 font-mono text-[11px] text-[#717278]">/{school.slug}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 border-y border-[#efede9] py-3">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#717278]">
                        Portal address
                      </p>
                      <div className="mt-1.5 flex min-w-0 items-center gap-2">
                        <a
                          href={publicSitePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate font-mono text-xs text-[#141518] hover:underline"
                        >
                          {portalUrl.replace(/^https?:\/\//, '')}
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleCopyLink(school.slug)}
                          aria-label={`Copy ${school.name} portal address`}
                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#e6e4de] bg-[#faf9f6] px-2.5 text-[11px] font-medium text-[#4a4b50] hover:bg-[#f0eee8] cursor-pointer"
                        >
                          {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          {isCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      {copyErrorSlug === school.slug && (
                        <p className="mt-1 text-[10px] text-rose-600">Could not copy automatically.</p>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 pt-1">
                      <a
                        href={publicSitePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: accentColor }}
                      >
                        Website <ExternalLink size={11} />
                      </a>
                      <a
                        href={loginPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e6e4de] bg-[#faf9f6] text-xs font-medium text-[#141518] hover:bg-[#f0eee8]"
                      >
                        Portal
                      </a>
                      <a
                        href={resultsPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e6e4de] bg-[#faf9f6] text-xs font-medium text-[#141518] hover:bg-[#f0eee8]"
                      >
                        Results
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <PublicFooter brand={brand} />
    </div>
  );
}
