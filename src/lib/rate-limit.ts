/**
 * Distributed rate limiter.
 *
 * Uses Redis when REDIS_URL is set (required for multi-instance deployments —
 * serverless, horizontal-scaled Node, etc). Falls back to in-memory when Redis
 * is unavailable for single-instance dev/test environments.
 *
 * Implementation: fixed-window counter stored at `rl:{key}`. Atomic INCR +
 * EXPIRE via a Lua script. Simpler than a true sliding window but sufficient
 * for anti-abuse + has O(1) cost.
 *
 * Fail-open on Redis errors: if Redis is unreachable, we fall back to in-memory
 * rather than blocking all traffic. This trades some limiter correctness for
 * availability — appropriate given rate limiting is a DEFENSE, not a CRITICAL
 * path. Auth decisions must never depend on rate limit results alone.
 */

import { redis } from './redis';

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 10;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Max requests allowed in the window. Default 10. */
  max?: number;
  /** Window length in ms. Default 60000 (1 minute). */
  windowMs?: number;
}

// ============================================================================
// In-memory fallback (for dev / single instance / Redis outage)
// ============================================================================

const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup so the map doesn't grow unbounded
let cleanupInterval: NodeJS.Timeout | null = null;
if (typeof setInterval !== 'undefined' && !cleanupInterval) {
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt < now) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
  if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }
}

function inMemoryCheck(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

// ============================================================================
// Redis-backed check (for prod / multi-instance)
// ============================================================================

/**
 * Atomic Lua script: increment counter, set TTL on first hit, return [count, ttl_ms].
 * Using Lua guarantees INCR + PEXPIRE happen in a single Redis roundtrip and
 * cannot race with other clients.
 */
const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local ttl_ms = tonumber(ARGV[1])

local current = redis.call('INCR', key)
if current == 1 then
  redis.call('PEXPIRE', key, ttl_ms)
end

local remaining_ttl = redis.call('PTTL', key)
if remaining_ttl < 0 then
  redis.call('PEXPIRE', key, ttl_ms)
  remaining_ttl = ttl_ms
end

return { current, remaining_ttl }
`.trim();

async function redisCheck(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!redis) {
    return inMemoryCheck(key, max, windowMs);
  }

  try {
    const redisKey = `rl:${key}`;
    const result = (await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      redisKey,
      String(windowMs)
    )) as [number, number];

    const [count, ttlMs] = result;
    const resetAt = Date.now() + Math.max(0, ttlMs);

    if (count > max) {
      return { allowed: false, remaining: 0, resetAt };
    }
    return { allowed: true, remaining: Math.max(0, max - count), resetAt };
  } catch (err) {
    console.error('[rate-limit] Redis error, falling back to in-memory:', err);
    return inMemoryCheck(key, max, windowMs);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Synchronous in-memory rate limit check.
 *
 * Use this ONLY for dev/single-instance setups. In production with Redis and
 * multiple instances, use `checkRateLimitAsync()` for correct behavior.
 *
 * Kept as-is for backward compatibility with existing non-async call sites.
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  return inMemoryCheck(identifier, max, windowMs);
}

/**
 * Async Redis-backed rate limit check. Use this in server-side API routes
 * for correct behavior across multi-instance deployments.
 *
 * Falls back to in-memory when Redis is unavailable.
 */
export async function checkRateLimitAsync(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;

  if (redis) {
    return redisCheck(identifier, max, windowMs);
  }
  return inMemoryCheck(identifier, max, windowMs);
}
