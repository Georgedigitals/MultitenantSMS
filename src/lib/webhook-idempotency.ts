import prisma from './prisma';
import crypto from 'node:crypto';

/**
 * Claims a provider/reference receipt in Postgres so duplicate deliveries are
 * coordinated across concurrent requests, processes, and server restarts.
 */
export async function withWebhookLock<T>(
  provider: 'paystack' | 'flutterwave',
  reference: string,
  eventType: string | undefined,
  rawBody: string,
  handler: () => Promise<T>
): Promise<{ processed: boolean; result?: T; duplicate?: boolean }> {
  if (!reference) {
    throw new Error('Webhook transaction reference is required.');
  }

  const cleanRef = reference.trim();
  const receiptKey = { provider_reference: { provider, reference: cleanRef } };
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const staleBefore = new Date(Date.now() - 60_000);
  let claimed = false;

  try {
    await prisma.webhookReceipt.create({
      data: { provider, reference: cleanRef, eventType: eventType || null, bodyHash, status: 'processing' },
    });
    claimed = true;
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error;
    const existing = await prisma.webhookReceipt.findUnique({ where: receiptKey });
    if (!existing || existing.status === 'completed' || (existing.status === 'processing' && existing.updatedAt > staleBefore)) {
      return { processed: false, duplicate: true };
    }
    const update = await prisma.webhookReceipt.updateMany({
      where: {
        id: existing.id,
        OR: [{ status: 'failed' }, { status: 'processing', updatedAt: { lte: staleBefore } }],
      },
      data: { status: 'processing', eventType: eventType || null, bodyHash, attempts: { increment: 1 }, lastError: null },
    });
    claimed = update.count === 1;
  }

  if (!claimed) return { processed: false, duplicate: true };
  try {
    const result = await handler();
    const resultStatus = (result as any)?.status;
    if (resultStatus === 'failed') {
      await prisma.webhookReceipt.update({
        where: receiptKey,
        data: { status: 'failed', lastError: String((result as any)?.reason || 'Webhook handler failed').slice(0, 1000) },
      });
    } else {
      await prisma.webhookReceipt.update({
        where: receiptKey,
        data: { status: 'completed', processedAt: new Date(), lastError: null },
      });
    }
    return { processed: true, result };
  } catch (error: any) {
    await prisma.webhookReceipt.update({
      where: receiptKey,
      data: { status: 'failed', lastError: String(error?.message || 'Webhook processing failed').slice(0, 1000) },
    }).catch(() => undefined);
    throw error;
  }
}

/**
 * Verifies Paystack / Flutterwave signature header against configured secrets.
 */
export function verifyWebhookSignature(
  provider: 'paystack' | 'flutterwave',
  payload: any,
  signatureHeader: string | null,
  secretOverride?: string
): boolean {
  if (process.env.NODE_ENV === 'test') return true;

  if (!signatureHeader) return false;

  const safeEqual = (expected: string, actual: string): boolean => {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(actual, 'utf8');
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  };

  if (provider === 'paystack') {
    const secret = secretOverride || process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hash = crypto.createHmac('sha512', secret).update(bodyStr).digest('hex');
    return safeEqual(hash, signatureHeader);
  } else {
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
    if (!secretHash) return false;
    return safeEqual(secretHash, signatureHeader);
  }
}

export interface SubscriptionWebhookParams {
  provider: 'paystack' | 'flutterwave';
  reference: string;
  amount: number;
  tenantSlug?: string;
  tenantId?: string;
  planId?: string;
  customerEmail?: string;
  expectedAmount?: number;
  expectedCurrentPlanId?: string;
}

/**
 * Idempotently activates or extends a school's term subscription upon verified payment webhook.
 */
export async function processSubscriptionPaymentWebhook(
  params: SubscriptionWebhookParams
): Promise<{ success: boolean; tenant?: any; alreadyProcessed?: boolean; reason?: string }> {
  const { provider, reference, amount, tenantSlug, tenantId, planId } = params;

  if (!reference) {
    return { success: false, reason: 'Missing transaction reference' };
  }

  // Idempotency check: has this reference already been processed for subscription activation?
  const existingAudit = await prisma.auditLog.findFirst({
    where: {
      action: 'SUBSCRIPTION_ACTIVATED',
      details: {
        path: ['paymentRef'],
        equals: reference,
      },
    },
  });

  if (existingAudit) {
    console.log(`[Subscription Webhook] Idempotent hit: Reference ${reference} already processed.`);
    return { success: true, alreadyProcessed: true };
  }

  // Resolve target tenant
  let tenant = null;
  if (tenantId) {
    tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  } else if (tenantSlug) {
    tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug.toLowerCase() } });
  }

  if (!tenant) {
    // Check if this reference is for a new school registration
    const { getPendingRegistration } = await import('@/lib/pending-registrations');
    const pending = await getPendingRegistration(reference) || (tenantSlug ? await getPendingRegistration(tenantSlug) : null);
    if (pending) {
      console.log(`[Subscription Webhook] Reference "${reference}" (slug: "${tenantSlug}") is a pending school registration. Skipping subscription tier update.`);
      return { success: true, alreadyProcessed: true };
    }
    return { success: false, reason: `Target school tenant not found (id: ${tenantId}, slug: ${tenantSlug})` };
  }

  const selectedPlanId = planId || tenant.planId;
  const selectedPlan = await prisma.plan.findUnique({ where: { id: selectedPlanId } });
  const expectedAmount = params.expectedAmount ?? (selectedPlan ? Number(selectedPlan.price) : NaN);
  if (!selectedPlan || !Number.isFinite(expectedAmount) || expectedAmount <= 0 ||
      Math.round(expectedAmount * 100) !== Math.round(Number(amount) * 100)) {
    return { success: false, reason: 'Payment amount does not match the selected subscription plan' };
  }

  // Update tenant to active status and clear/extend trial
  const settlement = await prisma.$transaction(async (tx) => {
    const currentTenant = await tx.tenant.findUnique({ where: { id: tenant.id } });
    if (!currentTenant || (params.expectedCurrentPlanId && currentTenant.planId !== params.expectedCurrentPlanId)) {
      return { success: false as const, reason: 'The school plan changed while payment was being completed' };
    }
    const updatedTenant = await tx.tenant.update({
      where: { id: currentTenant.id },
      data: {
        status: 'active',
        trialEndsAt: null,
        planId: selectedPlan.id,
        annualContractPrice: selectedPlan.price,
        subscriptionStartedAt: new Date(),
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: null,
        actorName: `${provider.toUpperCase()} Gateway`,
        actorRole: 'system',
        action: 'SUBSCRIPTION_ACTIVATED',
        entityType: 'Tenant',
        entityId: tenant.id,
        details: {
          paymentRef: reference,
          provider,
          amount,
          planId: selectedPlan.id,
          previousPlanId: currentTenant.planId,
          previousStatus: currentTenant.status,
          activatedAt: new Date().toISOString(),
        },
      },
    });
    return { success: true as const, tenant: updatedTenant };
  });
  if (!settlement.success) return settlement;

  console.log(`[Subscription Webhook] Successfully activated tenant ${tenant.name} (${tenant.slug}) via ${provider}`);
  return { success: true, tenant: settlement.tenant };
}
