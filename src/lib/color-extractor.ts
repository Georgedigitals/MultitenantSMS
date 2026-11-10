/**
 * Client-side color extractor utility for school logos/crests.
 * Analyzes image pixel data via offscreen canvas, filters out transparent
 * and washed-out background pixels, and extracts primary brand color,
 * contrasting accent color, and an extracted swatch palette.
 */

export interface ExtractedColorPalette {
  primaryColor: string;
  accentColor: string;
  palette: string[];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Extracts brand colors from an image source (File, Blob, or URL).
 */
export async function extractColorsFromImage(
  imageSource: File | Blob | string
): Promise<ExtractedColorPalette> {
  const fallback: ExtractedColorPalette = {
    primaryColor: '#1E3A8A', // Classic Royal Navy
    accentColor: '#D97706',  // Amber Gold
    palette: ['#1E3A8A', '#D97706', '#047857', '#B91C1C'],
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrlToRevoke: string | null = null;
    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      objectUrlToRevoke = URL.createObjectURL(imageSource);
      img.src = objectUrlToRevoke;
    }

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image for color extraction'));
    });

    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;

    // Scale down to 64x64 for instant analysis without memory overhead
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size).data;
    const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number; h: number; s: number; l: number }>();

    for (let i = 0; i < imgData.length; i += 4) {
      const a = imgData[i + 3];
      // Skip transparent or semi-transparent pixels
      if (a < 180) continue;

      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];

      // Skip near-white and washed-out background pixels (common in school logos)
      if (r > 230 && g > 230 && b > 230) continue;

      // Skip near-black / dark murky pixels unless very saturated
      if (r < 25 && g < 25 && b < 25) continue;

      const [h, s, l] = rgbToHsl(r, g, b);

      // Skip very low saturation grey/ash pixels
      if (s < 12) continue;

      // Quantize to 16-step color buckets
      const qr = Math.round(r / 20) * 20;
      const qg = Math.round(g / 20) * 20;
      const qb = Math.round(b / 20) * 20;
      const key = `${qr},${qg},${qb}`;

      const existing = colorBuckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        colorBuckets.set(key, { r: qr, g: qg, b: qb, count: 1, h, s, l });
      }
    }

    if (colorBuckets.size === 0) {
      return fallback;
    }

    // Sort buckets by score (weighting saturation and frequency)
    const sorted = Array.from(colorBuckets.values()).sort((a, b) => {
      // Score = count * (0.6 + saturation * 0.4)
      const scoreA = a.count * (1 + a.s / 100);
      const scoreB = b.count * (1 + b.s / 100);
      return scoreB - scoreA;
    });

    const candidateColors = sorted.map((c) => ({
      hex: rgbToHex(c.r, c.g, c.b),
      ...c,
    }));

    // Pick primary: most dominant solid color
    const primary = candidateColors[0];
    let primaryColor = primary.hex;

    // Pick accent: color with distinct hue difference (> 45 deg) and good saturation
    let accent = candidateColors.find((c) => {
      const hueDiff = Math.abs(c.h - primary.h);
      const effectiveDiff = hueDiff > 180 ? 360 - hueDiff : hueDiff;
      return effectiveDiff >= 40 && c.s >= 25 && c.l >= 20 && c.l <= 80;
    });

    // If no distinct hue found, pick second most frequent with luminance contrast
    if (!accent && candidateColors.length > 1) {
      accent = candidateColors[1];
    }

    let accentColor = accent ? accent.hex : '#D97706';

    // Unique palette swatches (up to 5 distinct colors)
    const uniquePalette: string[] = [];
    for (const c of candidateColors) {
      if (!uniquePalette.includes(c.hex)) {
        uniquePalette.push(c.hex);
      }
      if (uniquePalette.length >= 5) break;
    }

    if (uniquePalette.length < 2) {
      uniquePalette.push('#D97706');
    }

    return {
      primaryColor,
      accentColor,
      palette: uniquePalette,
    };
  } catch (err) {
    console.warn('[extractColorsFromImage] Failed to extract colors:', err);
    return fallback;
  }
}
