/**
 * API key management for M2M integrations.
 *
 * Key format: tpa_live_<22-char-base64url>  (~32 bytes random entropy)
 * Storage: SHA-256 hex of the full key — fast O(1) lookup at auth time.
 *          Plus the 16-char prefix ("tpa_live_XXXXXXXX") for UI display.
 *
 * We use SHA-256 (not bcrypt) for API keys because:
 *  - Keys are long and random (not user-chosen) — no dictionary attack concern
 *  - Need O(1) lookup on every API request — bcrypt would be ~100ms per check
 *  - The key itself IS the secret — bcrypt's per-request cost isn't warranted
 */

import { db } from '@/db/client';
import { apiKeys, apiKeyUsage } from '@/db/schema';
import { and, eq, isNull, or, gt } from 'drizzle-orm';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { ipMatchesAllowlist } from './ip-allowlist';

const KEY_PREFIX_LENGTH = 16; // "tpa_live_" + 8 chars shown in UI

export type ApiKeyScope =
  | 'orders:read'
  | 'orders:write'
  | 'persons:read'
  | 'persons:write'
  | 'collectors:read'
  | 'collectors:write'
  | 'events:read'
  | 'events:write'
  | 'billing:read'
  | 'leads:read'
  | 'leads:write'
  | 'dqf:read'
  | 'dqf:write'
  | 'webhooks:write';

export const ALL_API_SCOPES: ApiKeyScope[] = [
  'orders:read', 'orders:write',
  'persons:read', 'persons:write',
  'collectors:read', 'collectors:write',
  'events:read', 'events:write',
  'billing:read',
  'leads:read', 'leads:write',
  'dqf:read', 'dqf:write',
  'webhooks:write',
];

/**
 * Generate a new API key. Returns the raw key (to show the user ONCE) and
 * its SHA-256 hash (for storage).
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const randomPart = randomBytes(24).toString('base64url');
  const rawKey = `tpa_live_${randomPart}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH);
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash an API key for lookup. Must match the hash stored in the DB.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export type AuthFailureReason =
  | 'invalid_format'
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'ip_blocked';

/**
 * Look up an API key by its raw value. Returns the key row if valid, null if not.
 * Also bumps usage counters. Enforces IP allowlist when configured.
 *
 * Backward-compatible with existing call sites: returns null on any failure.
 * Use {@link authenticateApiKeyDetailed} for detailed failure reasons.
 */
export async function authenticateApiKey(
  rawKey: string,
  ipAddress: string | null = null
): Promise<{
  id: string;
  tpaOrgId: string;
  scopes: string[];
} | null> {
  const result = await authenticateApiKeyDetailed(rawKey, ipAddress);
  return result.ok ? { id: result.id, tpaOrgId: result.tpaOrgId, scopes: result.scopes } : null;
}

/**
 * Same as authenticateApiKey but returns a discriminated result so callers can
 * distinguish "bad format" vs "IP blocked" vs "expired" for better error messages
 * and usage logging.
 */
export async function authenticateApiKeyDetailed(
  rawKey: string,
  ipAddress: string | null = null
): Promise<
  | { ok: true; id: string; tpaOrgId: string; scopes: string[]; keyId: string }
  | { ok: false; reason: AuthFailureReason; keyId?: string; tpaOrgId?: string }
> {
  if (!rawKey || !rawKey.startsWith('tpa_live_') || rawKey.length < 30) {
    return { ok: false, reason: 'invalid_format' };
  }

  const keyHash = hashApiKey(rawKey);

  const row = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  });

  if (!row) return { ok: false, reason: 'not_found' };

  // Constant-time compare as defense-in-depth
  const storedBuf = Buffer.from(row.keyHash, 'hex');
  const submittedBuf = Buffer.from(keyHash, 'hex');
  if (storedBuf.length !== submittedBuf.length || !timingSafeEqual(storedBuf, submittedBuf)) {
    return { ok: false, reason: 'not_found' };
  }

  if (row.revokedAt) {
    return { ok: false, reason: 'revoked', keyId: row.id, tpaOrgId: row.tpaOrgId };
  }
  if (row.expiresAt && row.expiresAt <= new Date()) {
    return { ok: false, reason: 'expired', keyId: row.id, tpaOrgId: row.tpaOrgId };
  }

  // IP allowlist check (if configured)
  if (!ipMatchesAllowlist(ipAddress, row.ipAllowlist)) {
    return { ok: false, reason: 'ip_blocked', keyId: row.id, tpaOrgId: row.tpaOrgId };
  }

  // Bump usage counters (non-blocking)
  db.update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      lastUsedIp: ipAddress,
      usageCount: row.usageCount + 1,
    })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {});

  return {
    ok: true,
    id: row.id,
    tpaOrgId: row.tpaOrgId,
    scopes: row.scopes,
    keyId: row.id,
  };
}

/**
 * Check if a key's scopes include the required scope.
 * Supports wildcard like `orders:*` matching both read and write.
 */
export function hasScope(grantedScopes: string[], required: ApiKeyScope): boolean {
  if (grantedScopes.includes(required)) return true;
  const [resource] = required.split(':');
  return grantedScopes.includes(`${resource}:*`) || grantedScopes.includes('*');
}

/**
 * Record a single API request for analytics + abuse detection.
 * Fire-and-forget; never blocks the response.
 */
export async function logApiKeyUsage(params: {
  apiKeyId: string;
  tpaOrgId: string;
  method: string;
  path: string;
  statusCode: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  durationMs?: number;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.insert(apiKeyUsage).values({
      apiKeyId: params.apiKeyId,
      tpaOrgId: params.tpaOrgId,
      method: params.method,
      path: params.path.slice(0, 500),
      statusCode: params.statusCode,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent?.slice(0, 2000) ?? null,
      durationMs: params.durationMs,
      errorMessage: params.errorMessage?.slice(0, 2000),
    });
  } catch {
    // Swallow — logging must never break the request
  }
}
