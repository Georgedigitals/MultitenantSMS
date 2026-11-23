import prisma from '@/lib/prisma';
import {
  DEFAULT_LOCALIZATION,
  type PlatformLocalizationConfig,
} from '@/lib/i18n/currency';
import { isSupportedLanguage } from '@/lib/i18n/dictionaries';

export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || 'School Platform';
export const DEFAULT_PLATFORM_TAGLINE = 'Multi-Tenant School Management Platform';

export async function getPlatformName(): Promise<string> {
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { key: 'platformName' } });
    const value = setting?.value?.trim();
    return value || DEFAULT_PLATFORM_NAME;
  } catch {
    return DEFAULT_PLATFORM_NAME;
  }
}

export async function getPlatformBranding(): Promise<{ name: string; tagline: string }> {
  try {
    const [nameSetting, taglineSetting] = await Promise.all([
      prisma.platformSetting.findUnique({ where: { key: 'platformName' } }),
      prisma.platformSetting.findUnique({ where: { key: 'platformTagline' } }),
    ]);
    return {
      name: nameSetting?.value?.trim() || DEFAULT_PLATFORM_NAME,
      tagline: taglineSetting?.value?.trim() || DEFAULT_PLATFORM_TAGLINE,
    };
  } catch {
    return {
      name: DEFAULT_PLATFORM_NAME,
      tagline: DEFAULT_PLATFORM_TAGLINE,
    };
  }
}

export async function getDefaultTrialDays(): Promise<number> {
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'defaultTrialDays' } });
  const value = Number(setting?.value);
  return Number.isInteger(value) && value >= 1 && value <= 90 ? value : DEFAULT_TRIAL_DAYS;
}

export async function getPlatformSetting(key: string, defaultValue = ''): Promise<string> {
  const setting = await prisma.platformSetting.findUnique({ where: { key } });
  return setting?.value ?? defaultValue;
}

export async function isPublicRegistrationAllowed(): Promise<boolean> {
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'allowPublicRegistration' } });
  return setting ? setting.value === 'true' : true;
}

export async function isMaintenanceModeActive(): Promise<boolean> {
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'maintenanceMode' } });
  return setting ? setting.value === 'true' : false;
}

export async function getPlatformCurrencySymbol(): Promise<string> {
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'defaultCurrencySymbol' } });
  return setting?.value || '₦';
}

export async function getPlatformLocalization(): Promise<PlatformLocalizationConfig> {
  try {
    const keys = [
      'baseCurrencyCode',
      'defaultCurrencyCode',
      'defaultCurrencySymbol',
      'defaultLocale',
      'currencyExchangeRate',
      'autoConvertCurrency',
      'defaultLanguage',
      'enabledLanguages',
      'defaultTimezone',
    ];
    const rows = await prisma.platformSetting.findMany({
      where: { key: { in: keys } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const rawLang = map.get('defaultLanguage') || DEFAULT_LOCALIZATION.defaultLanguage;
    const defaultLanguage = isSupportedLanguage(rawLang) ? rawLang : 'en';

    let enabledLanguages = DEFAULT_LOCALIZATION.enabledLanguages;
    const rawEnabled = map.get('enabledLanguages');
    if (rawEnabled) {
      try {
        const parsed = JSON.parse(rawEnabled);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((c) => typeof c === 'string' && isSupportedLanguage(c));
          if (valid.length > 0) enabledLanguages = valid;
        }
      } catch {
        // fallback to default
      }
    }

    const parsedRate = Number(map.get('currencyExchangeRate'));
    const exchangeRate = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 1;
    const autoConvertCurrency = map.has('autoConvertCurrency')
      ? map.get('autoConvertCurrency') === 'true'
      : true;

    return {
      baseCurrencyCode: map.get('baseCurrencyCode')?.trim().toUpperCase() || DEFAULT_LOCALIZATION.baseCurrencyCode,
      currencyCode: map.get('defaultCurrencyCode')?.trim().toUpperCase() || DEFAULT_LOCALIZATION.currencyCode,
      currencySymbol: map.get('defaultCurrencySymbol')?.trim() || DEFAULT_LOCALIZATION.currencySymbol,
      locale: map.get('defaultLocale')?.trim() || DEFAULT_LOCALIZATION.locale,
      exchangeRate,
      autoConvertCurrency,
      defaultLanguage,
      enabledLanguages,
      timezone: map.get('defaultTimezone')?.trim() || DEFAULT_LOCALIZATION.timezone,
    };
  } catch {
    return DEFAULT_LOCALIZATION;
  }
}

export async function getPlatformPinSettings(): Promise<{
  feePercent: number;
  maxUses: number;
  basePinPrice: number;
  minPinPrice: number;
  allowTenantPinPricing: boolean;
}> {
  try {
    const keys = [
      'defaultPinFeePercent',
      'defaultPinMaxUses',
      'defaultPinBasePrice',
      'minPinPrice',
      'allowTenantPinPricing',
    ];
    const rows = await prisma.platformSetting.findMany({
      where: { key: { in: keys } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const feePercent = map.has('defaultPinFeePercent') ? Number(map.get('defaultPinFeePercent')) : 5.0;
    const maxUses = map.has('defaultPinMaxUses') ? Number(map.get('defaultPinMaxUses')) : 5;
    const basePinPrice = map.has('defaultPinBasePrice') ? Number(map.get('defaultPinBasePrice')) : 1000;
    const minPinPrice = map.has('minPinPrice') ? Number(map.get('minPinPrice')) : 100;
    const allowTenantPinPricing = map.has('allowTenantPinPricing')
      ? map.get('allowTenantPinPricing') === 'true'
      : true;

    return {
      feePercent: Number.isFinite(feePercent) && feePercent >= 0 ? feePercent : 5.0,
      maxUses: Number.isInteger(maxUses) && maxUses >= 1 ? maxUses : 5,
      basePinPrice: Number.isFinite(basePinPrice) && basePinPrice >= 0 ? basePinPrice : 1000,
      minPinPrice: Number.isFinite(minPinPrice) && minPinPrice >= 0 ? minPinPrice : 100,
      allowTenantPinPricing,
    };
  } catch {
    return {
      feePercent: 5.0,
      maxUses: 5,
      basePinPrice: 1000,
      minPinPrice: 100,
      allowTenantPinPricing: true,
    };
  }
}

export async function getPlansForDisplay() {
  const plans = await prisma.plan.findMany({
    include: { features: { include: { feature: true } } },
    orderBy: { price: 'asc' },
  });

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: Number(plan.price),
    studentCeiling: plan.studentCeiling,
    pinRequired: plan.pinRequired,
    platformFeePercent: Number(plan.platformFeePercent),
    features: plan.features.map((feature) => ({
      featureKey: feature.featureKey,
      name: feature.feature?.name || feature.featureKey.replace(/_/g, ' '),
    })),
  }));
}
