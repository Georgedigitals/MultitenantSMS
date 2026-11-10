import prisma from './prisma';

export interface BrandingConfig {
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  faviconUrl?: string | null;
  fontHeading: string;
  fontBody: string;
  templateId?: 'heritage' | 'vanguard' | 'horizon';
}

export interface BrandingTokensResult {
  tenantId: string;
  tenantName: string;
  slug: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  fontHeading: string;
  fontBody: string;
  templateId: 'heritage' | 'vanguard' | 'horizon';
  textOnPrimary: string;
  textOnAccent: string;
  contrastRatioPrimary: number;
  contrastRatioAccent: number;
  isPrimaryCompliant: boolean;
  isAccentCompliant: boolean;
  cssVariables: Record<string, string>;
}

/**
 * Calculates WCAG 2.1 relative luminance for an RGB value (0-255).
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Converts hex color string (#RRGGBB or #RGB) to RGB array [r, g, b].
 */
export function hexToRgb(hex: string): [number, number, number] {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (cleanHex.length !== 6) {
    return [15, 23, 42]; // Fallback to slate 900
  }
  const num = parseInt(cleanHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calculates contrast ratio between two hex colors per WCAG 2.1 specifications (§7).
 */
export function calculateContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

/**
 * Determines optimal readable text color (white or slate-900) for a background hex color.
 */
export function getOptimalTextColor(bgHex: string): string {
  const whiteRatio = calculateContrastRatio('#FFFFFF', bgHex);
  const darkRatio = calculateContrastRatio('#0F172A', bgHex);
  return whiteRatio >= darkRatio ? '#FFFFFF' : '#0F172A';
}

/**
 * Resolves tenant branding configuration and outputs CSS variable tokens (§7).
 */
export function computeBrandingTokensFromTenant(tenant: any): BrandingTokensResult {
  const defaultBranding: BrandingConfig = {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    logoUrl: null,
    faviconUrl: null,
    fontHeading: 'Inter',
    fontBody: 'Inter',
    templateId: 'heritage',
  };

  const rawBranding = (tenant.branding as any) || {};
  const branding: BrandingConfig = {
    primaryColor: rawBranding.primaryColor || defaultBranding.primaryColor,
    accentColor: rawBranding.accentColor || defaultBranding.accentColor,
    logoUrl: rawBranding.logoUrl || defaultBranding.logoUrl,
    faviconUrl: rawBranding.faviconUrl || defaultBranding.faviconUrl,
    fontHeading: rawBranding.fontHeading || defaultBranding.fontHeading,
    fontBody: rawBranding.fontBody || defaultBranding.fontBody,
    templateId: rawBranding.templateId || defaultBranding.templateId,
  };

  const textOnPrimary = getOptimalTextColor(branding.primaryColor);
  const textOnAccent = getOptimalTextColor(branding.accentColor);

  const contrastRatioPrimary = calculateContrastRatio(textOnPrimary, branding.primaryColor);
  const contrastRatioAccent = calculateContrastRatio(textOnAccent, branding.accentColor);

  const isPrimaryCompliant = contrastRatioPrimary >= 4.5;
  const isAccentCompliant = contrastRatioAccent >= 4.5;

  const cssVariables: Record<string, string> = {
    '--brand-primary': branding.primaryColor,
    '--brand-accent': branding.accentColor,
    '--brand-text-on-primary': textOnPrimary,
    '--brand-text-on-accent': textOnAccent,
    '--brand-font-heading': branding.fontHeading,
    '--brand-font-body': branding.fontBody,
  };

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    slug: tenant.slug,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    logoUrl: branding.logoUrl || null,
    faviconUrl: branding.faviconUrl || null,
    fontHeading: branding.fontHeading,
    fontBody: branding.fontBody,
    templateId: (branding.templateId as any) || 'heritage',
    textOnPrimary,
    textOnAccent,
    contrastRatioPrimary,
    contrastRatioAccent,
    isPrimaryCompliant,
    isAccentCompliant,
    cssVariables,
  };
}

export async function getTenantBrandingTokens(tenantIdOrSlug: string): Promise<BrandingTokensResult> {
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ id: tenantIdOrSlug }, { slug: tenantIdOrSlug }],
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  return computeBrandingTokensFromTenant(tenant);
}

/**
 * Updates tenant branding configuration (§7).
 */
export async function updateTenantBranding(
  tenantId: string,
  brandingData: Partial<BrandingConfig>
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const currentBranding = (tenant.branding as any) || {};
  const updatedBranding = {
    ...currentBranding,
    ...brandingData,
  };

  if (brandingData.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(brandingData.primaryColor)) {
    throw new Error('Invalid primary hex color format (e.g. #0F172A)');
  }

  if (brandingData.accentColor && !/^#[0-9A-Fa-f]{6}$/.test(brandingData.accentColor)) {
    throw new Error('Invalid accent hex color format (e.g. #2563EB)');
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      branding: updatedBranding,
    },
  });

  return getTenantBrandingTokens(tenantId);
}
