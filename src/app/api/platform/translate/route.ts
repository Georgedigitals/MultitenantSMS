import { NextRequest, NextResponse } from 'next/server';
import { isSupportedLanguage, type SupportedLanguage } from '@/lib/i18n/dictionaries';

// Server-side in-memory translation cache: key = `${targetLang}::${sourceText}`
const SERVER_CACHE = new Map<string, string>();
const MAX_CACHE_ENTRIES = 8000;

function setCache(key: string, value: string) {
  if (SERVER_CACHE.size >= MAX_CACHE_ENTRIES) {
    const firstKey = SERVER_CACHE.keys().next().value;
    if (firstKey) SERVER_CACHE.delete(firstKey);
  }
  SERVER_CACHE.set(key, value);
}

async function translateBatchExternal(
  texts: string[],
  targetLang: Exclude<SupportedLanguage, 'en'>
): Promise<string[]> {
  if (texts.length === 0) return [];

  // Translate in small chunks so URL length stays well under limits
  const results: string[] = [];
  const SEP = '\n[[[S]]]\n';
  let chunk: string[] = [];
  let chunkLen = 0;

  const flushChunk = async (items: string[]) => {
    if (items.length === 0) return;
    const joined = items.join(SEP);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&q=${encodeURIComponent(joined)}`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        results.push(...items);
        return;
      }

      const data = await res.json();
      const translatedJoined = Array.isArray(data?.[0])
        ? data[0].map((seg: any) => (Array.isArray(seg) ? String(seg[0] || '') : '')).join('')
        : '';

      const parts = translatedJoined.split(/\s*\[\[\[S\]\]\]\s*/);
      if (parts.length === items.length) {
        for (let i = 0; i < items.length; i++) {
          results.push((parts[i] || items[i]).trim());
        }
      } else {
        // Fallback: translate individually if separator count drifted
        for (const item of items) {
          try {
            const singleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
              targetLang
            )}&dt=t&q=${encodeURIComponent(item)}`;
            const sRes = await fetch(singleUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              cache: 'no-store',
              signal: AbortSignal.timeout(4000),
            });
            if (sRes.ok) {
              const sData = await sRes.json();
              const out = Array.isArray(sData?.[0])
                ? sData[0].map((seg: any) => (Array.isArray(seg) ? String(seg[0] || '') : '')).join('').trim()
                : item;
              results.push(out || item);
            } else {
              results.push(item);
            }
          } catch {
            results.push(item);
          }
        }
      }
    } catch {
      results.push(...items);
    }
  };

  for (const text of texts) {
    if (chunkLen + text.length > 1400 && chunk.length > 0) {
      await flushChunk(chunk);
      chunk = [];
      chunkLen = 0;
    }
    chunk.push(text);
    chunkLen += text.length + SEP.length;
  }
  await flushChunk(chunk);

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const targetLang = String(body?.targetLang || '').trim().toLowerCase();
    const rawTexts: unknown = body?.texts;

    if (!isSupportedLanguage(targetLang) || targetLang === 'en') {
      return NextResponse.json({ success: true, translations: {} });
    }

    if (!Array.isArray(rawTexts) || rawTexts.length === 0) {
      return NextResponse.json({ success: true, translations: {} });
    }

    const uniqueTexts = Array.from(
      new Set(
        rawTexts
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter((t) => t.length >= 2 && t.length <= 600)
      )
    ).slice(0, 80);

    const translations: Record<string, string> = {};
    const missing: string[] = [];

    for (const text of uniqueTexts) {
      const cacheKey = `${targetLang}::${text}`;
      const hit = SERVER_CACHE.get(cacheKey);
      if (hit) {
        translations[text] = hit;
      } else {
        missing.push(text);
      }
    }

    if (missing.length > 0) {
      const translated = await translateBatchExternal(missing, targetLang);
      for (let i = 0; i < missing.length; i++) {
        const src = missing[i];
        const dst = translated[i] || src;
        translations[src] = dst;
        if (dst !== src) {
          setCache(`${targetLang}::${src}`, dst);
        }
      }
    }

    return NextResponse.json({ success: true, translations });
  } catch {
    return NextResponse.json({ success: true, translations: {} });
  }
}
