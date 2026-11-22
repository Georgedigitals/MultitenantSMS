'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';

interface PinItem {
  id: string;
  serialNumber: string;
  pinCode: string;
  pricePaid: number;
  isUsed: boolean;
  usesCount: number;
}

interface BatchDetail {
  id: string;
  batchNumber: string;
  quantity: number;
  maxUsesPerPin: number;
  pricePerPin: number;
  createdAt: string;
  pins: PinItem[];
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  branding: {
    primaryColor?: string;
    accentColor?: string;
    logoUrl?: string | null;
  };
  portalUrl: string;
}

export function BatchPrintClient({ slug, batchId }: { slug: string; batchId: string }) {
  const { localization: { currencySymbol, locale } } = useLanguage();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Print view options
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');
  const [showPinCode, setShowPinCode] = useState(true);

  useEffect(() => {
    const fetchBatchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/tenant/pins/batch/${batchId}?slug=${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load PIN batch');
        setBatch(data.batch);
        setTenant(data.tenant);
      } catch (err: any) {
        setError(err.message || 'Error loading batch');
      } finally {
        setLoading(false);
      }
    };

    fetchBatchData();
  }, [slug, batchId]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-xs font-mono text-slate-500">Loading cards for batch printing...</p>
      </div>
    );
  }

  if (error || !batch || !tenant) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl border border-red-200 text-center space-y-4">
        <p className="text-sm font-bold text-red-700">{error || 'Failed to load batch'}</p>
        <Link
          href={`/${slug}/dashboard/results/pins`}
          className="inline-block px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
        >
          ← Back to PIN Batches
        </Link>
      </div>
    );
  }

  const primaryCol = tenant.branding?.primaryColor || '#0F172A';
  const logoUrl = tenant.branding?.logoUrl;
  const schoolInitials = tenant.name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 3)
    .join('')
    .toUpperCase() || 'SCH';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 print:bg-white print:p-0 print:m-0">
      {/* TOOLBAR CONTROLS (Hidden during print) */}
      <div className="print:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 mb-6 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/${slug}/dashboard/results/pins`}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-sm font-bold text-slate-900">
                Print Batch #{batch.batchNumber} ({batch.pins.length} Cards)
              </h1>
              <p className="text-[11px] text-slate-500">
                WAEC-Style Physical Scratch Card Layout • Ready for Cardstock Paper (A4)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Filter */}
            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px] font-semibold">
              <button
                onClick={() => setViewMode('both')}
                className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === 'both' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'}`}
              >
                Front &amp; Back
              </button>
              <button
                onClick={() => setViewMode('front')}
                className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === 'front' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'}`}
              >
                Front Only
              </button>
              <button
                onClick={() => setViewMode('back')}
                className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === 'back' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'}`}
              >
                Back Only
              </button>
            </div>

            {/* Toggle PIN Text vs Scratch Foil Box */}
            <button
              onClick={() => setShowPinCode(!showPinCode)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              {showPinCode ? '👁️ Revealing PINs (Apply Scratch Sticker)' : '🔒 Concealed Scratch Area'}
            </button>

            {/* Print Trigger */}
            <button
              onClick={() => window.print()}
              className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Scratch Cards
            </button>
          </div>
        </div>
      </div>

      {/* PRINT STYLES */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-card-container {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* CARDS PRINT GRID */}
      <div className="max-w-6xl mx-auto px-4 print:p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 print:grid-cols-2 print:gap-4">
          {batch.pins.map((pin, idx) => (
            <div
              key={pin.id}
              className="print-card-container bg-white p-3 rounded-2xl border border-dashed border-slate-300 print:border-slate-300 print:rounded-none space-y-4"
            >
              {/* Optional Index Tag */}
              <div className="print:hidden flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>CARD #{idx + 1}</span>
                <span>SERIAL: {pin.serialNumber}</span>
              </div>

              {/* CARD FRONT SIDE (Modeled after WAEC Reference Image) */}
              {(viewMode === 'both' || viewMode === 'front') && (
                <div
                  className="w-full aspect-[85.6/54] rounded-xl overflow-hidden border border-slate-300/80 shadow-xs relative flex flex-col justify-between bg-gradient-to-br from-amber-100 via-amber-50 to-orange-100 select-none text-slate-900"
                  style={{ minHeight: '215px' }}
                >
                  {/* Subtle academic background watermark overlay */}
                  <div
                    className="absolute inset-0 opacity-15 bg-cover bg-center pointer-events-none"
                    style={{
                      backgroundImage: `radial-gradient(circle at 30% 50%, rgba(245, 158, 11, 0.4) 0%, transparent 60%)`,
                    }}
                  />

                  {/* Top Bar Header */}
                  <div className="bg-[#1E3A8A] text-white px-3.5 py-2 flex items-center justify-between z-10 border-b-2 border-amber-400">
                    <div>
                      <span className="font-black text-amber-300 text-sm tracking-wide lowercase inline-block font-sans">
                        {tenant.slug}
                      </span>
                      <span className="font-bold text-white text-xs italic tracking-normal ml-1">
                        ... Access Card
                      </span>
                    </div>

                    <span className="text-[9px] uppercase tracking-widest text-amber-200/90 font-mono font-bold">
                      OFFICIAL
                    </span>
                  </div>

                  {/* Card Body with Sunburst Crest and Examination Graphic */}
                  <div className="flex-1 p-3.5 flex items-center justify-between z-10">
                    <div className="max-w-[55%] space-y-1">
                      <div className="inline-block px-2 py-0.5 rounded bg-blue-900/10 text-blue-950 font-black text-[11px] uppercase tracking-tight">
                        {tenant.name}
                      </div>
                      <p className="text-[10px] font-serif text-slate-700 leading-tight">
                        Continuous Assessment &amp; Terminal Examination Online Result Checker
                      </p>
                      <div className="pt-1.5 flex items-center gap-1.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-900 font-bold">
                          {currencySymbol}{batch.pricePerPin.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-600 font-medium">5 Uses Max</span>
                      </div>
                    </div>

                    {/* Sunburst Emblem (WAEC-Style Reference Motif) */}
                    <div className="relative flex items-center justify-center shrink-0">
                      {/* Sunburst Star Points */}
                      <div className="w-20 h-20 rounded-full bg-blue-700 flex items-center justify-center shadow-md relative border-2 border-amber-400">
                        {/* Sun rays simulation */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-22 h-22 border border-blue-600 rotate-45 pointer-events-none" />
                          <div className="w-22 h-22 border border-amber-400/60 rotate-12 pointer-events-none" />
                        </div>

                        {/* Center Emblem Disc */}
                        <div className="w-14 h-14 rounded-full bg-blue-900 border-2 border-amber-300 flex flex-col items-center justify-center text-center p-1 z-10">
                          {logoUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={logoUrl} alt="Logo" className="w-7 h-7 object-contain rounded-full" />
                          ) : (
                            <span className="text-amber-300 font-black text-xs tracking-tighter">
                              {schoolInitials}
                            </span>
                          )}
                          <span className="text-[6px] font-bold text-white uppercase tracking-tight leading-none mt-0.5">
                            VERIFIED
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Front Footer */}
                  <div className="bg-[#1E3A8A] text-white px-3.5 py-1 flex items-center justify-between text-[9px] font-mono font-medium z-10">
                    <span className="text-blue-100">{tenant.portalUrl.replace(/^https?:\/\//, '')}</span>
                    <span className="text-amber-300 font-bold tracking-wider">{pin.serialNumber}</span>
                  </div>
                </div>
              )}

              {/* CARD BACK SIDE (Modeled after WAEC Reference Image) */}
              {(viewMode === 'both' || viewMode === 'back') && (
                <div
                  className="w-full aspect-[85.6/54] rounded-xl overflow-hidden border border-slate-300/80 shadow-xs relative flex flex-col justify-between bg-white select-none text-slate-800 p-3"
                  style={{ minHeight: '215px' }}
                >
                  {/* Back Header */}
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-800 text-amber-300 flex items-center justify-center text-[8px] font-black shrink-0">
                      ★
                    </div>
                    <span className="font-bold text-[11px] text-slate-900 tracking-tight truncate">
                      {tenant.name}
                    </span>
                  </div>

                  {/* Instructions List (WAEC Exact Style) */}
                  <div className="text-[8.5px] leading-snug text-slate-700 space-y-1">
                    <p className="font-bold italic text-slate-900">
                      How to use this card:
                    </p>
                    <p className="italic text-slate-600">
                      Scratch off the covered area to obtain your secret PIN (A - 12 digit number)
                    </p>

                    <div className="pt-0.5 space-y-0.5">
                      <p className="font-bold text-slate-900 text-[8.5px]">Internet Access:</p>
                      <p className="text-[8px] pl-1">• Visit portal website: <span className="font-mono text-blue-700 font-bold">{tenant.portalUrl.replace(/^https?:\/\//, '')}</span></p>
                      <p className="text-[8px] pl-1">• Fill in required information (Student Reg ID, Term, Card PIN and Serial Number)</p>
                      <p className="text-[8px] pl-1">• Click Submit to view and download complete Report Card</p>
                    </div>
                  </div>

                  {/* SCRATCH PANEL & SERIAL NUMBER */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    {/* Scratch Strip Area (Standard 50mm x 10mm) */}
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold uppercase text-slate-500 font-mono">PIN:</span>
                        <div
                          className="flex-1 py-1 px-2.5 rounded-sm border border-slate-300 relative flex items-center justify-center font-mono font-bold tracking-wider text-xs"
                          style={{
                            background: showPinCode
                              ? '#F8FAFC'
                              : 'repeating-linear-gradient(45deg, #CBD5E1, #CBD5E1 4px, #94A3B8 4px, #94A3B8 8px)',
                          }}
                        >
                          {showPinCode ? (
                            <span className="text-slate-900 text-[11px] tracking-widest font-black">
                              {pin.pinCode}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                              [SCRATCH OFF HERE]
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Serial Number Display */}
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-black text-slate-900 block leading-tight">
                        {pin.serialNumber}
                      </span>
                      <span className="text-[7.5px] uppercase font-bold text-slate-400 tracking-wider">
                        Serial Number
                      </span>
                    </div>
                  </div>

                  {/* Back Footer Warning */}
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[7px] text-slate-500 leading-none">
                    <p className="italic font-semibold text-slate-700">
                      Do not accept this card if the slip has been scratched off. The card allows five uses on one student examination number.
                    </p>
                    <span className="font-mono text-slate-400 uppercase shrink-0 ml-1">Valid for Session</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
