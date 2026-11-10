import prisma from './prisma';
import { isBuiltInFeatureKey } from './feature-catalog';

/**
 * Single feature resolution helper (§8).
 * Priority (§8.1):
 * 1. Check TenantFeatureOverride table first for tenantId + featureKey.
 * 2. If an override exists, return override.enabled.
 * 3. Otherwise, fall back to checking if feature is enabled on tenant's Plan (PlanFeature).
 * 
 * NO hardcoded plan name checks are permitted anywhere.
 */
export async function tenantHasFeature(tenantId: string, featureKey: string): Promise<boolean> {
  if (!isBuiltInFeatureKey(featureKey)) return false;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      featureOverrides: { where: { featureKey }, select: { enabled: true }, take: 1 },
      plan: { select: { features: { where: { featureKey }, select: { enabledByDefault: true }, take: 1 } } },
    },
  });
  if (!tenant) return false;

  const override = tenant.featureOverrides[0];
  if (override) return override.enabled;
  return tenant.plan.features[0]?.enabledByDefault ?? false;
}

/**
 * Computes resolved feature states for all system features for a tenant.
 */
export async function getTenantFeatureMap(tenantId: string): Promise<{
  planName: string;
  planId: string;
  features: Array<{
    key: string;
    name: string;
    description: string | null;
    enabled: boolean;
    isOverride: boolean;
    enabledByDefault: boolean;
  }>;
}> {
  const [tenant, allFeatures, overrides] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
      },
    }),
    prisma.feature.findMany({
      orderBy: { key: 'asc' },
    }),
    prisma.tenantFeatureOverride.findMany({
      where: { tenantId },
    }),
  ]);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const overrideMap = new Map<string, boolean>();
  for (const o of overrides) {
    overrideMap.set(o.featureKey, o.enabled);
  }

  const planFeatureMap = new Map<string, boolean>();
  for (const pf of tenant.plan.features) {
    planFeatureMap.set(pf.featureKey, pf.enabledByDefault);
  }

  const features = allFeatures.filter((feature) => isBuiltInFeatureKey(feature.key)).map((f: any) => {
    const isOverride = overrideMap.has(f.key);
    const enabledByDefault = planFeatureMap.get(f.key) ?? false;
    const enabled = isOverride ? overrideMap.get(f.key)! : enabledByDefault;

    return {
      key: f.key,
      name: f.name,
      description: f.description,
      enabled,
      isOverride,
      enabledByDefault,
    };
  });

  return {
    planName: tenant.plan.name,
    planId: tenant.planId,
    features,
  };
}

/**
 * Upserts a tenant feature override (Super Admin function).
 */
export async function setTenantFeatureOverride(
  tenantId: string,
  featureKey: string,
  enabled: boolean
) {
  return prisma.tenantFeatureOverride.upsert({
    where: {
      tenantId_featureKey: {
        tenantId,
        featureKey,
      },
    },
    update: {
      enabled,
    },
    create: {
      tenantId,
      featureKey,
      enabled,
    },
  });
}

/**
 * Removes a tenant feature override, reverting tenant to plan default.
 */
export async function removeTenantFeatureOverride(tenantId: string, featureKey: string) {
  return prisma.tenantFeatureOverride.deleteMany({
    where: {
      tenantId,
      featureKey,
    },
  });
}

/**
 * Updates a tenant's subscription plan.
 */
export async function updateTenantPlan(tenantId: string, newPlanId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: newPlanId },
  });
  if (!plan) {
    throw new Error('Plan not found');
  }

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      planId: newPlanId,
      annualContractPrice: plan.price,
      subscriptionStartedAt: new Date(),
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
}
