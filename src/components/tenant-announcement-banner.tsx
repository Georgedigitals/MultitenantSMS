'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface ActiveAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success';
  ctaLabel?: string;
  ctaHref?: string;
}

export function TenantAnnouncementBanner({ planName }: { planName?: string }) {
  const [items, setItems] = useState<ActiveAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('dismissed-platform-banners');
      if (saved) setDismissed(JSON.parse(saved));
    } catch {
      // ignore
    }

    fetch(`/api/platform/announcements?plan=${encodeURIComponent(planName || '')}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.announcements)) {
          setItems(data.announcements);
        }
      })
      .catch(() => {});
  }, [planName]);

  const dismiss = (id: string) => {
    const next = { ...dismissed, [id]: true };
    setDismissed(next);
    try {
      sessionStorage.setItem('dismissed-platform-banners', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const visible = items.filter((item) => !dismissed[item.id]);
  if (visible.length === 0) return null;

  return (
    <div className="print:hidden space-y-2 mb-5">
      {visible.map((item) => {
        const Icon =
          item.severity === 'warning'
            ? AlertTriangle
            : item.severity === 'success'
            ? CheckCircle2
            : Info;
        const tone =
          item.severity === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : item.severity === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-white border-[#e4e2dd] text-[#111110]';

        return (
          <div
            key={item.id}
            className={`rounded-lg border px-4 py-3 flex items-start justify-between gap-3 text-xs ${tone}`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
              <div className="min-w-0">
                <span className="font-semibold">{item.title}</span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="opacity-90">{item.message}</span>
                {item.ctaLabel && item.ctaHref && (
                  <a
                    href={item.ctaHref}
                    className="ml-2 font-semibold underline underline-offset-2"
                  >
                    {item.ctaLabel}
                  </a>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="p-0.5 opacity-60 hover:opacity-100 cursor-pointer shrink-0"
              aria-label="Dismiss announcement"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
