import { prisma } from './prisma';
import { tenantHasFeature } from './features';
import { isBuiltInFeatureKey } from './feature-catalog';

export const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'smtp',
  'status',
  'docs',
  'support',
  'staging',
  'cdn',
  'blog',
  'dashboard',
  'login',
  'results',
  'cbt',
  'check',
  'schools',
  'register',
  'pricing',
  'about',
  'services',
  'forgot-password',
  'reset-password',
]);

/**
 * Checks if a given slug is in the reserved system slugs list (§3.2).
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Validates slug format: lowercase alphanumeric + hyphens, 3–63 chars (§3.2).
 */
export function isValidSlugFormat(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug);
}

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  status: string;
  trialEndsAt?: Date | null;
  lowestClassLevelId: string | null;
  highestClassLevelId: string | null;
  lowestClassLevel?: { id: string; name: string; orderIndex: number } | null;
  highestClassLevel?: { id: string; name: string; orderIndex: number } | null;
  pinPrice?: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  hasOnlinePayment?: boolean;
  blockResultOnFeeBalance?: boolean;
  workStartTime?: string | null;
  lateThresholdTime?: string | null;
  workEndTime?: string | null;
  campusLatitude?: number | null;
  campusLongitude?: number | null;
  campusRadiusMeters?: number | null;
  enableGeofenceAttendance?: boolean;
  plan: {
    id: string;
    name: string;
    code: string;
    studentCeiling: number;
  };
  branding: {
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
    fontHeading: string;
    fontBody: string;
  };
  currentSession: {
    id: string;
    label: string;
    startDate: Date;
    endDate: Date;
    currentTerm: {
      id: string;
      name: string;
      startDate: Date;
      endDate: Date;
    } | null;
  } | null;
  hasFeature: (featureKey: string) => boolean;
}

/** Resolves a normal tenant slug or a DNS-verified custom domain. */
export async function findTenantBySlugOrDomain(identifier: string, select?: any, include?: any): Promise<any> {
  const value = identifier.trim().toLowerCase().replace(/\.$/, '');
  if (!value) return null;
  const query: any = select ? { select } : include ? { include } : {};
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ id: value }, { slug: value }] },
    ...query,
  });
  if (tenant || !value.includes('.')) return tenant;

  const alias = await prisma.domainAlias.findUnique({
    where: { domain: value },
    select: { tenantId: true, verifiedAt: true },
  });
  if (!alias?.verifiedAt) return null;
  if (!(await tenantHasFeature(alias.tenantId, 'custom_domain'))) return null;
  return prisma.tenant.findUnique({ where: { id: alias.tenantId }, ...query });
}

/**
 * Resolves full tenant context by slug or custom domain.
 * Evaluates Plan features and TenantFeatureOverrides (§8).
 */
export async function getTenantContext(identifier: {
  slug?: string;
  domain?: string;
}): Promise<TenantContext | null> {
  let tenant: any = null;

  try {
    if (identifier.slug) {
      tenant = await findTenantBySlugOrDomain(identifier.slug).catch((err) => {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('reach database') || msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('p1001')) {
          throw err;
        }
        return null;
      });
    } else if (identifier.domain) {
      const alias = await prisma.domainAlias.findUnique({
        where: { domain: identifier.domain.toLowerCase() },
      }).catch((err) => {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('reach database') || msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('p1001')) {
          throw err;
        }
        return null;
      });
      if (alias && alias.verifiedAt) {
        const featureEnabled = await tenantHasFeature(alias.tenantId, 'custom_domain');
        if (featureEnabled) {
          tenant = await prisma.tenant.findUnique({
            where: { id: alias.tenantId },
          }).catch((err) => {
            const msg = String(err?.message || '').toLowerCase();
            if (msg.includes('reach database') || msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('p1001')) {
              throw err;
            }
            return null;
          });
        }
      }
    }
    console.log('[getTenantContext]', identifier, 'tenant found:', tenant?.id, tenant?.slug);

    if (!tenant && identifier.slug && !identifier.slug.includes('.') && !isReservedSlug(identifier.slug) && process.env.ALLOW_AUTO_PROVISION_TENANT === 'true') {
      const cleanSlug = identifier.slug.toLowerCase();
      const titleSlug = cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1);
      const name = `${titleSlug} Academy`;

      let defaultPlan = await prisma.plan.findFirst().catch(() => null);
      if (!defaultPlan) {
        defaultPlan = await prisma.plan.create({
          data: {
            id: 'plan_growth',
            name: 'Growth Plan',
            studentCeiling: 500,
            price: 15000.00,
            pinRequired: true,
            platformFeePercent: 10.00,
          },
        }).catch(() => null);
        if (!defaultPlan) {
          defaultPlan = await prisma.plan.findFirst().catch(() => null);
        }
      }

      if (!defaultPlan) {
        console.warn('[getTenantContext] Auto-provision failed: No Plan record available');
        return null;
      }

      const now = new Date();
      const annualContractExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      tenant = await prisma.tenant.create({
        data: {
          slug: cleanSlug,
          name,
          planId: defaultPlan.id,
          annualContractPrice: defaultPlan.price,
          subscriptionStartedAt: now,
          subscriptionExpiresAt: annualContractExpiresAt,
          status: 'active',
          branding: { primaryColor: '#0F172A', accentColor: '#2563EB', fontHeading: 'Inter', fontBody: 'Inter' },
        },
      }).catch((err: any) => {
        console.warn('[auto-provision tenant error]', err?.message || err);
        return null;
      });

      if (tenant) {
        const session = await prisma.academicSession.create({
          data: {
            tenantId: tenant.id,
            label: '2024/2025',
            isCurrent: true,
            startDate: new Date('2024-09-02'),
            endDate: new Date('2025-07-18'),
          },
        }).catch(() => null);

        if (session) {
          await prisma.term.create({
            data: {
              sessionId: session.id,
              name: '1st Term',
              isCurrent: true,
              startDate: new Date('2024-09-02'),
              endDate: new Date('2024-12-13'),
            },
          }).catch(() => null);
        }
      }
    }
  } catch (err: any) {
    console.error('[getTenantContext DEBUG ERROR]', err?.message || err, err?.stack || '');
    return null;
  }

  if (!tenant) {
    return null;
  }

  let lowestClassLevel: any = null;
  let highestClassLevel: any = null;
  let plan: any = null;
  let planFeatures: any[] = [];
  let featureOverrides: any[] = [];
  let currentSessionRecord: any = null;
  let currentTermRecord: any = null;

  try {
    if (tenant.lowestClassLevelId) {
      lowestClassLevel = await prisma.classLevel.findUnique({
        where: { id: tenant.lowestClassLevelId },
      }).catch(() => null);
    }
    if (tenant.highestClassLevelId) {
      highestClassLevel = await prisma.classLevel.findUnique({
        where: { id: tenant.highestClassLevelId },
      }).catch(() => null);
    }
    if (tenant.planId) {
      plan = await prisma.plan.findUnique({
        where: { id: tenant.planId },
      }).catch(() => null);
      planFeatures = await prisma.planFeature.findMany({
        where: { planId: tenant.planId },
      }).catch(() => []);
    }
    featureOverrides = await prisma.tenantFeatureOverride.findMany({
      where: { tenantId: tenant.id },
    }).catch(() => []);

    currentSessionRecord = await prisma.academicSession.findFirst({
      where: { tenantId: tenant.id, isCurrent: true },
    }).catch(() => null);

    if (currentSessionRecord) {
      currentTermRecord = await prisma.term.findFirst({
        where: { sessionId: currentSessionRecord.id, isCurrent: true },
      }).catch(() => null);
    }

    await ensureTenantAcademicDefaults(tenant.id);
  } catch (err: any) {
    console.warn('[getTenantContext] Secondary query error:', err?.message || err);
  }

  const overridesMap = new Map<string, boolean>();
  for (const override of featureOverrides) {
    overridesMap.set(override.featureKey, override.enabled);
  }

  const planDefaultsMap = new Map<string, boolean>();
  for (const pf of planFeatures) {
    planDefaultsMap.set(pf.featureKey, pf.enabledByDefault);
  }

  /**
   * §8.1 Acceptance Criteria:
   * "No feature check anywhere in the codebase hardcodes a plan name.
   * All checks go through tenant.hasFeature(key).
   * Super admin override takes effect immediately without plan change."
   */
  const hasFeature = (key: string): boolean => {
    if (!isBuiltInFeatureKey(key)) return false;
    if (overridesMap.has(key)) {
      return overridesMap.get(key)!;
    }
    return planDefaultsMap.get(key) ?? false;
  };

  const rawBranding = tenant.branding as Record<string, any> | null;
  const branding = {
    primaryColor: rawBranding?.primaryColor || '#0F172A',
    accentColor: rawBranding?.accentColor || '#2563EB',
    logoUrl: rawBranding?.logoUrl || null,
    fontHeading: rawBranding?.fontHeading || 'Inter',
    fontBody: rawBranding?.fontBody || 'Inter',
  };

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    trialEndsAt: tenant.trialEndsAt || null,
    plan: {
      id: plan?.id || tenant.planId || '',
      name: plan?.name || 'Standard',
      code: plan?.code || 'standard',
      studentCeiling: plan?.studentCeiling ?? 0,
    },
    lowestClassLevelId: tenant.lowestClassLevelId,
    highestClassLevelId: tenant.highestClassLevelId,
    lowestClassLevel,
    highestClassLevel,
    pinPrice: Number(tenant.pinPrice ?? 1000),
    bankName: tenant.bankName ?? null,
    bankAccountNumber: tenant.bankAccountNumber ?? null,
    bankAccountName: tenant.bankAccountName ?? null,
    hasOnlinePayment: tenant.hasOnlinePayment ?? true,
    blockResultOnFeeBalance: tenant.blockResultOnFeeBalance ?? true,
    workStartTime: tenant.workStartTime ?? '07:30',
    lateThresholdTime: tenant.lateThresholdTime ?? '08:00',
    workEndTime: tenant.workEndTime ?? '16:00',
    campusLatitude: tenant.campusLatitude ? Number(tenant.campusLatitude) : null,
    campusLongitude: tenant.campusLongitude ? Number(tenant.campusLongitude) : null,
    campusRadiusMeters: tenant.campusRadiusMeters ? Number(tenant.campusRadiusMeters) : 200,
    enableGeofenceAttendance: tenant.enableGeofenceAttendance ?? false,
    branding,
    currentSession: currentSessionRecord
      ? {
        id: currentSessionRecord.id,
        label: currentSessionRecord.label,
        startDate: currentSessionRecord.startDate,
        endDate: currentSessionRecord.endDate,
        currentTerm: currentTermRecord
          ? {
            id: currentTermRecord.id,
            name: currentTermRecord.name,
            startDate: currentTermRecord.startDate,
            endDate: currentTermRecord.endDate,
          }
          : null,
      }
      : null,
    hasFeature,
  };
}

/**
 * Ensures a tenant has standard default assessment components and grading scale bands.
 * Automatically seeds 1st CA (20%), 2nd CA (20%), Exam (60%) and A–F grading scale.
 * Protects against concurrent initialization race conditions and deduplicates existing records.
 */
const defaultInitPromises = new Map<string, Promise<void>>();

export async function ensureTenantAcademicDefaults(tenantId: string): Promise<void> {
  const existing = defaultInitPromises.get(tenantId);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const componentCount = await prisma.assessmentComponent.count({ where: { tenantId } });
      if (componentCount === 0) {
        await prisma.assessmentComponent.createMany({
          data: [
            { tenantId, termId: null, name: '1st CA', maxScore: 20, weightPercent: 20.0, orderIndex: 1 },
            { tenantId, termId: null, name: '2nd CA', maxScore: 20, weightPercent: 20.0, orderIndex: 2 },
            { tenantId, termId: null, name: 'Exam', maxScore: 60, weightPercent: 60.0, orderIndex: 3 },
          ],
        }).catch(() => { });
      }

      const existingScales = await prisma.gradingScale.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      });

      if (existingScales.length === 0) {
        const [lowest, highest] = await Promise.all([
          prisma.classLevel.findFirst({ orderBy: { orderIndex: 'asc' } }),
          prisma.classLevel.findFirst({ orderBy: { orderIndex: 'desc' } }),
        ]);

        if (lowest && highest) {
          await prisma.gradingScale.createMany({
            data: [
              { tenantId, lowestClassLevelId: lowest.id, highestClassLevelId: highest.id, minScore: 70, maxScore: 100, grade: 'A', remark: 'Excellent' },
              { tenantId, lowestClassLevelId: lowest.id, highestClassLevelId: highest.id, minScore: 60, maxScore: 69.99, grade: 'B', remark: 'Very Good' },
              { tenantId, lowestClassLevelId: lowest.id, highestClassLevelId: highest.id, minScore: 50, maxScore: 59.99, grade: 'C', remark: 'Credit' },
              { tenantId, lowestClassLevelId: lowest.id, highestClassLevelId: highest.id, minScore: 40, maxScore: 49.99, grade: 'D', remark: 'Pass' },
              { tenantId, lowestClassLevelId: lowest.id, highestClassLevelId: highest.id, minScore: 0, maxScore: 39.99, grade: 'F', remark: 'Fail' },
            ],
          }).catch(() => { });
        }
      } else {
        // Self-healing: remove duplicate grading scales if concurrent seeding or race conditions occurred
        const seen = new Set<string>();
        const duplicateIds: string[] = [];
        for (const scale of existingScales) {
          const key = `${scale.lowestClassLevelId}_${scale.highestClassLevelId}_${scale.grade.trim()}_${Number(scale.minScore)}_${Number(scale.maxScore)}`;
          if (seen.has(key)) {
            duplicateIds.push(scale.id);
          } else {
            seen.add(key);
          }
        }

        if (duplicateIds.length > 0) {
          await prisma.gradingScale.deleteMany({
            where: { id: { in: duplicateIds } },
          }).catch((err) => {
            console.warn('[ensureTenantAcademicDefaults cleanup error]', err?.message || err);
          });
        }
      }
    } catch (err: any) {
      console.warn('[ensureTenantAcademicDefaults error]', err?.message || err);
    }
  })();

  defaultInitPromises.set(tenantId, promise);
  try {
    await promise;
  } finally {
    defaultInitPromises.delete(tenantId);
  }
}

/**
 * §4.1 Range check:
 * Returns whether a given class level is within the tenant's enabled contiguous range.
 */
export async function isClassLevelWithinTenantRange(
  tenantId: string,
  classLevelId: string
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { lowestClassLevelId: true, highestClassLevelId: true },
  });

  if (!tenant || !tenant.lowestClassLevelId || !tenant.highestClassLevelId) {
    return true; // If unbounded, allow all
  }

  const lowest = await prisma.classLevel.findUnique({ where: { id: tenant.lowestClassLevelId } });
  const highest = await prisma.classLevel.findUnique({ where: { id: tenant.highestClassLevelId } });
  const target = await prisma.classLevel.findUnique({ where: { id: classLevelId } });

  if (!lowest || !highest || !target) return false;

  return target.orderIndex >= lowest.orderIndex && target.orderIndex <= highest.orderIndex;
}
