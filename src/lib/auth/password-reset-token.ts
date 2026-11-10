import crypto from 'crypto';

function getResetSecret() {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('SESSION_SECRET must contain at least 32 characters before password reset tokens can be issued.');
  }
  return secret || 'development-only-password-reset-secret';
}

export interface ResetTokenPayload {
  userId: string;
  tenantId: string;
  expiresAt: number;
}

/**
 * Generates a tamper-proof password reset token.
 * Incorporates the user's existing passwordHash into the HMAC key so that
 * as soon as the password is reset, this token is permanently invalidated.
 */
export function generatePasswordResetToken(
  user: { id: string; tenantId: string; passwordHash: string },
  expiryHours: number = 1
): string {
  const expiresAt = Date.now() + 1000 * 60 * 60 * expiryHours;
  const payload: ResetTokenPayload = {
    userId: user.id,
    tenantId: user.tenantId,
    expiresAt,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmacKey = `${getResetSecret()}:${user.passwordHash}`;
  const signature = crypto.createHmac('sha256', hmacKey).update(payloadB64).digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Extracts payload without verifying signature (used to lookup the user).
 */
export function decodeResetTokenPayload(token: string): ResetTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payloadStr = Buffer.from(parts[0], 'base64url').toString('utf8');
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}

/**
 * Verifies that the token was signed with the user's current passwordHash and is unexpired.
 */
export function verifyPasswordResetToken(
  token: string,
  user: { id: string; tenantId: string; passwordHash: string }
): { valid: boolean; reason?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed reset token format.' };
    }

    const [payloadB64, signature] = parts;
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload: ResetTokenPayload = JSON.parse(payloadStr);

    if (payload.userId !== user.id || payload.tenantId !== user.tenantId) {
      return { valid: false, reason: 'This reset token does not belong to this account.' };
    }

    if (Date.now() > payload.expiresAt) {
      return { valid: false, reason: 'This password reset link has expired. Please request a new one.' };
    }

    const hmacKey = `${getResetSecret()}:${user.passwordHash}`;
    const expectedSig = crypto.createHmac('sha256', hmacKey).update(payloadB64).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, reason: 'Invalid or already consumed password reset token.' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: err?.message || 'Token verification failed.' };
  }
}

