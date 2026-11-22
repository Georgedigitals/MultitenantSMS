import prisma from '@/lib/prisma';
import {
  isCurrencySupportedByGateway,
  toMinorUnit,
  type PlatformPaymentGateway,
} from '@/lib/payments/gateway';

export interface PlatformPaymentConfig {
  activeGateway: PlatformPaymentGateway;
  currencyCode: string;
  paystackPublicKey: string;
  paystackSecretKey: string;
  flutterwavePublicKey: string;
  flutterwaveSecretKey: string;
  stripePublicKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}

export async function getPlatformPaymentConfig(): Promise<PlatformPaymentConfig> {
  const keys = [
    'activePaymentGateway',
    'defaultCurrencyCode',
    'paystackPublicKey',
    'paystackSecretKey',
    'flutterwavePublicKey',
    'flutterwaveSecretKey',
    'stripePublicKey',
    'stripeSecretKey',
    'stripeWebhookSecret',
  ];
  const rows = await prisma.platformSetting
    .findMany({ where: { key: { in: keys } } })
    .catch(() => []);
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const rawGateway = (map.get('activePaymentGateway') || 'paystack').toLowerCase();
  const activeGateway: PlatformPaymentGateway =
    rawGateway === 'stripe' || rawGateway === 'flutterwave' ? rawGateway : 'paystack';

  return {
    activeGateway,
    currencyCode: (map.get('defaultCurrencyCode') || 'NGN').trim().toUpperCase(),
    paystackPublicKey: map.get('paystackPublicKey') || process.env.NEXT_PUBLIC_PAYSTACK_KEY || '',
    paystackSecretKey: map.get('paystackSecretKey') || process.env.PAYSTACK_SECRET_KEY || '',
    flutterwavePublicKey: map.get('flutterwavePublicKey') || process.env.NEXT_PUBLIC_FLUTTERWAVE_KEY || '',
    flutterwaveSecretKey: map.get('flutterwaveSecretKey') || process.env.FLUTTERWAVE_SECRET_KEY || '',
    stripePublicKey: map.get('stripePublicKey') || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    stripeSecretKey: map.get('stripeSecretKey') || process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: map.get('stripeWebhookSecret') || process.env.STRIPE_WEBHOOK_SECRET || '',
  };
}

export interface InitializeCheckoutInput {
  reference: string;
  email: string;
  amount: number;
  productName: string;
  callbackUrl: string;
  cancelUrl: string;
  metadata: Record<string, any>;
}

export async function initializePlatformCheckout(input: InitializeCheckoutInput): Promise<{
  ok: boolean;
  gateway: PlatformPaymentGateway;
  currency: string;
  authorizationUrl?: string;
  error?: string;
  statusCode?: number;
}> {
  const cfg = await getPlatformPaymentConfig();
  const { activeGateway, currencyCode } = cfg;

  if (!isCurrencySupportedByGateway(activeGateway, currencyCode)) {
    return {
      ok: false,
      gateway: activeGateway,
      currency: currencyCode,
      statusCode: 400,
      error: `Selected payment gateway (${activeGateway}) does not support ${currencyCode}. Switch to Stripe or Flutterwave in Platform Settings.`,
    };
  }

  // 1. STRIPE CHECKOUT SESSION (135+ Global Currencies, native Idempotency-Key)
  if (activeGateway === 'stripe') {
    if (!cfg.stripeSecretKey) {
      return {
        ok: false,
        gateway: 'stripe',
        currency: currencyCode,
        statusCode: 503,
        error: 'Stripe is not configured yet. Add your Stripe Secret Key in Platform Settings.',
      };
    }

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('client_reference_id', input.reference);
    params.set('customer_email', input.email);
    params.set('success_url', `${input.callbackUrl}?provider=stripe&reference=${encodeURIComponent(input.reference)}`);
    params.set('cancel_url', input.cancelUrl);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', currencyCode.toLowerCase());
    params.set('line_items[0][price_data][unit_amount]', String(toMinorUnit(input.amount, currencyCode)));
    params.set('line_items[0][price_data][product_data][name]', input.productName);
    params.set('metadata[reference]', input.reference);
    for (const [k, v] of Object.entries(input.metadata)) {
      if (v !== undefined && v !== null) {
        params.set(`metadata[${k}]`, String(v).slice(0, 450));
      }
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': input.reference,
      },
      body: params.toString(),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.url) {
      return {
        ok: true,
        gateway: 'stripe',
        currency: currencyCode,
        authorizationUrl: data.url,
      };
    }
    return {
      ok: false,
      gateway: 'stripe',
      currency: currencyCode,
      statusCode: 502,
      error: data?.error?.message || 'Stripe could not start this checkout session.',
    };
  }

  // 2. FLUTTERWAVE STANDARD CHECKOUT (Multi-currency Africa + USD/GBP/EUR)
  if (activeGateway === 'flutterwave') {
    if (!cfg.flutterwaveSecretKey) {
      return {
        ok: false,
        gateway: 'flutterwave',
        currency: currencyCode,
        statusCode: 503,
        error: 'Flutterwave is not configured yet. Add your Flutterwave Secret Key in Platform Settings.',
      };
    }

    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amount,
        currency: currencyCode,
        redirect_url: `${input.callbackUrl}?provider=flutterwave&reference=${encodeURIComponent(input.reference)}`,
        customer: {
          email: input.email,
          name: input.metadata.adminName || input.metadata.schoolName || input.email,
        },
        customizations: {
          title: input.productName,
        },
        meta: input.metadata,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.status === 'success' && data?.data?.link) {
      return {
        ok: true,
        gateway: 'flutterwave',
        currency: currencyCode,
        authorizationUrl: data.data.link,
      };
    }
    return {
      ok: false,
      gateway: 'flutterwave',
      currency: currencyCode,
      statusCode: 502,
      error: data?.message || 'Flutterwave could not start this payment.',
    };
  }

  // 3. PAYSTACK (Default — supports NGN, GHS, ZAR, KES, XOF, USD)
  if (!cfg.paystackSecretKey) {
    return {
      ok: false,
      gateway: 'paystack',
      currency: currencyCode,
      statusCode: 503,
      error: 'Payment processing is not configured. Please contact platform support.',
    };
  }

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      amount: toMinorUnit(input.amount, currencyCode),
      currency: currencyCode,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  const data = await res.json().catch(() => null);
  if (res.ok && data?.status && data.data?.authorization_url && data.data.reference === input.reference) {
    return {
      ok: true,
      gateway: 'paystack',
      currency: currencyCode,
      authorizationUrl: data.data.authorization_url,
    };
  }

  return {
    ok: false,
    gateway: 'paystack',
    currency: currencyCode,
    statusCode: 502,
    error: data?.message || 'Paystack could not start this payment. Please try again.',
  };
}
