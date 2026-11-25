export type TenantTemplateId = 'heritage' | 'vanguard' | 'horizon';

export interface TemplateThemeTokens {
  canvasBg: string;
  softBandBg: string;
  deepBandBg: string;
  cardRadius: string;
  buttonRadius: string;
  headingClass: string;
  eyebrowColor: string;
  borderClass: string;
}

/**
 * Shared visual tokens so all 6 tenant public pages (Home + About, Academics,
 * Admissions, Gallery, Contact) stay cohesive with the chosen template and
 * logo-extracted school colors.
 */
export function getTemplateThemeTokens(
  templateId: TenantTemplateId,
  primary: string,
  accent: string
): TemplateThemeTokens {
  if (templateId === 'horizon') {
    return {
      canvasBg: '#FAF9F5',
      softBandBg: `color-mix(in srgb, ${primary} 10%, #FAF9F5)`,
      deepBandBg: `color-mix(in srgb, ${primary} 85%, #0a1f1c)`,
      cardRadius: 'rounded-[22px]',
      buttonRadius: 'rounded-full',
      headingClass: 'font-bold tracking-[-0.025em]',
      eyebrowColor: primary,
      borderClass: 'border-[#ece9e0]',
    };
  }

  if (templateId === 'vanguard') {
    return {
      canvasBg: '#FBF8F1',
      softBandBg: `color-mix(in srgb, ${primary} 9%, #FBF8F1)`,
      deepBandBg: `color-mix(in srgb, ${primary} 78%, #1e120d)`,
      cardRadius: 'rounded-[26px]',
      buttonRadius: 'rounded-full',
      headingClass: 'tenant-editorial-display',
      eyebrowColor: primary,
      borderClass: 'border-[#EFEADB]',
    };
  }

  // Default: heritage
  return {
    canvasBg: '#F8F5EE',
    softBandBg: `color-mix(in srgb, ${accent} 10%, #F8F5EE)`,
    deepBandBg: `color-mix(in srgb, ${primary} 80%, #0d1626)`,
    cardRadius: 'rounded-[4px]',
    buttonRadius: 'rounded-[3px]',
    headingClass: 'tenant-editorial-display',
    eyebrowColor: `color-mix(in srgb, ${accent} 78%, #6e5a30)`,
    borderClass: 'border-[#E5DEC9]',
  };
}
