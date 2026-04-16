/**
 * Integration tests for the session manager — real Postgres via testcontainers.
 * Skips cleanly when Docker is unavailable.
 */

import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { ensureIntegrationContext, teardownIntegrationContext, getTestDb, resetTestData, dockerAvailable } from './setup';
import { createTestOrganization, createTestUser } from './factories';

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

async function loadSessionLib() {
  return await import('@/lib/session-manager');
}

describe.skipIf(!dockerAvailable && !available)('session-manager integration', () => {
  it('creates a session and validates it back', async () => {
    if (!available) return;
    const { createSession, validateSession } = await loadSessionLib();
    const db = getTestDb();
    const org = await createTestOrganization(db);
    const user = await createTestUser(db, org.id);

    const token = await createSession({
      userId: user.id,
      ipAddress: '10.0.0.5',
      userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120',
    });

    const validated = await validateSession(token);
    expect(validated).not.toBeNull();
    expect(validated!.userId).toBe(user.id);
    expect(validated!.ipAddress).toBe('10.0.0.5');
    expect(validated!.deviceLabel).toContain('Chrome');
  });

  it('returns null for a revoked session', async () => {
    if (!available) return;
    const { createSession, validateSession, revokeSessionByToken } = await loadSessionLib();
    const db = getTestDb();
    const org = await createTestOrganization(db);
    const user = await createTestUser(db, org.id);

    const token = await createSession({ userId: user.id, ipAddress: '1.1.1.1', userAgent: 'ua' });
    expect(await validateSession(token)).not.toBeNull();

    await revokeSessionByToken(token);
    expect(await validateSession(token)).toBeNull();
  });

  it('revokeOtherSessions leaves the current session intact and revokes the rest', async () => {
    if (!available) return;
    const { createSession, validateSession, revokeOtherSessions, listUserSessions } = await loadSessionLib();
    const db = getTestDb();
    const org = await createTestOrganization(db);
    const user = await createTestUser(db, org.id);

    const current = await createSession({ userId: user.id, ipAddress: '1.1.1.1', userAgent: 'current' });
    const other1 = await createSession({ userId: user.id, ipAddress: '2.2.2.2', userAgent: 'other1' });
    const other2 = await createSession({ userId: user.id, ipAddress: '3.3.3.3', userAgent: 'other2' });

    const revokedCount = await revokeOtherSessions(user.id, current);
    expect(revokedCount).toBe(2);

    expect(await validateSession(current)).not.toBeNull();
    expect(await validateSession(other1)).toBeNull();
    expect(await validateSession(other2)).toBeNull();

    const active = await listUserSessions(user.id);
    expect(active.length).toBe(1);
    expect(active[0].sessionToken).toBe(current);
  });
});
