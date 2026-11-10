import net from 'node:net';
import crypto from 'node:crypto';
import prisma from './prisma';

/**
 * Sliding-Window In-Memory Rate Limiter with Automatic Memory Pruning (§Security Hardening).
 * 
 * Provides high-speed request throttling across sensitive platform endpoints
 * (Result PIN lookups, login credential checks, self-service registrations)
 * to prevent brute-force attacks and credential stuffing.
 */

export interface RateLimitOptions {
  limit: number;          // Maximum allowed requests within window
  windowSeconds: number;  // Window duration in seconds
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Checks if a given identifier/key has exceeded its request threshold.
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = options;
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error('Rate limit must use positive integer limits and windows.');
  }

  const now = Date.now();
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
  const rows = await prisma.$queryRaw<Array<{ count: number; window_started_at: Date }>>`
    INSERT INTO rate_limit_buckets (key, count, window_started_at, expires_at)
    VALUES (
      ${hashedKey},
      1,
      to_timestamp(${now / 1000}),
      to_timestamp(${now / 1000}) + (${windowSeconds} * INTERVAL '1 second')
    )
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_buckets.window_started_at <= to_timestamp(${now / 1000}) - (${windowSeconds} * INTERVAL '1 second') THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      window_started_at = CASE
        WHEN rate_limit_buckets.window_started_at <= to_timestamp(${now / 1000}) - (${windowSeconds} * INTERVAL '1 second') THEN to_timestamp(${now / 1000})
        ELSE rate_limit_buckets.window_started_at
      END,
      expires_at = CASE
        WHEN rate_limit_buckets.window_started_at <= to_timestamp(${now / 1000}) - (${windowSeconds} * INTERVAL '1 second') THEN to_timestamp(${now / 1000}) + (${windowSeconds} * INTERVAL '1 second')
        ELSE rate_limit_buckets.expires_at
      END
    RETURNING count, window_started_at
  `;

  const row = rows[0];
  if (!row) throw new Error('Rate limiter did not return its persisted counter.');
  const elapsedSeconds = Math.floor((now - new Date(row.window_started_at).getTime()) / 1000);
  const resetSeconds = Math.max(1, windowSeconds - elapsedSeconds);
  const success = Number(row.count) <= limit;

  // Opportunistic cleanup avoids a separate scheduler for expired counters.
  if (Math.random() < 0.01) {
    void prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }).catch(() => undefined);
  }

  return {
    success,
    limit,
    remaining: Math.max(0, limit - Number(row.count)),
    resetSeconds,
  };
}

/**
 * Helper to extract client IP address from NextRequest or standard Request headers.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp && net.isIP(realIp.trim())) {
    return realIp.trim();
  }
  // Do not trust X-Forwarded-For: clients can supply it unless the reverse
  // proxy is explicitly configured to overwrite it. Configure Nginx to set
  // X-Real-IP from the socket peer (or Cloudflare's verified client IP).
  return '127.0.0.1';
}
