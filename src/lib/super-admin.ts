import prisma from './prisma';
import { TenantStatus } from '@prisma/client';

export interface StartImpersonationInput {
  superAdminId: string;
  tenantId: string;
  reason: string;
}

export interface PlatformFinancialOverview {
  platformRevenue: {
    subscriptionRevenue: number;
    pinRevenue: number;
    totalPlatformRevenue: number;
  };
  tenantFinancials: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    planName: string;
    planPrice: number;
    annualContractPrice: number;
    subscriptionExpiresAt: string | null;
    status: string;
    pinSalesCount: number;
    pinRevenueAmount: number;
  }>;
}

/**
 * Starts an impersonation session with mandatory reason logging (§9, §9.1).
 */
export async function startImpersonation(input: StartImpersonationInput) {
  const { superAdminId, tenantId, reason } = input;

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error('A non-empty reason is required before impersonation can start');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, status: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const log = await prisma.impersonationLog.create({
    data: {
      superAdminId,
      tenantId,
      reason: reason.trim(),
      startedAt: new Date(),
    },
  });

  return {
    logId: log.id,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
  };
}

/**
 * Ends an active impersonation session (§9).
 */
export async function endImpersonation(logId: string) {
  if (!logId) return;

  return prisma.impersonationLog.updateMany({
    where: { id: logId, endedAt: null },
    data: {
      endedAt: new Date(),
    },
  });
}

/**
 * Reports platform income only. Tenant school-fee transactions remain private to each school.
 */
export async function getPlatformFinancialOverview(): Promise<PlatformFinancialOverview> {
  const tenants = await prisma.tenant.findMany({
    include: { plan: true },
  });
  const resultPins = await prisma.resultPIN.findMany({
    include: { student: { select: { tenantId: true } } },
  });
  const pinBatches = await prisma.pinBatch.findMany();

  // 1. Subscription Revenue (sum of active paid tenant contracted annual prices)
  let subscriptionRevenue = 0;
  for (const t of tenants) {
    if (t.status === 'active') {
      const contractedAmount = Number(t.annualContractPrice ?? t.plan.price);
      subscriptionRevenue += contractedAmount;
    }
  }

  // 2. Platform PIN revenue is the platform's share, not the full value
  // collected from families. The school share is tracked separately on each PIN.
  let pinRevenue = 0;
  const pinCountMap = new Map<string, { count: number; total: number }>();

  for (const p of resultPins) {
    const amount = Number(p.platformFee);
    pinRevenue += amount;

    const tenantId = p.student.tenantId;
    const existing = pinCountMap.get(tenantId) || { count: 0, total: 0 };
    pinCountMap.set(tenantId, {
      count: existing.count + 1,
      total: existing.total + amount,
    });
  }

  for (const b of pinBatches) {
    const feeAmount = Number(b.platformFeeTotal || 0);
    pinRevenue += feeAmount;

    const existing = pinCountMap.get(b.tenantId) || { count: 0, total: 0 };
    pinCountMap.set(b.tenantId, {
      count: existing.count + (b.quantity || 0),
      total: existing.total + feeAmount,
    });
  }

  const tenantFinancials = [];

  for (const t of tenants) {
    const pinData = pinCountMap.get(t.id) || { count: 0, total: 0 };
    const contractedPrice = Number(t.annualContractPrice ?? t.plan.price);

    tenantFinancials.push({
      tenantId: t.id,
      tenantName: t.name,
      tenantSlug: t.slug,
      planName: t.plan.name,
      planPrice: Number(t.plan.price),
      annualContractPrice: contractedPrice,
      subscriptionExpiresAt: t.subscriptionExpiresAt ? t.subscriptionExpiresAt.toISOString() : null,
      status: t.status,
      pinSalesCount: pinData.count,
      pinRevenueAmount: pinData.total,
    });
  }

  return {
    platformRevenue: {
      subscriptionRevenue,
      pinRevenue,
      totalPlatformRevenue: subscriptionRevenue + pinRevenue,
    },
    tenantFinancials,
  };
}

/**
 * Updates a tenant's operational status (§9).
 */
export async function updateTenantStatus(tenantId: string, status: TenantStatus) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status,
      archivedAt: status === 'archived' ? new Date() : null,
    },
  });
}
