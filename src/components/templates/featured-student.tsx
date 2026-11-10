import React from 'react';
import type { PublicSiteData } from '@/lib/site-content';
import { Award, GraduationCap } from 'lucide-react';

export function FeaturedStudent({ data }: { data: PublicSiteData }) {
  const student = data.hero.featuredStudent;
  if (!student) return null;

  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl md:grid-cols-[1fr_1.2fr]">
        <div className="relative min-h-72 bg-slate-800">
          {student.imageUrl ? (
            <img src={student.imageUrl} alt={student.name} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-300">
              <GraduationCap className="h-20 w-20" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: data.branding.accentColor }}>
            <Award className="h-4 w-4" aria-hidden="true" /> Student Spotlight
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{student.name}</h2>
          {student.className && <p className="mt-2 text-sm font-medium text-slate-300">{student.className}</p>}
          {student.achievement && <p className="mt-5 max-w-xl leading-7 text-slate-200">{student.achievement}</p>}
        </div>
      </div>
    </section>
  );
}
