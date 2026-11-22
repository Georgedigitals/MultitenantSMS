export interface CurrencyPreset {
  code: string;
  symbol: string;
  locale: string;
  label: string;
}

export const CURRENCY_PRESETS: CurrencyPreset[] = [
  { code: 'NGN', symbol: '₦', locale: 'en-NG', label: 'Nigerian Naira (₦ · NGN)' },
  { code: 'USD', symbol: '$', locale: 'en-US', label: 'US Dollar ($ · USD)' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', label: 'British Pound (£ · GBP)' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', label: 'Euro (€ · EUR)' },
  { code: 'KES', symbol: 'KSh', locale: 'en-KE', label: 'Kenyan Shilling (KSh · KES)' },
  { code: 'GHS', symbol: 'GH₵', locale: 'en-GH', label: 'Ghanaian Cedi (GH₵ · GHS)' },
  { code: 'ZAR', symbol: 'R', locale: 'en-ZA', label: 'South African Rand (R · ZAR)' },
  { code: 'CAD', symbol: 'CA$', locale: 'en-CA', label: 'Canadian Dollar (CA$ · CAD)' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU', label: 'Australian Dollar (A$ · AUD)' },
  { code: 'AED', symbol: 'AED', locale: 'en-AE', label: 'UAE Dirham (AED)' },
  { code: 'INR', symbol: '₹', locale: 'en-IN', label: 'Indian Rupee (₹ · INR)' },
  { code: 'XOF', symbol: 'CFA', locale: 'fr-SN', label: 'West African CFA (CFA · XOF)' },
];

export interface PlatformLocalizationConfig {
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  defaultLanguage: string;
  enabledLanguages: string[];
  timezone: string;
}

export const DEFAULT_LOCALIZATION: PlatformLocalizationConfig = {
  currencyCode: 'NGN',
  currencySymbol: '₦',
  locale: 'en-NG',
  defaultLanguage: 'en',
  enabledLanguages: ['en', 'fr', 'es', 'pt', 'ar'],
  timezone: 'Africa/Lagos',
};

export function formatMoney(
  amount: number,
  options?: {
    currencyCode?: string;
    currencySymbol?: string;
    locale?: string;
    decimals?: number;
  }
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const symbol = options?.currencySymbol || DEFAULT_LOCALIZATION.currencySymbol;
  const locale = options?.locale || DEFAULT_LOCALIZATION.locale;
  const decimals = options?.decimals ?? 0;

  try {
    const formatted = safeAmount.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${symbol}${formatted}`;
  } catch {
    return `${symbol}${safeAmount.toFixed(decimals)}`;
  }
}
