'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PublicSiteData } from '@/lib/site-content';

interface TenantPublicFooterProps {
  data: PublicSiteData;
}

export function TenantPublicFooter({ data }: TenantPublicFooterProps) {
  const { tenant, contact, hero } = data;
  const currentYear = new Date().getFullYear();
  const pathname = usePathname() || '';

  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) {
      return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    }
    return path;
  };

  return (
    <footer className="bg-[#111315] text-[#f4f3f1] mt-auto">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 pt-16 pb-12 sm:pt-24">
        {/* Oversized Editorial School Wordmark */}
        <div className="pb-14 border-b border-white/15">
          <Link
            href={resolveHref('/')}
            className="tenant-editorial-display block text-[44px] sm:text-[72px] lg:text-[96px] leading-[0.95] tracking-[-0.03em] text-white hover:opacity-90 transition-opacity break-words"
          >
            {tenant.name}
          </Link>
          <p className="mt-5 max-w-2xl text-[15px] sm:text-[17px] leading-relaxed text-[#b7b4ad]">
            {hero.motto || 'Cultivating academic clarity, strong character, and lifelong curiosity.'}
          </p>
        </div>

        {/* Structured Link & Campus Contact Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 py-14 border-b border-white/15">
          {/* Campus Contact */}
          <div className="md:col-span-5 space-y-3">
            <h2 className="text-[14px] font-medium text-[#9b9890]">Campus office</h2>
            <p className="text-[16px] leading-relaxed text-white max-w-sm">
              {contact.address || 'School Campus'}
            </p>
            <div className="pt-2 space-y-1.5 text-[15px] text-[#d4d1ca]">
              <p>{contact.phone || '+234 800 000 0000'}</p>
              <p>{contact.email || `info@${tenant.slug}.edu.ng`}</p>
              <p className="text-[14px] text-[#9b9890]">
                {contact.officeHours || 'Monday – Friday, 7:30 AM – 4:30 PM'}
              </p>
            </div>
          </div>

          {/* Explore */}
          <div className="md:col-span-3">
            <h2 className="text-[14px] font-medium text-[#9b9890] mb-4">School</h2>
            <ul className="space-y-3 text-[15px] text-[#e4e2dd]">
              <li>
                <Link href={resolveHref('/')} className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/about')} className="hover:text-white transition-colors">
                  About us
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/academics')} className="hover:text-white transition-colors">
                  Academics
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/admissions')} className="hover:text-white transition-colors">
                  Admissions
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/gallery')} className="hover:text-white transition-colors">
                  Campus gallery
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/contact')} className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Portals */}
          <div className="md:col-span-4">
            <h2 className="text-[14px] font-medium text-[#9b9890] mb-4">Portals &amp; services</h2>
            <ul className="space-y-3 text-[15px] text-[#e4e2dd]">
              <li>
                <Link href={resolveHref('/results/check')} className="hover:text-white transition-colors">
                  Term result checker
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/login')} className="hover:text-white transition-colors">
                  Staff, student &amp; parent login
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/admissions')} className="hover:text-white transition-colors">
                  Admission inquiry
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Row */}
        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[13px] text-[#9b9890]">
          <p>© {currentYear} {tenant.name}. All rights reserved.</p>
          <a href="#top" className="hover:text-white transition-colors">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
