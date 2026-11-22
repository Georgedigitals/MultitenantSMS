import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processPaymentWebhook, fulfillPinStockSale } from '@/lib/pin';
import { processFeePaymentWebhook } from '@/lib/fees';
import {
  withWebhookLock,
  verifyWebhookSignature,
  processSubscriptionPaymentWebhook,
} from '@/lib/webhook-idempotency';
import { getTenantPaystackSecret } from '@/lib/tenant-payments';
import { getPlatformPaymentConfig } from '@/lib/payments/platform-gateway';
import { toMinorUnit } from '@/lib/payments/gateway';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-paystack-signature');
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    const data = payload?.data || {};
    const ref = data.reference || payload?.reference || '';
    const metadata = data.metadata || {};
    const type = metadata.type;

    const platformPaymentCfg = await getPlatformPaymentConfig();
    const expectedCurrency = platformPaymentCfg.currencyCode;
    const paidCurrency = String(data?.currency || '').toUpperCase();

    if (payload?.event !== 'charge.success' || data?.status !== 'success' || !ref || paidCurrency !== expectedCurrency) {
      return NextResponse.json({ status: 'ignored', reason: `Only successful ${expectedCurrency} Paystack charges are processed` }, { status: 200 });
    }

    // Verify webhook signature in production
    const paymentIntent = ['fee_payment', 'result_pin'].includes(type) || ref.startsWith('RPIN_')
      ? await prisma.paymentIntent.findUnique({ where: { reference: ref } })
      : null;
    const tenantPaymentSecret = paymentIntent && ['fee_payment', 'result_pin'].includes(paymentIntent.purpose)
      ? await getTenantPaystackSecret(paymentIntent.tenantId)
      : undefined;
    const isTenantPayment = Boolean(paymentIntent && ['fee_payment', 'result_pin'].includes(paymentIntent.purpose));
    const isValid = isTenantPayment
      ? Boolean(tenantPaymentSecret && verifyWebhookSignature('paystack', rawBody, signature, tenantPaymentSecret))
      : verifyWebhookSignature('paystack', rawBody, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Paystack webhook signature' }, { status: 401 });
    }

    // Execute with concurrency lock to prevent duplicate processing on retries
    const lockResult = await withWebhookLock('paystack', ref, payload?.event, rawBody, async () => {
      // 0. Tenant PIN Batch Order & Generation
      if (type === 'pin_batch' || ref.startsWith('PIN_BATCH_') || ref.startsWith('PINBATCH_')) {
        const { createPinBatch } = await import('@/lib/pin');
        let tenantId = metadata.tenantId;
        const quantity = Number(metadata.quantity || 50);
        const pricePerPin = Number(metadata.pricePerPin || 1000);
        const platformFeePercent = Number(metadata.platformFeePercent);
        if (!tenantId && metadata.slug) {
          const tenant = await prisma.tenant.findUnique({ where: { slug: metadata.slug } });
          if (tenant) tenantId = tenant.id;
        }
        if (tenantId && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10_000 &&
            Number.isFinite(pricePerPin) && pricePerPin >= 1 && Number.isFinite(platformFeePercent) &&
            platformFeePercent >= 0 && platformFeePercent <= 100 && paidCurrency === expectedCurrency) {
          const { calculateBatchFees } = await import('@/lib/pin');
          const fee = await calculateBatchFees(tenantId, quantity, pricePerPin, platformFeePercent);
          if (toMinorUnit(fee.totalPlatformFee, expectedCurrency) !== Number(data.amount) ||
              toMinorUnit(fee.totalPlatformFee, expectedCurrency) !== toMinorUnit(Number(metadata.platformFee), expectedCurrency)) {
            return { status: 'failed', reason: 'PIN batch payment amount does not match the recorded order' };
          }
          const batchRes = await createPinBatch({
            tenantId,
            quantity,
            pricePerPin,
            platformFeePercent,
            paymentRef: ref,
          });
          return { status: 'success', batchId: batchRes.batch.id };
        }
        return { status: 'failed', reason: 'School tenant could not be determined for PIN batch' };
      }

      // 1. School Registration Payment (New School Onboarding)
      if (type === 'registration' || metadata.type === 'registration') {
        const { getPendingRegistration } = await import('@/lib/pending-registrations');
        const pending = await getPendingRegistration(ref) || (metadata.slug ? await getPendingRegistration(metadata.slug) : null);
        console.log(`[Paystack Webhook] Registration charge.success received for reference ${ref} (slug: ${metadata.slug || pending?.slug || 'unknown'})`);
        return { status: 'success', registration: true };
      }

      // 2. School Subscription / Plan Activation (Existing School Tier Upgrade)
      if (
        (type === 'subscription' || metadata.planId || (ref.startsWith('PSTK_') && !ref.startsWith('PSTK_BATCH_'))) &&
        type !== 'registration' &&
        metadata.type !== 'registration'
      ) {
        const subResult = await processSubscriptionPaymentWebhook({
          provider: 'paystack',
          reference: ref,
          amount: Number(data.amount || 0) / 100, // Paystack kobo to naira
          tenantSlug: metadata.slug,
          tenantId: metadata.tenantId,
          planId: metadata.planId,
          expectedAmount: metadata.chargeAmount === undefined ? undefined : Number(metadata.chargeAmount),
          expectedCurrentPlanId: typeof metadata.currentPlanId === 'string' ? metadata.currentPlanId : undefined,
          customerEmail: data.customer?.email || metadata.adminEmail,
        });

        if (!subResult.success && !subResult.alreadyProcessed) {
          return { status: 'failed', reason: subResult.reason };
        }
        return { status: 'success', subscriptionActive: true };
      }

      // 2. Student School Fees Payment
      if (type === 'result_pin') {
        if (!paymentIntent || paymentIntent.purpose !== 'result_pin' || paymentIntent.status !== 'initialized' ||
            paymentIntent.tenantId !== metadata.tenantId || paymentIntent.studentId !== metadata.studentId ||
            paymentIntent.termId !== metadata.termId || Math.round(Number(paymentIntent.amount) * 100) !== Number(data.amount)) {
          return { status: 'failed', reason: 'Result PIN reference or amount does not match the school order' };
        }
        const sale = await fulfillPinStockSale({
          reference: ref, tenantId: paymentIntent.tenantId, amountPaid: Number(data.amount) / 100,
          metadata: { tenantId: metadata.tenantId, studentId: metadata.studentId, termId: metadata.termId },
        });
        return { status: 'success', pinId: sale.pin.id };
      }

      if (type === 'fee_payment' || ref.startsWith('FEE-TX-')) {
        if (!paymentIntent || paymentIntent.purpose !== 'fee_payment' || paymentIntent.tenantId !== metadata.tenantId ||
            paymentIntent.studentId !== metadata.studentId || paymentIntent.termId !== metadata.termId ||
            !['initialized', 'succeeded'].includes(paymentIntent.status) ||
            Math.round(Number(paymentIntent.amount) * 100) !== Number(data.amount)) {
          return { status: 'failed', reason: 'Fee payment reference or amount does not match the school order' };
        }
        const payment = await processFeePaymentWebhook('paystack', rawBody, signature || '', tenantPaymentSecret || undefined);
        await prisma.paymentIntent.update({ where: { reference: ref }, data: { status: 'succeeded' } });
        return { status: 'success', paymentId: payment.id };
      }

      // 3. Result PIN Purchase
      const pinResult = await processPaymentWebhook('paystack', rawBody, signature);
      if (!pinResult.success) {
        return { status: 'ignored', reason: pinResult.reason };
      }
      return { status: 'success', pinId: pinResult.pin?.id };
    });

    if (lockResult.duplicate) {
      return NextResponse.json(
        { status: 'ignored', reason: 'Concurrent webhook delivery already in flight' },
        { status: 200 }
      );
    }

    if ((lockResult.result as any)?.status === 'failed') {
      return NextResponse.json(lockResult.result, { status: 500 });
    }

    return NextResponse.json(lockResult.result || { status: 'success' }, { status: 200 });
  } catch (err: any) {
    console.error('[Paystack Webhook Error]', err);
    return NextResponse.json({ error: err.message || 'Webhook error' }, { status: 400 });
  }
}
