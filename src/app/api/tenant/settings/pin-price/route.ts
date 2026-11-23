import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { calculatePinFees } from '@/lib/pin';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getPlatformLocalization, getPlatformPinSettings } from '@/lib/platform-settings';
import { formatMoney } from '@/lib/i18n/currency';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = req.headers.get('x-tenant-slug') || searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });

    const feeCalc = await calculatePinFees(tenant.id);
    return NextResponse.json(feeCalc);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
      return NextResponse.json({ error: 'Unauthorized: Only school administrators can update PIN price' }, { status: 403 });
    }

    const [pinSettings, localization] = await Promise.all([
      getPlatformPinSettings(),
      getPlatformLocalization(),
    ]);

    if (!pinSettings.allowTenantPinPricing) {
      return NextResponse.json(
        { error: 'Result PIN pricing is standardized by the platform administrator and cannot be modified per school.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { pinPrice } = body;

    const minAllowed = Math.max(0, pinSettings.minPinPrice);
    const parsedPrice = Number(pinPrice);
    if (pinPrice === undefined || !Number.isFinite(parsedPrice) || parsedPrice < minAllowed || parsedPrice > 1_000_000) {
      return NextResponse.json(
        {
          error: `Result PIN price must be between ${formatMoney(minAllowed, localization)} and ${formatMoney(1_000_000, localization)} (base ${localization.baseCurrencyCode}: ${minAllowed.toLocaleString()} – 1,000,000).`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { pinPrice: parsedPrice },
    });

    const feeCalc = await calculatePinFees(updated.id);
    return NextResponse.json({ success: true, ...feeCalc });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
