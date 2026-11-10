import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { verifyPinAccess, redeemPin } from '@/lib/pin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = req.headers.get('x-tenant-slug') || searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const body = await req.json();
    const { studentId, termId, pinCode } = body;

    // Schools that do not require PINs can still check published results. Gate only PIN redemption.
    if (pinCode && !tenant.hasFeature('result_pins')) {
      return NextResponse.json({ error: 'Result PIN access is not enabled for this school.' }, { status: 403 });
    }

    if (!studentId || !termId) {
      return NextResponse.json(
        { error: 'studentId and termId are required' },
        { status: 400 }
      );
    }

    if (pinCode) {
      const clientIp = getClientIp(req);
      const rateLimitKey = `pin_verify_${tenant.id}_${clientIp}_${studentId}`;
      const rateLimit = await checkRateLimit(rateLimitKey, { limit: 5, windowSeconds: 60 });

      if (!rateLimit.success) {
        return NextResponse.json(
          {
            isUnlocked: false,
            error: 'Too many invalid attempts. Please wait 60 seconds before trying another PIN.',
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rateLimit.resetSeconds) },
          }
        );
      }

      const verification = await verifyPinAccess(tenant.id, studentId, termId, pinCode);
      if (!verification.isUnlocked) {
        return NextResponse.json(verification, {
          status: verification.reason === 'fees_outstanding' ? 402 : 400,
        });
      }
      return NextResponse.json(verification);
    }

    const check = await verifyPinAccess(tenant.id, studentId, termId);
    return NextResponse.json(check, {
      status: !check.isUnlocked && check.reason === 'fees_outstanding' ? 402 : 200,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
