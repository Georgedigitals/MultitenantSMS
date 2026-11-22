import crypto from 'node:crypto';

export type PlatformPaymentGateway = 'paystack' | 'flutterwave' | 'stripe';

export const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

export const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'JOD', 'KWD', 'OMR', 'TND',
]);

export function getCurrencyDecimalDigits(currencyCode: string): 0 | 2 | 3 {
  const code = (currencyCode || 'NGN').trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/**
 * Convert major currency unit (e.g. 49.99 USD, 50000 NGN, 5000 XOF) into the
 * smallest integer unit expected by Stripe / Paystack.
 */
export function toMinorUnit(amount: number, currencyCode: string): number {
  const decimals = getCurrencyDecimalDigits(currencyCode);
  const multiplier = Math.pow(10, decimals);
  return Math.round(amount * multiplier);
}

/**
 * Convert smallest integer unit back to major currency amount.
 */
export function fromMinorUnit(minorAmount: number, currencyCode: string): number {
  const decimals = getCurrencyDecimalDigits(currencyCode);
  const divisor = Math.pow(10, decimals);
  return minorAmount / divisor;
}

const PAYSTACK_CURRENCIES = new Set(['NGN', 'GHS', 'ZAR', 'KES', 'XOF', 'USD']);
const FLUTTERWAVE_CURRENCIES = new Set([
  'NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP', 'EUR', 'XOF', 'XAF',
  'UGX', 'TZS', 'RWF', 'ZMW', 'MWK', 'EGP', 'MAD', 'CAD',
]);

export function isCurrencySupportedByGateway(
  gateway: PlatformPaymentGateway,
  currencyCode: string
): boolean {
  const code = (currencyCode || 'NGN').trim().toUpperCase();
  if (gateway === 'stripe') return true; // Stripe supports 135+ global currencies
  if (gateway === 'flutterwave') return FLUTTERWAVE_CURRENCIES.has(code);
  return PAYSTACK_CURRENCIES.has(code);
}

export function recommendGatewayForCurrency(currencyCode: string): PlatformPaymentGateway {
  const code = (currencyCode || 'NGN').trim().toUpperCase();
  if (PAYSTACK_CURRENCIES.has(code)) return 'paystack';
  if (FLUTTERWAVE_CURRENCIES.has(code)) return 'flutterwave';
  return 'stripe';
}

/**
 * Verify Stripe webhook signature (t=timestamp,v1=signature) using HMAC-SHA256
 * with constant-time comparison and 5-minute replay protection.
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined
): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  const parts = signatureHeader.split(',');
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't' && v) timestamp = v;
    if (k === 'v1' && v) signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) return false;
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return signatures.some((sig) => {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
