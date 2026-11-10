import crypto from 'node:crypto';

interface HandoffData {
  token: string;
  tenantSlug: string;
  impersonatePayload?: any;
  nextPath?: string;
}

interface TicketPayload extends HandoffData {
  nonce: string;
  expiresAt: number;
}

function getHandoffSecret() {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('SESSION_SECRET must contain at least 32 characters before session handoff tickets can be issued.');
  }
  return secret || 'development-only-session-handoff-secret';
}

// Track redeemed ticket nonces to enforce single-use redemption
const redeemedNonces = new Set<string>();

// Periodic cleanup of expired nonces
setInterval(() => {
  if (redeemedNonces.size > 1000) {
    redeemedNonces.clear();
  }
}, 5 * 60 * 1000).unref();

/**
 * Creates a cryptographically signed single-use handoff ticket valid for 60 seconds.
 */
export function createSessionHandoffTicket(data: HandoffData): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 60 * 1000; // 60 seconds TTL

  const payload: TicketPayload = {
    ...data,
    nonce,
    expiresAt,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getHandoffSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Validates, redeems, and consumes a session handoff ticket.
 * Returns the payload if valid and unredeemed, or null otherwise.
 */
export function redeemSessionHandoffTicket(ticket: string): HandoffData | null {
  if (!ticket || typeof ticket !== 'string') return null;

  const parts = ticket.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', getHandoffSecret())
    .update(payloadB64)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload: TicketPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    // Check single-use
    if (redeemedNonces.has(payload.nonce)) {
      return null;
    }

    redeemedNonces.add(payload.nonce);

    return {
      token: payload.token,
      tenantSlug: payload.tenantSlug,
      impersonatePayload: payload.impersonatePayload,
      nextPath: payload.nextPath || '/dashboard',
    };
  } catch {
    return null;
  }
}
