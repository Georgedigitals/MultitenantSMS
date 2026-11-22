import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withWebhookLock,
  processSubscriptionPaymentWebhook,
} from '@/lib/webhook-idempotency';
import {
  fromMinorUnit,
  verifyStripeWebhookSignature,
} from '@/lib/payments/gateway';
import { getPlatformPaymentConfig } from '@/lib/payments/platform-gateway';
import { getTenantGatewayConfig } from '@/lib/tenant-payments';
import { processFeePaymentWebhook } from '@/lib/fees';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('stripe-signature');
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    if (event?.type !== 'checkout.session.completed') {
      return NextResponse.json({ status: 'ignored', event: event?.type }, { status: 200 });
    }

    const session = event.data?.object || {};
    const reference = session.client_reference_id || session.metadata?.reference || session.id || '';
    const currency = String(session.currency || '').toUpperCase();
    const paidAmount = fromMinorUnit(Number(session.amount_total || 0), currency);
    const metadata = session.metadata || {};

    if (session.payment_status !== 'paid' || !reference) {
      return NextResponse.json({ status: 'ignored', reason: 'Session not paid' }, { status: 200 });
    }

    const cfg = await getPlatformPaymentConfig();
    if (currency !== cfg.currencyCode) {
      return NextResponse.json(
        { status: 'ignored', reason: `Currency mismatch: got ${currency}, expected ${cfg.currencyCode}` },
        { status: 200 }
      );
    }

    // Check if this is a direct-to-school tenant fee payment
    const isTenantFee = metadata.type === 'fee_payment' || reference.startsWith('FEE_');
    let signingSecret = cfg.stripeWebhookSecret;
    if (isTenantFee) {
      const intent = await prisma.paymentIntent.findUnique({ where: { reference } });
      if (!intent) {
        return NextResponse.json({ error: 'Unknown fee payment reference' }, { status: 404 });
      }
      const tenantGateway = await getTenantGatewayConfig(intent.tenantId);
      if (!tenantGateway || tenantGateway.provider !== 'stripe' || !tenantGateway.webhookSecret) {
        return NextResponse.json({ error: 'School Stripe webhook secret is not configured' }, { status: 401 });
      }
      signingSecret = tenantGateway.webhookSecret;
    }

    const isValid = verifyStripeWebhookSignature(rawBody, signature, signingSecret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Stripe webhook signature' }, { status: 401 });
    }

    // Durable idempotency lock prevents duplicate settlement across retries
    const lockResult = await withWebhookLock('stripe', reference, event.type, rawBody, async () => {
      if (isTenantFee) {
        const payment = await processFeePaymentWebhook('stripe', rawBody, signature || '', signingSecret);
        return { status: 'success', paymentId: payment.id };
      }

      if (metadata.type === 'subscription' || metadata.tenantId) {
        const expectedAmount = Number(metadata.chargeAmount || paidAmount);
        const subResult = await processSubscriptionPaymentWebhook({
          provider: 'stripe',
          reference,
          amount: paidAmount,
          expectedAmount,
          expectedCurrentPlanId: metadata.currentPlanId || undefined,
          tenantId: metadata.tenantId,
          tenantSlug: metadata.slug,
          planId: metadata.planId,
          customerEmail: session.customer_email || metadata.adminEmail,
        });
        if (!subResult.success && !subResult.alreadyProcessed) {
          return { status: 'failed', reason: subResult.reason };
        }
        return { status: 'success', subscriptionActive: true };
      }

      return { status: 'success', registration: true, reference };
    });

    if (lockResult.duplicate) {
      return NextResponse.json(
        { status: 'ignored', reason: 'Concurrent Stripe webhook already processed' },
        { status: 200 }
      );
    }

    if ((lockResult.result as any)?.status === 'failed') {
      return NextResponse.json(lockResult.result, { status: 500 });
    }

    return NextResponse.json(lockResult.result || { status: 'success' }, { status: 200 });
  } catch (err: any) {
    console.error('[Stripe Webhook Error]', err);
    return NextResponse.json({ error: err?.message || 'Webhook error' }, { status: 400 });
  }
}
