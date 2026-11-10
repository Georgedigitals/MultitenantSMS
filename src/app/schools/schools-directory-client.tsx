'use client';

import React, { useMemo, useState } from 'react';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
import { getTenantUrl } from '@/lib/tenant-url';

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
  const includesEarly = lowest.includes('nursery') || lowest.includes('pre-school') || lowest.includes('preschool') || lowest.includes('early');
  const includesPrimary = lowest.includes('primary') || highest.includes('primary');
  const includesSecondary = lowest.includes('jss') || lowest.includes('junior secondary') || highest.includes('sss') || highest.includes('senior secondary');

  if (level === 'early') return includesEarly;
  if (level === 'primary') return includesPrimary || includesEarly;
  if (level === 'secondary') return includesSecondary;
  if (level === 'through') return includesEarly && includesSecondary;
  return true;
}

export function SchoolsDirectoryClient({ initialSchools, directoryAvailable = true }: SchoolsDirectoryClientProps) {
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copyErrorSlug, setCopyErrorSlug] = useState<string | null>(null);

  const filteredSchools = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return initialSchools.filter((school) => {
      const matchesSearch = !term || school.name.toLocaleLowerCase().includes(term) || school.slug.toLocaleLowerCase().includes(term);
      return matchesSearch && schoolMatchesLevel(school, selectedLevel);
    });
  }, [initialSchools, search, selectedLevel]);

  const handleCopyLink = async (slug: string) => {
    const cleanSlug = slug.replace(/-\d{10,}$/, '');
    try {
      await navigator.clipboard.writeText(getTenantUrl(cleanSlug, '/'));
      setCopiedSlug(slug);
      setCopyErrorSlug(null);
      window.setTimeout(() => setCopiedSlug((current) => current === slug ? null : current), 2000);
    } catch {
      setCopyErrorSlug(slug);
      setCopiedSlug(null);
      window.setTimeout(() => setCopyErrorSlug((current) => current === slug ? null : current), 3000);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedLevel('all');
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#172d40] antialiased selection:bg-[#d6f0df] selection:text-[#102d43]">
      <PublicNavbar />

      <main className="flex-1">
        <section className="bg-[linear-gradient(120deg,#092b45_0%,#0b344b_58%,#0a4b47_100%)] text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-18 md:grid-cols-[1fr_.8fr] md:items-end lg:px-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#63d28b]">BMS school directory</p>
              <h1 className="mt-4 max-w-[14ch] text-4xl font-extrabold leading-[1.06] tracking-[-.04em] sm:text-5xl lg:text-6xl">Find your school’s online portal.</h1>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[#d4e0e7] sm:text-base md:justify-self-end">Search for a Nigerian school by name, then choose its school website, parent and student portal, or results page.</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-12 lg:px-10" aria-labelledby="directory-heading">
          <div className="grid gap-6 border-b border-[#e5e9ed] pb-7 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 id="directory-heading" className="text-2xl font-bold tracking-[-.03em] text-[#102d43]">Schools on BMS</h2>
              <p className="mt-2 text-sm text-[#5d6d78]">Use the school’s name or its portal address to find the right page.</p>
            </div>
            <p className="text-sm font-semibold text-[#344b5b]" aria-live="polite">{filteredSchools.length} {filteredSchools.length === 1 ? 'school' : 'schools'} shown</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
            <div>
              <label htmlFor="school-search" className="mb-2 block text-sm font-semibold text-[#263c4d]">Search schools</label>
              <div className="flex min-h-12 items-center gap-3 border border-[#cbd5dc] bg-white px-4 focus-within:border-[#17834b] focus-within:ring-2 focus-within:ring-[#17834b]/20">
                <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[#60717d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
                <input id="school-search" type="search" placeholder="For example, enter your school name" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm text-[#172d40] outline-none placeholder:text-[#778691]" />
                {search && <button type="button" onClick={() => setSearch('')} className="min-h-9 px-2 text-xs font-semibold text-[#176e42] underline underline-offset-2">Clear search</button>}
              </div>
            </div>
            <label className="block text-sm font-semibold text-[#263c4d]">School level
              <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)} className="mt-2 min-h-12 w-full border border-[#cbd5dc] bg-white px-3 text-sm text-[#263c4d] focus:border-[#17834b] focus:outline-none focus:ring-2 focus:ring-[#17834b]/20">
                {levelFilters.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
              </select>
            </label>
          </div>

          {!directoryAvailable ? (
            <div className="mt-10 border-l-4 border-[#b97822] bg-[#fff8e9] p-6" role="status">
              <h3 className="text-base font-bold text-[#463517]">The school directory is temporarily unavailable.</h3>
              <p className="mt-2 text-sm leading-6 text-[#67583d]">Please try again shortly. Your school’s direct portal address may still be available from the school.</p>
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="mt-10 border-t-4 border-[#17834b] bg-[#f3f6f2] px-6 py-8 sm:px-8" role="status">
              <h3 className="text-lg font-bold text-[#18334a]">{initialSchools.length === 0 ? 'No school portals are listed yet.' : 'We couldn’t find a matching school.'}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#5d6d78]">{initialSchools.length === 0 ? 'When a school joins BMS and makes its portal available, it will appear here.' : 'Check the spelling, try a shorter search, or remove the school-level filter.'}</p>
              {(search || selectedLevel !== 'all') && <button type="button" onClick={clearFilters} className="mt-5 inline-flex min-h-10 items-center justify-center bg-[#17834b] px-4 text-sm font-bold text-white hover:bg-[#126b3d]">Clear filters</button>}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSchools.map((school) => {
                const portalUrl = getTenantUrl(school.slug, '/');
                const loginPath = getTenantUrl(school.slug, '/login');
                const publicSitePath = getTenantUrl(school.slug, '/');
                const resultsPath = getTenantUrl(school.slug, '/results/check');
                const initial = school.name.trim().charAt(0).toLocaleUpperCase() || 'S';
                const isCopied = copiedSlug === school.slug;
                const hasLevels = Boolean(school.lowestClass || school.highestClass);

                return (
                  <article key={school.id} className="flex min-h-full flex-col border border-[#dce3e8] bg-white p-5 transition-colors hover:border-[#9bb8a2] sm:p-6">
                    <div className="flex items-start gap-4">
                      {school.logoUrl ? <img src={school.logoUrl} alt={`${school.name} logo`} className="h-12 w-12 shrink-0 border border-[#e5e9ed] bg-white object-contain p-1" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: school.primaryColor || '#17834b' }} aria-hidden="true">{initial}</span>}
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-bold leading-6 text-[#18334a]">{school.name}</h3>
                        <p className="mt-1 text-xs text-[#687984]">School portal on BMS</p>
                      </div>
                    </div>

                    <div className="mt-5 border-y border-[#e5e9ed] py-3">
                      <p className="text-[11px] font-semibold text-[#687984]">Portal address</p>
                      <div className="mt-1.5 flex min-w-0 items-center gap-2">
                        <a href={publicSitePath} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all text-xs font-medium text-[#176e42] underline decoration-[#a9c8af] underline-offset-2">{portalUrl.replace(/^https?:\/\//, '')}</a>
                        <button type="button" onClick={() => void handleCopyLink(school.slug)} aria-label={`Copy ${school.name} portal address`} className="min-h-9 shrink-0 border border-[#cbd5dc] px-3 text-xs font-semibold text-[#344b5b] hover:bg-[#f3f6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]">{isCopied ? 'Copied' : 'Copy link'}</button>
                      </div>
                      <p className="mt-1 min-h-4 text-[10px] text-[#657580]" aria-live="polite">{isCopied ? 'Portal address copied.' : copyErrorSlug === school.slug ? 'Could not copy. Select the address to copy it.' : ''}</p>
                    </div>

                    <div className="flex-1 py-4">
                      <p className="text-[11px] font-semibold text-[#687984]">School levels</p>
                      <p className="mt-1 text-sm text-[#344b5b]">{hasLevels ? `${school.lowestClass || 'Not listed'} to ${school.highestClass || 'Not listed'}` : 'Levels not listed'}</p>
                    </div>

                    <div className="grid gap-2 border-t border-[#e5e9ed] pt-4">
                      <a href={loginPath} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#17834b] px-4 text-sm font-bold text-white transition-colors hover:bg-[#126b3d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]">Open school portal <span aria-hidden="true">↗</span></a>
                      <div className="grid grid-cols-2 gap-2">
                        <a href={resultsPath} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center border border-[#cbd5dc] px-2 text-xs font-semibold text-[#344b5b] hover:bg-[#f3f6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#17834b]">Check results ↗</a>
                        <a href={publicSitePath} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center border border-[#cbd5dc] px-2 text-xs font-semibold text-[#344b5b] hover:bg-[#f3f6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#17834b]">School website ↗</a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
