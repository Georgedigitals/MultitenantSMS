'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, School, ArrowRight, ShieldCheck, KeyRound, Sparkles, AlertCircle } from 'lucide-react';

interface SchoolItem {
  id: string;
  name: string;
  slug: string;
  state: string;
  city: string;
  logoUrl: string | null;
  primaryColor: string;
  pinPrice: number;
}

interface CentralResultCheckerClientProps {
  schools: SchoolItem[];
  initialStudentId?: string;
}

export default function CentralResultCheckerClient({
  schools,
  initialStudentId = '',
}: CentralResultCheckerClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [studentId, setStudentId] = useState(initialStudentId);
  const [selectedSchoolSlug, setSelectedSchoolSlug] = useState<string>(
    schools[0]?.slug || ''
  );

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDirectCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolSlug) return;
    const query = new URLSearchParams();
    if (studentId.trim()) query.set('studentId', studentId.trim());
    const queryString = query.toString() ? `?${query.toString()}` : '';
    router.push(`/${selectedSchoolSlug}/results/check${queryString}`);
  };

  return (
    <div className="space-y-12">
      {/* Hero Title */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/60 text-blue-300 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Official Nigerian School Result Checker Network</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Online Terminal Report &amp; PIN Verification
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Select your academic institution below or enter your student registration ID to verify continuous assessment scores, position rankings, and psychomotor remarks.
        </p>
      </div>

      {/* Quick Lookup Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        <form onSubmit={handleDirectCheck} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                1. Select Academic Institution *
              </label>
              <select
                value={selectedSchoolSlug}
                onChange={(e) => setSelectedSchoolSlug(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.slug} className="bg-slate-900 text-white">
                    {s.name} ({s.city}, {s.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                2. Admission / Student Reg ID (Optional)
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. APEX/2026/0001 or Student ID"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Requires 12-digit scratch card PIN or instant Paystack issuance</span>
            </span>

            <button
              type="submit"
              disabled={!selectedSchoolSlug}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>Go to Result Checker Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Directory of Institutions */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Participating Institutions</h2>
            <p className="text-xs text-slate-400">Click on your institution to open its dedicated branded result checking portal</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search schools or campus..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
          </div>
        </div>

        {filteredSchools.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
            <School className="w-8 h-8 mx-auto text-slate-600" />
            <p className="font-semibold text-sm">No schools match &quot;{searchTerm}&quot;</p>
            <p className="text-xs text-slate-500">Try searching with a different campus or school name.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSchools.map((s) => (
              <Link
                key={s.id}
                href={`/${s.slug}/results/check`}
                className="group p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-blue-500/50 transition-all shadow-sm hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3.5 mb-3.5">
                    {s.logoUrl ? (
                      <img
                        src={s.logoUrl}
                        alt={s.name}
                        className="w-12 h-12 rounded-xl object-contain bg-white p-1 shadow-xs"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md"
                        style={{ backgroundColor: s.primaryColor }}
                      >
                        {s.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {s.name}
                      </h3>
                      <p className="text-xs text-slate-400">{s.city}, {s.state}</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-400 font-mono">
                    <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                      <span>Result PIN Fee:</span>
                      <span className="text-slate-200 font-bold">₦{s.pinPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                      <span>Online Delivery:</span>
                      <span className="text-emerald-400 font-semibold">Instant / Paystack</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:text-blue-300">
                  <span>Open Result Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Instructions & Security Guide */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-400">
        <div className="space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-900/40 text-blue-400 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h4 className="font-bold text-white text-sm">Obtain Your Result PIN</h4>
          <p className="leading-relaxed">
            Purchase a physical scratch card from your school bursary or click &quot;Instant Online Purchase&quot; on your school&apos;s result page to pay securely via Paystack.
          </p>
        </div>

        <div className="space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-900/40 text-indigo-400 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h4 className="font-bold text-white text-sm">Clear Outstanding School Fees</h4>
          <p className="leading-relaxed">
            In compliance with institutional financial policies, term school fees must be cleared. If pending balance exists, pay online or upload a transfer receipt.
          </p>
        </div>

        <div className="space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/40 text-emerald-400 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h4 className="font-bold text-white text-sm">View, Download &amp; Print</h4>
          <p className="leading-relaxed">
            Enter your 12-digit PIN code. Access your official signed broadsheet report card with letter grades, attendance percentage, and class ranking.
          </p>
        </div>
      </div>
    </div>
  );
}

