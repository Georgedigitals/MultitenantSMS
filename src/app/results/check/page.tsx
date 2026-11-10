import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTenantUrl } from '@/lib/tenant-url';
import CentralResultCheckerClient from './central-result-checker-client';

export const dynamic = 'force-dynamic';

export default async function CentralResultCheckerPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; studentId?: string; termId?: string }>;
}) {
  const { slug, studentId, termId } = await searchParams;

  // If a specific school slug is passed in query, redirect directly to that school's subdomain
  if (slug) {
    const query = new URLSearchParams();
    if (studentId) query.set('studentId', studentId);
    if (termId) query.set('termId', termId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    redirect(getTenantUrl(slug, `/results/check${queryString}`));
  }

  // Fetch registered active schools
  const tenants = await prisma.tenant.findMany({
    where: {
      status: 'active',
    },
    select: {
      id: true,
      name: true,
      slug: true,
      branding: true,
      pinPrice: true,
      hasOnlinePayment: true,
    },
    orderBy: { name: 'asc' },
  });

  // If only 1 school exists, redirect to its subdomain immediately
  if (tenants.length === 1) {
    const single = tenants[0];
    const query = new URLSearchParams();
    if (studentId) query.set('studentId', studentId);
    if (termId) query.set('termId', termId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    redirect(getTenantUrl(single.slug, `/results/check${queryString}`));
  }

  const schools = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    state: 'Nigeria',
    city: 'Campus',
    logoUrl: (t.branding as any)?.logoUrl || null,
    primaryColor: (t.branding as any)?.primaryColor || '#1E3A8A',
    pinPrice: Number(t.pinPrice || 1000),
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
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
                Central Result Verification Gateway
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
              Browse All Schools
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <CentralResultCheckerClient
          schools={schools}
          initialStudentId={studentId || ''}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Beacon Management Systems. Cryptographically Secured Result Verification.</p>
      </footer>
    </div>
  );
}

