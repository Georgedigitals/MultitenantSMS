import { NextRequest, NextResponse } from 'next/server';

// 6-hour in-memory cache per base currency
const RATE_CACHE = new Map<string, { rates: Record<string, number>; fetchedAt: number }>();
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Approximate fallback rates relative to USD (used only if live API is unreachable)
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  NGN: 1550,
  GBP: 0.79,
  EUR: 0.92,
  KES: 129,
  GHS: 15.5,
  ZAR: 18.2,
  CAD: 1.38,
  AUD: 1.53,
  AED: 3.67,
  INR: 84,
  XOF: 605,
};

function computeFallbackRate(from: string, to: string): number {
  if (from === to) return 1;
  const fromPerUsd = FALLBACK_USD_RATES[from];
  const toPerUsd = FALLBACK_USD_RATES[to];
  if (fromPerUsd && toPerUsd) {
    return Number((toPerUsd / fromPerUsd).toFixed(6));
  }
  return 1;
}

export async function GET(req: NextRequest) {
  const from = (req.nextUrl.searchParams.get('from') || 'NGN').trim().toUpperCase().slice(0, 6);
  const to = (req.nextUrl.searchParams.get('to') || 'USD').trim().toUpperCase().slice(0, 6);

  if (from === to) {
    return NextResponse.json({
      success: true,
      from,
      to,
      rate: 1,
      inverseRate: 1,
      source: 'identity',
    });
  }

  try {
    const cached = RATE_CACHE.get(from);
    if (cached && Date.now() - cached.fetchedAt < SIX_HOURS_MS && cached.rates[to]) {
      const rate = Number(cached.rates[to]);
      return NextResponse.json({
        success: true,
        from,
        to,
        rate,
        inverseRate: rate > 0 ? Number((1 / rate).toFixed(4)) : 1,
        source: 'cache',
      });
    }

    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.result === 'success' && data?.rates && typeof data.rates[to] === 'number') {
        RATE_CACHE.set(from, { rates: data.rates, fetchedAt: Date.now() });
        const rate = Number(data.rates[to]);
        return NextResponse.json({
          success: true,
          from,
          to,
          rate,
          inverseRate: rate > 0 ? Number((1 / rate).toFixed(4)) : 1,
          source: 'live',
        });
      }
    }
  } catch {
    // fall through to offline fallback
  }

  const fallback = computeFallbackRate(from, to);
  return NextResponse.json({
    success: true,
    from,
    to,
    rate: fallback,
    inverseRate: fallback > 0 ? Number((1 / fallback).toFixed(4)) : 1,
    source: 'fallback',
  });
}
