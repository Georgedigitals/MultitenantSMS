'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import type { PublicSiteData } from '@/lib/site-content';
import { useLanguage } from '@/components/language-provider';

interface TenantPublicFooterProps {
  data: PublicSiteData;
}

export function TenantPublicFooter({ data }: TenantPublicFooterProps) {
  const { tenant, contact, branding, templateId } = data;
  const { t, tp } = useLanguage();
  const currentYear = new Date().getFullYear();
  const pathname = usePathname() || '';

  const isSlugPath = pathname.startsWith(`/${tenant.slug}`);
  const resolveHref = (path: string) => {
    if (isSlugPath) {
      return path === '/' ? `/${tenant.slug}` : `/${tenant.slug}${path}`;
    }
    return path;
  };

  const primary = branding.primaryColor || '#1e3a5f';
  const accent = branding.accentColor || '#c59b43';
  const textOnAccent = branding.textOnAccent || '#FFFFFF';
  const footerBg = `color-mix(in srgb, ${primary} 36%, #0d131d)`;

  const rawWhatsapp = (contact.whatsapp || contact.phone || '').replace(/[^\d]/g, '');
  const whatsappUrl = rawWhatsapp ? `https://wa.me/${rawWhatsapp}` : resolveHref('/contact');

  return (
    <footer className="mt-auto relative text-white/85" style={{ backgroundColor: footerBg }}>
      {/* Horizon subtle top curve */}
      {templateId === 'horizon' && (
        <div aria-hidden="true" className="overflow-hidden leading-none -mt-6 bg-transparent">
          <svg viewBox="0 0 1440 48" className="w-full h-8 sm:h-10 block" preserveAspectRatio="none">
            <path d="M0,32 C360,0 1080,48 1440,16 L1440,48 L0,48 Z" fill={footerBg} />
          </svg>
        </div>
      )}

      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/12 items-start">
          {/* School Brand & Address */}
          <div className="md:col-span-4 space-y-3">
            <Link
              href={resolveHref('/')}
              data-no-translate="true"
              className="tenant-editorial-display block text-[26px] leading-tight text-white hover:opacity-90"
            >
              {tenant.name}
            </Link>
            <p className="text-[13.5px] leading-relaxed text-white/65 max-w-xs">
              {contact.address || `${tenant.name} Campus`}
            </p>
            {contact.officeHours && (
              <p className="text-[12px] text-white/50">{contact.officeHours}</p>
            )}
          </div>

          {/* Contact */}
          <div className="md:col-span-3 space-y-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {tp('Talk to us')}
            </h2>
            <div className="space-y-1.5 text-[13.5px] text-white/85">
              {contact.phone && <p>{contact.phone}</p>}
              {contact.email && <p className="break-all">{contact.email}</p>}
            </div>
          </div>

          {/* Explore */}
          <div className="md:col-span-2 space-y-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {tp('Explore')}
            </h2>
            <ul className="space-y-2 text-[13.5px] text-white/80">
              <li>
                <Link href={resolveHref('/about')} className="hover:text-white transition-colors">
                  {tp('About')}
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/academics')} className="hover:text-white transition-colors">
                  {tp('Academics')}
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/admissions')} className="hover:text-white transition-colors">
                  {tp('Admissions')}
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/news')} className="hover:text-white transition-colors">
                  {tp('News & Events')}
                </Link>
              </li>
              <li>
                <Link href={resolveHref('/gallery')} className="hover:text-white transition-colors">
                  {tp('Gallery')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Portals & WhatsApp CTA */}
          <div className="md:col-span-3 space-y-3 md:text-right flex flex-col md:items-end">
            <a
              href={whatsappUrl}
              target={rawWhatsapp ? '_blank' : undefined}
              rel={rawWhatsapp ? 'noopener noreferrer' : undefined}
              className={`inline-flex items-center justify-center gap-2 px-5 h-10 text-xs font-semibold transition-opacity hover:opacity-90 shadow-xs ${
                templateId === 'heritage' ? 'rounded-md uppercase tracking-wider' : 'rounded-full'
              }`}
              style={{ backgroundColor: accent, color: textOnAccent }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{tp('Chat on WhatsApp')}</span>
            </a>

            <div className="flex flex-wrap gap-4 pt-1 text-[12.5px] text-white/70">
              <Link href={resolveHref('/results/check')} className="hover:text-white transition-colors">
                {tp('Check Results')}
              </Link>
              <Link href={resolveHref('/login')} className="hover:text-white transition-colors">
                {tp('Portal Login')}
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[12px] text-white/55">
          <p>
            © {currentYear} <span data-no-translate="true">{tenant.name}</span>.{' '}
            {t('common.allRightsReserved', 'All rights reserved.')}
          </p>
          <a href="#top" className="hover:text-white transition-colors">
            {tp('Back to top ↑')}
          </a>
        </div>
      </div>
    </footer>
  );
}
