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
  baseCurrencyCode: string;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  exchangeRate: number;
  autoConvertCurrency: boolean;
  defaultLanguage: string;
  enabledLanguages: string[];
  timezone: string;
}

export const DEFAULT_LOCALIZATION: PlatformLocalizationConfig = {
  baseCurrencyCode: 'NGN',
  currencyCode: 'NGN',
  currencySymbol: '₦',
  locale: 'en-NG',
  exchangeRate: 1,
  autoConvertCurrency: true,
  defaultLanguage: 'en',
  enabledLanguages: ['en', 'fr', 'es', 'pt', 'ar'],
  timezone: 'Africa/Lagos',
};

export function convertAmount(
  amount: number,
  config?: {
    baseCurrencyCode?: string;
    currencyCode?: string;
    exchangeRate?: number;
    autoConvertCurrency?: boolean;
  }
): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (!config) return safeAmount;
  const auto = config.autoConvertCurrency !== false;
  const base = (config.baseCurrencyCode || 'NGN').toUpperCase();
  const target = (config.currencyCode || base).toUpperCase();
  const rate = Number(config.exchangeRate);

  if (!auto || base === target || !Number.isFinite(rate) || rate <= 0) {
    return safeAmount;
  }
  return safeAmount * rate;
}

export function formatMoney(
  amount: number,
  options?: {
    baseCurrencyCode?: string;
    currencyCode?: string;
    currencySymbol?: string;
    locale?: string;
    exchangeRate?: number;
    autoConvertCurrency?: boolean;
    decimals?: number;
  }
): string {
  const converted = convertAmount(amount, options);
  const symbol = options?.currencySymbol || DEFAULT_LOCALIZATION.currencySymbol;
  const locale = options?.locale || DEFAULT_LOCALIZATION.locale;
  // Auto-show 2 decimals for smaller converted foreign amounts unless decimals explicitly specified
  const isConvertedForeign =
    options?.autoConvertCurrency !== false &&
    options?.baseCurrencyCode &&
    options?.currencyCode &&
    options.baseCurrencyCode.toUpperCase() !== options.currencyCode.toUpperCase() &&
    Number(options?.exchangeRate) > 0 &&
    Number(options?.exchangeRate) < 0.1;

  const decimals = options?.decimals !== undefined ? options.decimals : isConvertedForeign ? 2 : 0;

  try {
    const formatted = converted.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${symbol}${formatted}`;
  } catch {
    return `${symbol}${converted.toFixed(decimals)}`;
  }
}
