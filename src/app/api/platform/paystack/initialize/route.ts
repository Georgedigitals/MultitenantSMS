import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { randomUUID } from 'node:crypto';
import { getPublicUrl } from '@/lib/public-url';
import { initializePlatformCheckout } from '@/lib/payments/platform-gateway';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      schoolName,
      slug,
      adminName,
      adminEmail,
      password,
      planId = 'plan_growth',
      registrationMode,
      lowestLevelName = 'Nursery 1',
      highestLevelName = 'SSS 3',
      primaryColor = '#1E3A8A',
      accentColor = '#2563EB',
      logoUrl = null,
      heroImageUrl = null,
      motto = '',
      heroSubheading = '',
      galleryImages = [],
      templateId = 'heritage',
      sliderSlides = [],
      tenantId,
      type: explicitType,
    } = body;

    const isUpgrade = Boolean(tenantId || body.isUpgrade || explicitType === 'subscription') && !password;

    if (!planId || (isUpgrade && !tenantId)) {
      return NextResponse.json({ error: 'A valid subscription plan and school account are required' }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: 'Selected subscription plan is unavailable' }, { status: 400 });

    let chargeAmount = Number(plan.price);
    let pricingNote = 'Full plan price';
    let currentPlanId: string | undefined;
    if (isUpgrade) {
      const auth = await getTenantUserFromCookies(String(tenantId), undefined, { allowExpiredTrial: true });
      if (!auth || auth.user.role !== 'school_admin') {
        return NextResponse.json({ error: 'Only the school administrator can purchase a subscription' }, { status: 403 });
      }
      const tenant = await prisma.tenant.findUnique({ where: { id: String(tenantId) }, include: { plan: true } });
      if (!tenant || tenant.slug !== String(slug || '').toLowerCase()) {
        return NextResponse.json({ error: 'School account could not be verified for this plan change' }, { status: 404 });
      }
      currentPlanId = tenant.planId;
      const currentPrice = Number(tenant.annualContractPrice ?? tenant.plan.price);
      const isExpiredOrRenewalDue = Boolean(
        tenant.subscriptionExpiresAt &&
        new Date(tenant.subscriptionExpiresAt).getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000
      );

      if (plan.id === tenant.planId && tenant.status !== 'trial' && !isExpiredOrRenewalDue) {
        return NextResponse.json({ error: 'Your current annual subscription is active. Renewal opens 30 days before contract expiry.' }, { status: 400 });
      }

      if (plan.id !== tenant.planId && Number(plan.price) <= currentPrice) {
        return NextResponse.json({ error: 'Choose a higher priced plan to upgrade.' }, { status: 400 });
      }

      if (tenant.status === 'active') {
        const lastActivation = await prisma.auditLog.findFirst({
          where: { tenantId: tenant.id, action: 'SUBSCRIPTION_ACTIVATED' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        const activationDate = lastActivation?.createdAt || tenant.createdAt;
        const ageMs = Date.now() - activationDate.getTime();
        const insideUpgradeWindow = ageMs >= 0 && ageMs <= 30 * 24 * 60 * 60 * 1000;
        if (insideUpgradeWindow) {
          chargeAmount = Math.max(0, Number(plan.price) - currentPrice);
          pricingNote = 'Upgrade balance: higher plan price less the plan you already paid for (within 30 days)';
        }
      }
    } else if (body.registrationMode !== 'paid') {
      return NextResponse.json({ error: 'Registration checkout is only available for paid activation' }, { status: 400 });
    }

    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      return NextResponse.json({ error: 'This plan change does not have a payable balance. Please contact support.' }, { status: 400 });
    }
    const reference = `BMS_${randomUUID().replace(/-/g, '')}`;

    // Save full registration payload in server-side cache keyed by reference
    if (!isUpgrade) {
      const { savePendingRegistration } = await import('@/lib/pending-registrations');
      await savePendingRegistration(reference, {
        schoolName,
        slug,
        adminName,
        adminEmail,
        password,
        planId,
        registrationMode,
        lowestLevelName,
        highestLevelName,
        primaryColor,
        accentColor,
        logoUrl,
        heroImageUrl,
        motto,
        heroSubheading,
        galleryImages,
        templateId,
        sliderSlides,
      });
    }

    const checkout = await initializePlatformCheckout({
      reference,
      email: adminEmail,
      amount: chargeAmount,
      productName: `${plan.name} Subscription — ${schoolName || slug || 'School'}`,
      callbackUrl: getPublicUrl('/api/platform/paystack/callback', req).toString(),
      cancelUrl: getPublicUrl('/pricing', req).toString(),
      metadata: {
        type: isUpgrade ? 'subscription' : 'registration',
        schoolName,
        slug,
        tenantId: tenantId || undefined,
        adminName,
        adminEmail,
        planId,
        chargeAmount,
        currentPlanId,
        logoUrl: logoUrl || undefined,
        templateId,
      },
    });

    if (checkout.ok && checkout.authorizationUrl) {
      return NextResponse.json({
        success: true,
        gateway: checkout.gateway,
        currency: checkout.currency,
        authorizationUrl: checkout.authorizationUrl,
        reference,
        amount: chargeAmount,
        pricingNote,
      });
    }

    return NextResponse.json(
      { error: checkout.error || 'Could not initialize payment checkout.' },
      { status: checkout.statusCode || 502 }
    );
  } catch (err: any) {
    console.error('Paystack initialization error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to initialize Paystack transaction' },
      { status: 500 }
    );
  }
}
