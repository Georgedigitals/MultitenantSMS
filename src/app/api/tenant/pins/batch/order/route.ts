import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { calculateBatchFees } from '@/lib/pin';
import { randomUUID } from 'node:crypto';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = req.headers.get('x-tenant-slug') || searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    const userRole = (auth as any)?.user?.role || (auth as any)?.role;
    if (!auth || userRole !== 'school_admin') {
      return NextResponse.json({ error: 'Only school administrators can generate PIN batches' }, { status: 403 });
    }

    const body = await req.json();
    const quantity = Number(body.quantity);
    const pricePerPin = Number(body.pricePerPin);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000 ||
        !Number.isFinite(pricePerPin) || pricePerPin < 100 || pricePerPin > 1_000_000) {
      return NextResponse.json({ error: 'Choose 1–10,000 PINs and a unit price between ₦100 and ₦1,000,000.' }, { status: 400 });
    }

    const feeCalc = await calculateBatchFees(tenant.id, quantity, pricePerPin);
    const reference = `PINBATCH_${randomUUID().replace(/-/g, '')}`;
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const rawUsername = auth.user?.username || '';
    const adminEmail = (auth.user as any)?.email
      || (rawUsername.includes('@') ? rawUsername : (rawUsername ? `${rawUsername}@${tenant.slug}.school` : 'admin@school.com'));

    if (!paystackSecret) return NextResponse.json({ error: 'Online payments are unavailable until Paystack is configured.' }, { status: 503 });
    {
      const origin = req.nextUrl.origin;
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: adminEmail,
          amount: Math.round(feeCalc.totalPlatformFee * 100), // in kobo
          reference,
          callback_url: `${origin}/api/platform/paystack/callback`,
          metadata: {
            type: 'pin_batch',
            tenantId: tenant.id,
            slug: tenant.slug,
            quantity,
            pricePerPin,
            platformFeePercent: feeCalc.platformFeePercent,
            platformFee: feeCalc.totalPlatformFee,
          },
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.status && data.data?.authorization_url && data.data.reference === reference) {
        return NextResponse.json({
          success: true,
          authorizationUrl: data.data.authorization_url,
          reference,
          feeCalc,
        });
      }
      console.error('[PIN Batch] Paystack rejected initialization', { status: response.status });
      return NextResponse.json({ error: 'Paystack could not start this payment. Please try again.' }, { status: 502 });
    }
  } catch (err: any) {
    console.error('[PIN Batch Order Error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to initialize PIN batch payment' },
      { status: 500 }
    );
  }
}
