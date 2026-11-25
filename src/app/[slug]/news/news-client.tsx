'use client';

import React, { useState } from 'react';
import { Calendar, Newspaper } from 'lucide-react';

interface NewsItem {
  date: string;
  category: 'Event' | 'News';
  title: string;
  summary?: string;
  imageUrl?: string | null;
}

interface NewsClientProps {
  items: NewsItem[];
  primaryColor: string;
  accentColor: string;
  textOnPrimary?: string;
  cardRadius: string;
  borderClass: string;
  softBandBg: string;
  headingClass: string;
}

export function NewsClient({
  items,
  primaryColor,
  accentColor,
  textOnPrimary = '#FFFFFF',
  cardRadius,
  borderClass,
  softBandBg,
  headingClass,
}: NewsClientProps) {
  const [filter, setFilter] = useState<'All' | 'Event' | 'News'>('All');

  const filtered =
    filter === 'All' ? items : items.filter((item) => item.category === filter);

  return (
    <div className="space-y-8">
      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {(['All', 'Event', 'News'] as const).map((tab) => {
          const active = filter === tab;
          const label = tab === 'All' ? `All (${items.length})` : tab === 'Event' ? 'Events' : 'News';
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className="h-9 px-4 rounded-full text-xs font-semibold transition-colors cursor-pointer border"
              style={
                active
                  ? { backgroundColor: primaryColor, color: textOnPrimary, borderColor: primaryColor }
                  : { backgroundColor: '#FFFFFF', color: '#4c4a43', borderColor: 'rgba(0,0,0,0.12)' }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className={`${cardRadius} bg-white border ${borderClass} p-12 text-center space-y-2`}>
          <p className="text-sm font-semibold text-[#171614]">No {filter.toLowerCase()} announcements yet</p>
          <p className="text-xs text-[#6d685c]">Check back soon for upcoming campus dates and school news.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item, idx) => (
            <article
              key={`${item.title}-${idx}`}
              className={`${cardRadius} bg-white border ${borderClass} overflow-hidden flex flex-col shadow-xs`}
            >
              <div
                className="aspect-[16/10] w-full overflow-hidden flex items-center justify-center relative"
                style={{ backgroundColor: softBandBg }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-6 text-center opacity-70">
                    {item.category === 'Event' ? (
                      <Calendar className="w-6 h-6" style={{ color: primaryColor }} />
                    ) : (
                      <Newspaper className="w-6 h-6" style={{ color: primaryColor }} />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: primaryColor }}>
                      {item.date}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-6 flex-1 flex flex-col space-y-3">
                <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
                  <span
                    className="px-2.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accentColor} 24%, #FFFFFF)`,
                      color: '#171614',
                    }}
                  >
                    {item.category}
                  </span>
                  <span className="text-[#6d685c]">{item.date}</span>
                </div>

                <h2 className={`${headingClass} text-[20px] leading-[1.25] text-[#171614]`}>
                  {item.title}
                </h2>

                {item.summary && (
                  <p className="text-[13.5px] leading-[1.65] text-[#524f47] flex-1">
                    {item.summary}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
