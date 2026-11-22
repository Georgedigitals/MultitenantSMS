import React from 'react';
import type { PublicSiteData } from '@/lib/site-content';

export function FeaturedStudent({ data }: { data: PublicSiteData }) {
  const student = data.hero.featuredStudent;
  if (!student || !student.name?.trim()) return null;

  const isVanguard = data.templateId === 'vanguard';
  const primary = data.branding.primaryColor || '#141414';
  const textOnPrimary = data.branding.textOnPrimary || '#ffffff';

  return (
    <section
      className="w-full"
      style={{
        backgroundColor: isVanguard ? '#191d24' : primary,
        color: isVanguard ? '#ffffff' : textOnPrimary,
      }}
    >
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-16 sm:py-24 grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Square-Cropped Scholar Portrait */}
        <div className="md:col-span-5">
          <div className="aspect-[4/5] w-full overflow-hidden bg-black/20">
            {student.imageUrl ? (
              <img
                src={student.imageUrl}
                alt={student.name}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center p-8 text-center">
                <span className="tenant-editorial-display text-3xl opacity-80">
                  {student.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Scholar Editorial Story */}
        <div className="md:col-span-7 space-y-6">
          <p className="text-[14px] font-medium opacity-75">
            Student spotlight · {data.tenant.name}
          </p>

          <h2 className="tenant-editorial-display text-[40px] sm:text-[56px] leading-[1.0] tracking-[-0.025em]">
            {student.name}
          </h2>

          {student.className && (
            <p className="text-[16px] font-medium opacity-85">
              {student.className}
            </p>
          )}

          {student.achievement && (
            <blockquote className="pt-2 text-[18px] sm:text-[22px] leading-[1.5] opacity-95 max-w-[44ch]">
              “{student.achievement}”
            </blockquote>
          )}
        </div>
      </div>
    </section>
  );
}
