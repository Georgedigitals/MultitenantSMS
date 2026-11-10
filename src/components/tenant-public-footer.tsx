'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Phone, Mail, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import type { PublicSiteData } from '@/lib/site-content';

interface TenantPublicFooterProps {
  data: PublicSiteData;
}

export function TenantPublicFooter({ data }: TenantPublicFooterProps) {
  const { tenant, branding, contact, hero } = data;
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
    <footer className="bg-slate-950 text-white border-t border-slate-900 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 pb-12 border-b border-slate-900">
          {/* Col 1: School Identity */}
          <div className="lg:col-span-4">
            <Link href={resolveHref('/')} className="flex items-center gap-3 mb-4">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={tenant.name} className="h-10 w-auto object-contain" />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-md shrink-0"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  {tenant.name.charAt(0)}
                </div>
              )}
              <span className="font-extrabold text-xl tracking-tight text-white block">
                {tenant.name}
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed mb-6 font-light max-w-sm">
              {hero.motto || 'Empowering minds, fostering leadership, and cultivating academic and moral excellence.'}
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Accredited Academic Institution</span>
            </div>
          </div>

          {/* Col 2: Quick Multi-Page Links */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>
                <Link href={resolveHref('/')} className="hover:text-white transition-colors">
                  Home Page
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/about')} className="hover:text-white transition-colors">
                  About Our School
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/academics')} className="hover:text-white transition-colors">
                  Curriculum & Levels
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/admissions')} className="hover:text-white transition-colors">
                  Admissions Guide
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/gallery')} className="hover:text-white transition-colors">
                  Campus Photo Gallery
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/contact')} className="hover:text-white transition-colors">
                  Contact & Campus Map
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Student & Parent Portals */}
          <div className="lg:col-span-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold mb-4">
              Portals & Services
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>
                <Link href={resolveHref('/results/check')} className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span>Terminal Result Checker</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/login')} className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span>Staff & Student Login</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/cbt/take')} className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span>Online CBT Examination Hall</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/admissions')} className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span>Online Admission Inquiry</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact Coordinates */}
          <div className="lg:col-span-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold mb-4">
              Campus Info
            </h4>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{contact.address || 'Campus Address, Nigeria'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{contact.phone || '+234 800 000 0000'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{contact.email || `info@${tenant.slug}.edu.ng`}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{contact.officeHours || 'Mon – Fri: 7:30 AM – 4:30 PM'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Sub-bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {currentYear} {tenant.name}. All Rights Reserved.</p>
          <div className="flex items-center gap-6 text-slate-400">
            <Link href={resolveHref('/admissions')} className="hover:text-white transition-colors">
              Admissions
            </Link>
            <Link href={resolveHref('/results/check')} className="hover:text-white transition-colors">
              Check Result
            </Link>
            <Link href={resolveHref('/login')} className="hover:text-white transition-colors">
              Portal Sign In
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
