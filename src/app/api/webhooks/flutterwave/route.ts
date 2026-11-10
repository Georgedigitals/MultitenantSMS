import { NextRequest, NextResponse } from 'next/server';
import { processPaymentWebhook } from '@/lib/pin';
import { processFeePaymentWebhook } from '@/lib/fees';
import {
  withWebhookLock,
  verifyWebhookSignature,
  processSubscriptionPaymentWebhook,
} from '@/lib/webhook-idempotency';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('verif-hash');
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    const data = payload?.data || {};
    const ref = data.tx_ref || payload?.tx_ref || '';
    const metadata = data.meta || payload?.meta || {};
    const type = metadata.type;

    // Verify webhook signature in production
    const isValid = verifyWebhookSignature('flutterwave', payload, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Flutterwave webhook signature' }, { status: 401 });
    }

    // Execute with concurrency lock to prevent duplicate processing on retries
    const lockResult = await withWebhookLock('flutterwave', ref, payload?.event || type, rawBody, async () => {
      // 1. School Subscription / Plan Activation
      if (type === 'subscription' || metadata.planId || ref.startsWith('FLW_SUB_')) {
        const subResult = await processSubscriptionPaymentWebhook({
          provider: 'flutterwave',
          reference: ref,
          amount: Number(data.amount || 0),
          tenantSlug: metadata.slug,
          tenantId: metadata.tenantId,
          planId: metadata.planId,
          customerEmail: data.customer?.email || metadata.adminEmail,
        });

        if (!subResult.success && !subResult.alreadyProcessed) {
          return { status: 'failed', reason: subResult.reason };
        }
        return { status: 'success', subscriptionActive: true };
      }

      // 2. Student School Fees Payment
      if (type === 'fee_payment' || ref.startsWith('FEE-TX-')) {
        const payment = await processFeePaymentWebhook('flutterwave', rawBody, signature || '');
        return { status: 'success', paymentId: payment.id };
      }

      // 3. Result PIN Purchase
      const pinResult = await processPaymentWebhook('flutterwave', rawBody, signature);
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
    console.error('[Flutterwave Webhook Error]', err);
    return NextResponse.json({ error: err.message || 'Webhook error' }, { status: 400 });
  }
}
