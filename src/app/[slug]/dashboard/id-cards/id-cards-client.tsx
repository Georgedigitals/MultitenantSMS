'use client';

import React, { useMemo, useState } from 'react';
import {
  Printer,
  Search,
  Filter,
  User,
  Shield,
  GraduationCap,
  Sparkles,
  QrCode,
  RotateCcw,
  Check,
} from 'lucide-react';

export interface IdCardRecord {
  id: string;
  kind: 'student' | 'staff';
  name: string;
  identifier: string;
  subtitle: string;
  photoUrl: string | null;
  phone?: string | null;
  bloodGroup?: string | null;
  dob?: string | null;
  email?: string | null;
  qrPayload: string;
}

interface IdCardsClientProps {
  schoolName: string;
  schoolMotto?: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  sessionLabel: string;
  cards: IdCardRecord[];
}

export default function IdCardsClient({
  schoolName,
  schoolMotto,
  logoUrl,
  primaryColor,
  accentColor,
  sessionLabel,
  cards,
}: IdCardsClientProps) {
  const [type, setType] = useState<'all' | 'student' | 'staff'>('all');
  const [query, setQuery] = useState('');
  const [cardSide, setCardSide] = useState<'both' | 'front' | 'back'>('both');

  const visibleCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (type !== 'all' && card.kind !== type) return false;
      if (!normalizedQuery) return true;
      return `${card.name} ${card.identifier} ${card.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
  }, [cards, query, type]);

  // Dynamic QR Code Generator URL (Encodes staffId & staffCode for office kiosk scanning)
  const getQrUrl = (payload: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
      payload
    )}&color=090D16&bgcolor=FFFFFF&margin=0`;
  };

  return (
    <main className="space-y-6">
      {/* Print Styles for Standard Portrait CR80 ID Card Dimensions (2.125in x 3.375in) */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0.35in;
        }
        @media print {
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .id-cards-screen-only {
            display: none !important;
          }
          .id-cards-print-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 2.375in) !important;
            gap: 0.35in 0.35in !important;
            justify-content: center !important;
            page-break-inside: auto;
          }
          .id-card-wrapper {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Screen Controls Header */}
      <header className="id-cards-screen-only flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800">
              Smart Identification Badges
            </span>
            <span className="text-xs text-slate-400">• High-Definition Double-Sided</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Institutional ID Cards &amp; Kiosk Badges
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Modern corporate portrait badges customized with <strong className="text-slate-800">{schoolName}</strong> brand colors. Teachers can scan the embedded QR code on the back at the office kiosk terminal for instant clock-in/out.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={visibleCards.length === 0}
            className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-40"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Print {visibleCards.length} {visibleCards.length === 1 ? 'Badge' : 'Badges'}</span>
          </button>
        </div>
      </header>

      {/* Filter & View Toolbar */}
      <div className="id-cards-screen-only flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">

        {/* Roster Segment filter */}
        <div className="flex items-center gap-2">
          {(['all', 'student', 'staff'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${type === option
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {option === 'staff' ? 'Tutors & Staff' : option === 'all' ? 'All Members' : 'Students'}
            </button>
          ))}
        </div>

        {/* Side View Switcher (Both / Front Only / Back Only) */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <span className="text-[11px] font-bold text-slate-500 px-2 uppercase">Print View:</span>
          {(['both', 'front', 'back'] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setCardSide(side)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${cardSide === side ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {side === 'both' ? 'Front & Back' : `${side} Only`}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID or class..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {visibleCards.length === 0 ? (
        <div className="id-cards-screen-only rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center space-y-3">
          <User className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="font-bold text-slate-900">No matching identification records</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search criteria, or enroll students and teachers in the school directory first.
          </p>
        </div>
      ) : (
        <section
          className="id-cards-print-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 justify-items-center"
          aria-label="Generated ID cards"
        >
          {visibleCards.map((card) => {
            const isStaff = card.kind === 'staff';
            const qrUrl = getQrUrl(card.qrPayload);

            return (
              <React.Fragment key={`${card.kind}-${card.id}`}>
                {/* ── CARD FRONT (Inspired by User Reference Mockup) ── */}
                {(cardSide === 'both' || cardSide === 'front') && (
                  <div className="id-card-wrapper w-[235px] h-[365px] bg-white rounded-2xl border border-slate-300 shadow-lg flex flex-col justify-between overflow-hidden relative text-slate-900 font-sans">

                    {/* Top Dynamic Ribbon with Brand Angle Cuts */}
                    <div className="relative h-[115px] overflow-hidden w-full">
                      {/* Geometric Background Shapes with School Brand Colors */}
                      <div
                        className="absolute inset-0 transform -skew-y-12 origin-top-left scale-110"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor} 0%, #1E40AF 60%, ${accentColor} 100%)`,
                        }}
                      />
                      <div
                        className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-35 blur-xl pointer-events-none"
                        style={{ backgroundColor: accentColor }}
                      />

                      {/* School Name & Crest Header */}
                      <div className="relative z-10 p-3 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2 min-w-0">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt=""
                              className="w-7 h-7 rounded-full object-contain bg-white/90 p-0.5 shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white text-slate-900 flex items-center justify-center text-xs font-black shrink-0">
                              {schoolName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider truncate text-white leading-tight drop-shadow-xs">
                              {schoolName}
                            </p>
                            <p className="text-[8px] font-mono tracking-widest uppercase text-white/80">
                              {isStaff ? 'STAFF / FACULTY' : 'STUDENT BADGE'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Circular Portrait with Concentric Dual-Color Rings */}
                    <div className="relative -mt-14 flex justify-center z-20">
                      <div
                        className="w-[96px] h-[96px] rounded-full p-1 shadow-xl bg-white"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                        }}
                      >
                        <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 border-2 border-white">
                          {card.photoUrl ? (
                            <img
                              src={card.photoUrl}
                              alt={card.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                              <User className="w-10 h-10 stroke-1 text-slate-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Member Name & Role Heading */}
                    <div className="text-center px-4 pt-1 z-10">
                      <h3 className="font-black text-sm uppercase tracking-tight text-slate-900 truncate">
                        {card.name}
                      </h3>
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate"
                        style={{ color: primaryColor }}
                      >
                        {card.subtitle}
                      </p>
                    </div>

                    {/* Structured Key-Value Information Grid */}
                    <div className="px-5 py-2 space-y-1 text-[10px] text-slate-600 font-medium">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-0.5">
                        <span className="text-slate-400 uppercase text-[9px] font-bold">
                          {isStaff ? 'ID No.' : 'Adm No.'}
                        </span>
                        <span className="font-mono font-black text-slate-900">{card.identifier}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-0.5">
                        <span className="text-slate-400 uppercase text-[9px] font-bold">Session</span>
                        <span className="text-slate-800 font-semibold">{sessionLabel}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-0.5">
                        <span className="text-slate-400 uppercase text-[9px] font-bold">Blood Group</span>
                        <span className="font-bold text-slate-800">{card.bloodGroup || 'O+'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 uppercase text-[9px] font-bold">Expires</span>
                        <span className="font-mono text-slate-800 font-bold">31/07/2026</span>
                      </div>
                    </div>

                    {/* Bottom Geometric Accent Footer with Lanyard Punch Guide */}
                    <div className="relative h-[28px] overflow-hidden">
                      <div
                        className="absolute inset-0 transform skew-y-6 origin-bottom-right"
                        style={{
                          background: `linear-gradient(90deg, ${primaryColor} 0%, ${accentColor} 100%)`,
                        }}
                      />
                      <div className="relative z-10 flex items-center justify-between px-3 h-full text-[8px] font-bold text-white/90 uppercase tracking-widest">
                        <span>Official ID</span>
                        <span>Front Side</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CARD BACK (Terms, Security & Office Kiosk QR Code) ── */}
                {(cardSide === 'both' || cardSide === 'back') && (
                  <div className="id-card-wrapper w-[235px] h-[365px] bg-white rounded-2xl border border-slate-300 shadow-lg flex flex-col justify-between overflow-hidden relative text-slate-900 font-sans">

                    {/* Top Ribbon Match */}
                    <div className="relative h-[36px] overflow-hidden w-full">
                      <div
                        className="absolute inset-0 transform -skew-y-6 origin-top-left scale-105"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
                        }}
                      />
                      <div className="relative z-10 px-3 h-full flex items-center justify-between text-white text-[8px] font-black uppercase tracking-wider">
                        <span>{schoolName}</span>
                        <span>Badge Back</span>
                      </div>
                    </div>

                    {/* Terms and Conditions Section */}
                    <div className="px-4 py-2 space-y-2">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-1">
                        Terms &amp; Conditions
                      </h4>
                      <ul className="text-[8px] text-slate-600 space-y-1 leading-relaxed list-disc list-inside">
                        <li>This identification card remains the legal property of {schoolName}.</li>
                        <li>It must be presented on demand by authorized school security personnel.</li>
                        <li>
                          {isStaff
                            ? 'Scan the QR badge below at the school office kiosk terminal for daily attendance clock-in/out.'
                            : 'Cardholder is entitled to library access, student transport, and school examination halls.'}
                        </li>
                        <li>If found, kindly return to the administrative office or call official security desk.</li>
                      </ul>
                    </div>

                    {/* Center / Bottom QR Code with Kiosk Scan Guide */}
                    <div className="px-4 py-2 flex flex-col items-center justify-center text-center space-y-1.5">
                      <div className="p-1.5 rounded-xl border border-slate-200 bg-white shadow-sm inline-block">
                        <img
                          src={qrUrl}
                          alt={`QR Code for ${card.identifier}`}
                          className="w-[84px] h-[84px] object-contain"
                        />
                      </div>
                      <p className="text-[8px] font-mono font-bold text-slate-800 tracking-wider">
                        {isStaff ? 'OFFICE KIOSK CLOCK-IN QR' : 'OFFICIAL STUDENT BARCODE'}
                      </p>
                      <p className="text-[7.5px] font-mono text-slate-400">
                        {card.identifier}
                      </p>
                    </div>

                    {/* Contact & Authorized Signature Footer */}
                    <div className="px-4 py-2 border-t border-slate-100 flex items-end justify-between text-[8px]">
                      <div>
                        <p className="text-slate-400 uppercase text-[7px] font-bold">Contact Helpline</p>
                        <p className="font-semibold text-slate-800">{card.phone || '+234 800 000 0000'}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-serif italic text-slate-800 text-[10px] font-bold border-b border-slate-300 pb-0.5">
                          Authorized Sign
                        </div>
                        <p className="text-slate-400 uppercase text-[7px]">Registrar</p>
                      </div>
                    </div>

                    {/* Bottom Matching Geometry */}
                    <div className="relative h-[16px] overflow-hidden">
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(90deg, ${accentColor} 0%, ${primaryColor} 100%)`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </section>
      )}
    </main>
  );
}
