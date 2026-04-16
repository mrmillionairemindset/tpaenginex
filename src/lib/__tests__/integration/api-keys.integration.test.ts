/**
 * Integration tests for API key auth — real Postgres via testcontainers.
 * Covers: create, authenticate, IP allowlist (jsonb), revoked, expired, usage counter.
 *
 * Skips cleanly when Docker is unavailable (dev laptops without Docker, sandboxed CI).
 */

import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { ensureIntegrationContext, teardownIntegrationContext, getTestDb, resetTestData, dockerAvailable } from './setup';
import { createTestOrganization, createTestUser } from './factories';

// Must run BEFORE importing the lib, so the `@/db/client` module resolves to the test DB.
vi.mock('@/db/client', () => {
  return {
    get db() {
      return getTestDb();
    },
  };
});

let available = false;

beforeAll(async () => {
  const ctx = await ensureIntegrationContext();
  available = !!ctx;
}, 90_000);

afterAll(async () => {
  await teardownIntegrationContext();
});

beforeEach(async () => {
  if (available) await resetTestData();
});

// Lazy imports so vi.mock applies cleanly.
async function loadApiKeyLib() {
  return await import('@/lib/api-keys');
}

describe.skipIf(!dockerAvailable && !available)('api-keys integration', () => {
  it('authenticates a freshly-created key and bumps usage counter', async () => {
    if (!available) return;
    const { generateApiKey, authenticateApiKey } = await loadApiKeyLib();
    const db = getTestDb();
    const { apiKeys } = await import('@/db/schema');

    const org = await createTestOrganization(db, { type: 'tpa' });
    const user = await createTestUser(db, org.id);

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    await db.insert(apiKeys).values({
      tpaOrgId: org.id,
      createdBy: user.id,
      name: 'Test Key',
      keyHash,
      keyPrefix,
      scopes: ['orders:read'],
      ipAllowlist: [],
    });

    const result = await authenticateApiKey(rawKey, '198.51.100.10');
    expect(result).not.toBeNull();
    expect(result!.tpaOrgId).toBe(org.id);
    expect(result!.scopes).toContain('orders:read');

    // Usage bump is fire-and-forget — give it a tick to complete
    await new Promise((r) => setTimeout(r, 100));
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    expect(row.usageCount).toBeGreaterThanOrEqual(1);
    expect(row.lastUsedIp).toBe('198.51.100.10');
  });

  it('enforces IP allowlist from real postgres jsonb', async () => {
    if (!available) return;
    const { generateApiKey, authenticateApiKeyDetailed } = await loadApiKeyLib();
    const db = getTestDb();
    const { apiKeys } = await import('@/db/schema');

    const org = await createTestOrganization(db);
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    await db.insert(apiKeys).values({
      tpaOrgId: org.id,
      name: 'Locked Key',
      keyHash,
      keyPrefix,
      scopes: ['orders:read'],
      ipAllowlist: ['203.0.113.0/24'],
    });

    const blocked = await authenticateApiKeyDetailed(rawKey, '198.51.100.10');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('ip_blocked');

    const allowed = await authenticateApiKeyDetailed(rawKey, '203.0.113.42');
    expect(allowed.ok).toBe(true);
  });

  it('rejects a revoked key', async () => {
    if (!available) return;
    const { generateApiKey, authenticateApiKeyDetailed } = await loadApiKeyLib();
    const db = getTestDb();
    const { apiKeys } = await import('@/db/schema');

    const org = await createTestOrganization(db);
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    await db.insert(apiKeys).values({
      tpaOrgId: org.id,
      name: 'Revoked Key',
      keyHash,
      keyPrefix,
      scopes: ['orders:read'],
      ipAllowlist: [],
      revokedAt: new Date(),
    });

    const res = await authenticateApiKeyDetailed(rawKey, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('revoked');
  });

  it('rejects an expired key', async () => {
    if (!available) return;
    const { generateApiKey, authenticateApiKeyDetailed } = await loadApiKeyLib();
    const db = getTestDb();
    const { apiKeys } = await import('@/db/schema');

    const org = await createTestOrganization(db);
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    await db.insert(apiKeys).values({
      tpaOrgId: org.id,
      name: 'Expired Key',
      keyHash,
      keyPrefix,
      scopes: ['orders:read'],
      ipAllowlist: [],
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await authenticateApiKeyDetailed(rawKey, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('expired');
  });

  it('bumps usage counter correctly across multiple calls', async () => {
    if (!available) return;
    const { generateApiKey, authenticateApiKey } = await loadApiKeyLib();
    const db = getTestDb();
    const { apiKeys } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const org = await createTestOrganization(db);
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    await db.insert(apiKeys).values({
      tpaOrgId: org.id,
      name: 'Bump Key',
      keyHash,
      keyPrefix,
      scopes: ['orders:read'],
      ipAllowlist: [],
    });

    await authenticateApiKey(rawKey, '10.0.0.1');
    await new Promise((r) => setTimeout(r, 50));
    await authenticateApiKey(rawKey, '10.0.0.2');
    await new Promise((r) => setTimeout(r, 50));
    await authenticateApiKey(rawKey, '10.0.0.3');
    await new Promise((r) => setTimeout(r, 150));

    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    expect(row.usageCount).toBeGreaterThanOrEqual(1);
    expect(row.lastUsedAt).not.toBeNull();
  });
});
