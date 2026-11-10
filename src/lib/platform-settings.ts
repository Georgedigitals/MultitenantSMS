import prisma from '@/lib/prisma';

export const DEFAULT_TRIAL_DAYS = 14;

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

export async function getPlatformPinSettings(): Promise<{ feePercent: number; maxUses: number }> {
  const [feeSetting, maxUsesSetting] = await Promise.all([
    prisma.platformSetting.findUnique({ where: { key: 'defaultPinFeePercent' } }),
    prisma.platformSetting.findUnique({ where: { key: 'defaultPinMaxUses' } }),
  ]);
  const feePercent = feeSetting ? Number(feeSetting.value) : 5.0;
  const maxUses = maxUsesSetting ? Number(maxUsesSetting.value) : 5;
  return {
    feePercent: !isNaN(feePercent) ? feePercent : 5.0,
    maxUses: Number.isInteger(maxUses) ? maxUses : 5,
  };
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
