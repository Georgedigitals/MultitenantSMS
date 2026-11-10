/**
 * In-memory sliding window rate limiter for login and PIN redemption (§11.2).
 * In multi-instance deployments, this can be swapped with Redis via BullMQ / ioredis.
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowSeconds = 60
): RateLimitResult {
  // Never rate-limit developers testing in development mode
  if (process.env.NODE_ENV !== 'production') {
    return {
      allowed: true,
      remaining: 999,
      resetSeconds: 0,
    };
  }

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (record.count >= maxAttempts) {
    const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetSeconds,
    };
  }

  record.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetSeconds,
  };
}

/**
 * Resets the rate limit counter for a key upon successful authentication.
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
