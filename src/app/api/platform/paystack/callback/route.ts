import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/prisma';
import { processSubscriptionPaymentWebhook, withWebhookLock } from '@/lib/webhook-idempotency';
import { processFeePaymentWebhook } from '@/lib/fees';
import { processPaymentWebhook, createPinBatch, calculateBatchFees, fulfillPinStockSale } from '@/lib/pin';
import { getTenantPaystackSecret } from '@/lib/tenant-payments';
import { getPublicUrl } from '@/lib/public-url';
import { getPlatformPaymentConfig } from '@/lib/payments/platform-gateway';
import { fromMinorUnit, toMinorUnit } from '@/lib/payments/gateway';

function tenantUrl(req: NextRequest, slug: string, path: string) {
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').toLowerCase();
  const local = req.nextUrl.hostname === 'localhost' || req.nextUrl.hostname.endsWith('.localhost');
  const port = local && req.nextUrl.port ? `:${req.nextUrl.port}` : '';
  const host = local ? `${slug}.localhost${port}` : `${slug}.${rootDomain}`;
  const protocol = local ? req.nextUrl.protocol : 'https:';
  return `${protocol}//${host}${path}`;
}

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference') || req.nextUrl.searchParams.get('trxref');
  let paymentIntent: Awaited<ReturnType<typeof prisma.paymentIntent.findUnique>> = null;
  let secret: string | null | undefined;
  const platformPaymentCfg = await getPlatformPaymentConfig();
  const expectedCurrency = platformPaymentCfg.currencyCode;
  try {
    paymentIntent = reference?.startsWith('FEE_') || reference?.startsWith('RPIN_')
      ? await prisma.paymentIntent.findUnique({ where: { reference } })
      : null;
    secret = paymentIntent && ['fee_payment', 'result_pin'].includes(paymentIntent.purpose)
      ? await getTenantPaystackSecret(paymentIntent.tenantId)
      : platformPaymentCfg.paystackSecretKey;
  } catch {
    console.error('[Paystack callback] Could not load payment configuration');
  }
  if (!reference || !secret) {
    return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => null);
    const transaction = result?.data;
    if (!response.ok || !result?.status || transaction?.status !== 'success' ||
        transaction?.reference !== reference || String(transaction?.currency || '').toUpperCase() !== expectedCurrency) {
      return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
    }

    const metadata = transaction.metadata || {};
    if (metadata.type === 'registration') {
      const { getPendingRegistration } = await import('@/lib/pending-registrations');
      const pending = await getPendingRegistration(reference);
      const plan = pending?.planId ? await prisma.plan.findUnique({ where: { id: pending.planId } }) : null;
      const expectedMinor = plan ? toMinorUnit(Number(plan.price), expectedCurrency) : -1;
      if (!pending || !plan || transaction.amount !== expectedMinor || metadata.planId !== plan.id ||
          metadata.slug !== pending.slug ||
          String(transaction.customer?.email || '').toLowerCase() !== pending.adminEmail.toLowerCase()) {
        return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
      }
      return NextResponse.redirect(getPublicUrl(`/checkout/paystack?reference=${encodeURIComponent(reference)}`, req));
    }

    if (metadata.type === 'subscription') {
      const plan = metadata.planId ? await prisma.plan.findUnique({ where: { id: metadata.planId } }) : null;
      const expectedChargeAmount = Number(metadata.chargeAmount ?? plan?.price);
      if (!plan || !Number.isFinite(expectedChargeAmount) || expectedChargeAmount <= 0 ||
          transaction.amount !== toMinorUnit(expectedChargeAmount, expectedCurrency) || !metadata.tenantId || !metadata.slug) {
        return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
      }
      const tenant = await prisma.tenant.findFirst({ where: { id: metadata.tenantId, slug: metadata.slug } });
      if (!tenant) return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
      const settled = await processSubscriptionPaymentWebhook({
        provider: 'paystack', reference, amount: fromMinorUnit(Number(transaction.amount), expectedCurrency), expectedAmount: expectedChargeAmount,
        expectedCurrentPlanId: typeof metadata.currentPlanId === 'string' ? metadata.currentPlanId : undefined,
        tenantId: tenant.id, tenantSlug: tenant.slug, planId: plan.id,
      });
      if (!settled.success) return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
      return NextResponse.redirect(tenantUrl(req, tenant.slug, `/dashboard/subscription?payment=success&ref=${encodeURIComponent(reference)}`));
    }

    if (typeof metadata.tenantId === 'string' && typeof metadata.slug === 'string' && /^[a-z0-9-]{3,63}$/.test(metadata.slug)) {
      const tenant = await prisma.tenant.findFirst({ where: { id: metadata.tenantId, slug: metadata.slug }, select: { id: true, slug: true } });
      if (!tenant) return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));

      // A return can arrive before Paystack's webhook. Settle from the verified
      // server-to-server transaction using the same durable lock and processors.
      const webhookPayload = JSON.stringify({ event: 'charge.success', data: transaction });
      const signature = crypto.createHmac('sha512', secret).update(webhookPayload).digest('hex');
      const settled = await withWebhookLock('paystack', reference, 'charge.success', webhookPayload, async () => {
        if (metadata.type === 'result_pin') {
          if (!paymentIntent || paymentIntent.purpose !== 'result_pin' || paymentIntent.tenantId !== tenant.id ||
              paymentIntent.studentId !== metadata.studentId || paymentIntent.termId !== metadata.termId ||
              Math.round(Number(paymentIntent.amount) * 100) !== Number(transaction.amount)) {
            return { status: 'failed', reason: 'Result PIN payment does not match the school order' };
          }
          const sale = await fulfillPinStockSale({
            reference, tenantId: tenant.id, amountPaid: Number(transaction.amount) / 100,
            metadata: { tenantId: metadata.tenantId, studentId: metadata.studentId, termId: metadata.termId },
          });
          return { status: 'success', pinId: sale.pin.id };
        }
        if (metadata.type === 'fee_payment') {
          if (!paymentIntent || paymentIntent.status !== 'initialized' || paymentIntent.tenantId !== tenant.id ||
              paymentIntent.studentId !== metadata.studentId || paymentIntent.termId !== metadata.termId ||
              Math.round(Number(paymentIntent.amount) * 100) !== Number(transaction.amount) ||
              !metadata.studentId || !metadata.termId) {
            return { status: 'failed', reason: 'Fee payment reference or amount does not match this school order' };
          }
          const student = await prisma.student.findFirst({ where: { id: metadata.studentId, tenantId: tenant.id }, select: { id: true } });
          const term = await prisma.term.findFirst({ where: { id: metadata.termId, session: { tenantId: tenant.id } }, select: { id: true } });
          if (!student || !term) return { status: 'failed', reason: 'Fee payment does not match this school' };
          await processFeePaymentWebhook('paystack', webhookPayload, signature, secret);
          await prisma.paymentIntent.update({ where: { reference }, data: { status: 'succeeded' } });
          return { status: 'success' };
        }
        if (metadata.type === 'pin_purchase') {
          if (!metadata.studentId || !metadata.termId) return { status: 'failed', reason: 'Incomplete PIN purchase details' };
          const student = await prisma.student.findFirst({ where: { id: metadata.studentId, tenantId: tenant.id }, select: { id: true } });
          const term = await prisma.term.findFirst({ where: { id: metadata.termId, session: { tenantId: tenant.id } }, select: { id: true } });
          const expectedPrice = Number(metadata.pricePaid);
          if (!student || !term || !Number.isFinite(expectedPrice) || Math.round(expectedPrice * 100) !== Number(transaction.amount)) {
            return { status: 'failed', reason: 'PIN purchase amount or school details do not match' };
          }
          const result = await processPaymentWebhook('paystack', webhookPayload, signature);
          return result.success ? { status: 'success' } : { status: 'failed', reason: result.reason || 'PIN purchase could not be fulfilled' };
        }
        if (metadata.type === 'pin_batch') {
          const quantity = Number(metadata.quantity);
          const pricePerPin = Number(metadata.pricePerPin);
          const platformFeePercent = Number(metadata.platformFeePercent);
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000 || !Number.isFinite(pricePerPin) || pricePerPin < 100) {
            return { status: 'failed', reason: 'PIN batch order details are invalid' };
          }
          if (!Number.isFinite(platformFeePercent) || platformFeePercent < 0 || platformFeePercent > 100) {
            return { status: 'failed', reason: 'PIN batch platform percentage is invalid' };
          }
          const fee = await calculateBatchFees(tenant.id, quantity, pricePerPin, platformFeePercent);
          if (Math.round(fee.totalPlatformFee * 100) !== Number(transaction.amount) ||
              Math.round(fee.totalPlatformFee * 100) !== Math.round(Number(metadata.platformFee) * 100)) {
            return { status: 'failed', reason: 'PIN batch amount does not match the order' };
          }
          const batch = await createPinBatch({ tenantId: tenant.id, quantity, pricePerPin, platformFeePercent, paymentRef: reference, maxUsesPerPin: 5 });
          return { status: 'success', batchId: batch.batch.id };
        }
        return { status: 'failed', reason: 'Unsupported payment purpose' };
      });
      if (settled.result?.status === 'failed') return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
      if (!settled.processed && !settled.duplicate) return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
      const destination = metadata.type === 'fee_payment'
        ? `/results/check?payment=success&ref=${encodeURIComponent(reference)}`
        : metadata.type === 'result_pin'
          ? `/results/check?payment=pin_success&ref=${encodeURIComponent(reference)}`
        : metadata.type === 'pin_purchase'
          ? `/results/check?payment=pin_success&ref=${encodeURIComponent(reference)}`
          : metadata.type === 'pin_batch'
            ? `/dashboard/results/pins?payment=success&ref=${encodeURIComponent(reference)}`
            : null;
      if (destination) return NextResponse.redirect(tenantUrl(req, tenant.slug, destination));
    }
  } catch (error) {
    console.error('[Paystack callback] Verification or settlement failed');
  }

  return NextResponse.redirect(getPublicUrl('/checkout/paystack?payment=failed', req));
}
