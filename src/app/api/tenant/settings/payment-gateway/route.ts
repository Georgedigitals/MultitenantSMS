import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import {
  decryptTenantSecret,
  detectTenantKeyMode,
  encryptTenantGatewayConfig,
  parseDecryptedGatewayConfig,
} from '@/lib/tenant-payments';
import { getPlatformLocalization } from '@/lib/platform-settings';
import type { PlatformPaymentGateway } from '@/lib/payments/gateway';
import prisma from '@/lib/prisma';

function slugFrom(req: NextRequest) {
  return req.nextUrl.searchParams.get('slug') || req.headers.get('x-tenant-slug') || '';
}

export async function GET(req: NextRequest) {
  const access = await requireTenantAccess(slugFrom(req), ['school_admin']);
  if (!access.authorized || !access.tenant) {
    return NextResponse.json({ error: access.error || 'Unauthorized' }, { status: access.statusCode || 401 });
  }

  const [config, tenant, localization] = await Promise.all([
    prisma.tenantPaymentGateway.findUnique({ where: { tenantId: access.tenant.id } }),
    prisma.tenant.findUnique({
      where: { id: access.tenant.id },
      select: { hasOnlinePayment: true, hasOnlinePinPayment: true },
    }),
    getPlatformLocalization(),
  ]);

  let provider: PlatformPaymentGateway = 'paystack';
  let mode: 'test' | 'live' | null = null;
  let hasWebhookSecret = false;

  if (config) {
    try {
      const parsed = parseDecryptedGatewayConfig(decryptTenantSecret(config.paystackSecretCipher));
      provider = parsed.provider;
      mode = detectTenantKeyMode(parsed.provider, parsed.secretKey);
      hasWebhookSecret = Boolean(parsed.webhookSecret);
    } catch {
      mode = null;
    }
  }

  return NextResponse.json({
    configured: Boolean(config),
    provider,
    enabled: Boolean(config?.enabled && tenant?.hasOnlinePayment),
    pinSalesEnabled: Boolean(config?.enabled && tenant?.hasOnlinePinPayment),
    mode,
    hasWebhookSecret,
    platformCurrencyCode: localization.currencyCode,
    platformCurrencySymbol: localization.currencySymbol,
  });
}

export async function PUT(req: NextRequest) {
  const access = await requireTenantAccess(slugFrom(req), ['school_admin']);
  if (!access.authorized || !access.tenant) {
    return NextResponse.json({ error: access.error || 'Unauthorized' }, { status: access.statusCode || 401 });
  }

  try {
    const body = await req.json();
    const provider: PlatformPaymentGateway =
      body.provider === 'stripe' || body.provider === 'flutterwave' ? body.provider : 'paystack';
    const secretKey = typeof body.secretKey === 'string' ? body.secretKey.trim() : '';
    const webhookSecret = typeof body.webhookSecret === 'string' ? body.webhookSecret.trim() : '';
    const enabled = body.enabled === true;

    const [tenantSettings, existing] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: access.tenant.id },
        select: { hasOnlinePinPayment: true },
      }),
      prisma.tenantPaymentGateway.findUnique({ where: { tenantId: access.tenant.id } }),
    ]);

    const pinSalesEnabled =
      body.pinSalesEnabled === undefined
        ? Boolean(tenantSettings?.hasOnlinePinPayment)
        : body.pinSalesEnabled === true;
    const gatewayEnabled = enabled || pinSalesEnabled;

    let existingParsed = null;
    if (existing) {
      try {
        existingParsed = parseDecryptedGatewayConfig(decryptTenantSecret(existing.paystackSecretCipher));
      } catch {
        existingParsed = null;
      }
    }

    const effectiveSecret =
      secretKey || (existingParsed && existingParsed.provider === provider ? existingParsed.secretKey : '');
    const effectiveWebhookSecret =
      webhookSecret ||
      (existingParsed && existingParsed.provider === provider ? existingParsed.webhookSecret : undefined);

    const mode = effectiveSecret ? detectTenantKeyMode(provider, effectiveSecret) : null;
    if (secretKey && (!mode || secretKey.length > 256)) {
      const hint =
        provider === 'stripe'
          ? 'Stripe secret key (sk_test_... or sk_live_...)'
          : provider === 'flutterwave'
          ? 'Flutterwave secret key (FLWSECK_TEST... or FLWSECK-...)'
          : 'Paystack secret key (sk_test_... or sk_live_...)';
      return NextResponse.json(
        { error: `Enter a valid ${hint}. The secret stays encrypted and private to this school.` },
        { status: 400 }
      );
    }

    if (gatewayEnabled && !mode) {
      return NextResponse.json(
        { error: `Add a valid ${provider} secret key before enabling online payments.` },
        { status: 400 }
      );
    }

    if (!effectiveSecret) {
      if (!enabled) {
        await prisma.tenant.update({
          where: { id: access.tenant.id },
          data: { hasOnlinePayment: false, hasOnlinePinPayment: false },
        });
        return NextResponse.json({
          success: true,
          configured: false,
          provider,
          enabled: false,
          pinSalesEnabled: false,
          mode: null,
          hasWebhookSecret: false,
        });
      }
      return NextResponse.json({ error: 'A payment gateway secret key is required.' }, { status: 400 });
    }

    const encrypted = encryptTenantGatewayConfig({
      provider,
      secretKey: effectiveSecret,
      webhookSecret: effectiveWebhookSecret,
    });

    await prisma.$transaction(async (tx) => {
      await tx.tenantPaymentGateway.upsert({
        where: { tenantId: access.tenant!.id },
        create: {
          tenantId: access.tenant!.id,
          paystackSecretCipher: encrypted,
          enabled: gatewayEnabled,
        },
        update: {
          paystackSecretCipher: encrypted,
          enabled: gatewayEnabled,
        },
      });
      await tx.tenant.update({
        where: { id: access.tenant!.id },
        data: { hasOnlinePayment: enabled, hasOnlinePinPayment: pinSalesEnabled },
      });
    });

    return NextResponse.json({
      success: true,
      configured: true,
      provider,
      enabled,
      pinSalesEnabled,
      mode,
      hasWebhookSecret: Boolean(effectiveWebhookSecret),
    });
  } catch (error) {
    console.error('[Tenant payment gateway settings] Could not save configuration');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save payment settings.' },
      { status: 503 }
    );
  }
}
