import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTenantUrl } from '@/lib/tenant-url';
import { ShieldCheck, School, ArrowRight, ScanLine } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CentralStaffAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  // If a specific school slug is provided in searchParams, redirect directly to that tenant's subdomain
  if (slug) {
    redirect(getTenantUrl(slug, '/attendance/staff'));
  }

  // Fetch active institutions
  const tenants = await prisma.tenant.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      slug: true,
      branding: true,
      workStartTime: true,
      lateThresholdTime: true,
    },
    orderBy: { name: 'asc' },
  });

  // If only 1 school exists, redirect immediately to that school's attendance terminal subdomain
  if (tenants.length === 1) {
    redirect(getTenantUrl(tenants[0].slug, '/attendance/staff'));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
              B
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block group-hover:text-blue-400 transition-colors">
                Beacon Education Network
              </span>
              <span className="text-[11px] font-mono text-slate-400 block -mt-0.5">
                Staff Attendance &amp; Terminal Kiosk Gateway
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Platform Home
            </Link>
            <Link
              href="/schools"
              className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-1.5 rounded-xl transition-all shadow-xs"
            >
              Directory
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
            <ScanLine className="w-4 h-4 text-emerald-400" />
            <span>Dedicated School Office Terminal Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Staff Attendance &amp; Clock-In Stations
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Select your institution below to open the dedicated reception kiosk terminal. Staff and tutors can clock in/out using their 4-digit security PIN or scan their ID card QR badge.
          </p>
        </div>

        {/* Schools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tenants.map((t) => {
            const logoUrl = (t.branding as any)?.logoUrl || null;
            const primaryColor = (t.branding as any)?.primaryColor || '#1E3A8A';

            return (
              <Link
                key={t.id}
                href={`/${t.slug}/attendance/staff`}
                className="group p-6 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 transition-all shadow-sm hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3.5 mb-4">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={t.name}
                        className="w-12 h-12 rounded-xl object-contain bg-white p-1 shadow-xs"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {t.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {t.name}
                      </h3>
                      <p className="text-xs text-slate-400">Campus Attendance Terminal</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 font-mono py-2 border-t border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <span>Resumption:</span>
                      <span className="text-slate-200 font-bold">{t.workStartTime || '07:30 AM'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Late After:</span>
                      <span className="text-amber-400 font-bold">{t.lateThresholdTime || '07:45 AM'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                  <span>Open School Terminal</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Beacon Management Systems. Secure Institutional Kiosk Attendance.</p>
      </footer>
    </div>
  );
}

