import React from 'react';
import type { PublicSiteData } from '@/lib/site-content';
import { Award, GraduationCap, Quote, Sparkles } from 'lucide-react';

export function FeaturedStudent({ data }: { data: PublicSiteData }) {
  const student = data.hero.featuredStudent;
  if (!student || !student.name?.trim()) return null;

  const isVanguard = data.templateId === 'vanguard';
  const isHorizon = data.templateId === 'horizon';

  // Section background seamlessly blends into the active template
  const sectionBg = isVanguard
    ? 'bg-[#090D16] border-b border-slate-800/80'
    : isHorizon
    ? 'bg-[#FCFBF7] border-b border-stone-200'
    : 'bg-[#FAF7F0] border-b border-stone-200';

  // Card theme adapts to the template palette
  const cardStyle = isVanguard
    ? 'bg-[#0e1728] border border-cyan-500/30 text-white shadow-2xl shadow-cyan-950/40'
    : isHorizon
    ? 'bg-[#1b2b20] border border-emerald-800/40 text-white shadow-xl'
    : 'bg-[#0F2942] border border-amber-900/30 text-white shadow-xl';

  const accentColor = isVanguard
    ? data.branding.accentColor || '#00F0FF'
    : isHorizon
    ? '#4ade80'
    : data.branding.accentColor || '#C59B27';

  return (
    <section className={`${sectionBg} px-4 py-12 sm:px-6 sm:py-16 lg:px-8`}>
      <div className={`mx-auto max-w-4xl overflow-hidden rounded-3xl ${cardStyle} grid md:grid-cols-12 items-stretch`}>
        {/* Photo Column */}
        <div className="md:col-span-5 relative min-h-64 sm:min-h-80 bg-slate-900/60 overflow-hidden">
          {student.imageUrl ? (
            <img
              src={student.imageUrl}
              alt={student.name}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-slate-400 p-6 text-center">
              <GraduationCap className="h-16 w-16 mb-2 opacity-80" aria-hidden="true" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Student Spotlight</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/20">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Scholar Recognition</span>
          </div>
        </div>

        {/* Content Column */}
        <div className="md:col-span-7 flex flex-col justify-between p-6 sm:p-8 lg:p-10 space-y-5">
          <div>
            <div
              className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: accentColor }}
            >
              <Award className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Student Spotlight of the Term</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              {student.name}
            </h2>

            {student.className && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 text-slate-200 border border-white/10">
                <span>Class / Tier:</span>
                <strong className="text-white">{student.className}</strong>
              </div>
            )}
          </div>

          {student.achievement && (
            <div className="relative p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <Quote className="w-5 h-5 opacity-40 mb-2" style={{ color: accentColor }} />
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                {student.achievement}
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{data.tenant.name}</span>
            <span style={{ color: accentColor }}>★ Honour Roll</span>
          </div>
        </div>
      </div>
    </section>
  );
}
