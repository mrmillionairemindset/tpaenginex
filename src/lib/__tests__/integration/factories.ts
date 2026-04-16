/**
 * Test-data factories for integration tests. Each helper inserts a minimally-valid
 * row and returns it, with `overrides` to customise any field.
 */

import { organizations, users } from '@/db/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { randomBytes } from 'crypto';

type TestDb = PostgresJsDatabase<typeof schema>;

function shortId(): string {
  return randomBytes(6).toString('hex');
}

export async function createTestOrganization(
  db: TestDb,
  overrides: Partial<typeof organizations.$inferInsert> = {},
) {
  const id = shortId();
  const [row] = await db
    .insert(organizations)
    .values({
      slug: overrides.slug ?? `test-org-${id}`,
      name: overrides.name ?? `Test Org ${id}`,
      type: overrides.type ?? 'tpa',
      tpaOrgId: overrides.tpaOrgId,
      contactEmail: overrides.contactEmail ?? `org-${id}@example.com`,
      isActive: overrides.isActive ?? true,
      ...overrides,
    })
    .returning();
  return row;
}

export async function createTestUser(
  db: TestDb,
  orgId: string,
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const id = shortId();
  const [row] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user-${id}@example.com`,
      name: overrides.name ?? `Test User ${id}`,
      orgId,
      role: overrides.role ?? 'tpa_admin',
      isActive: overrides.isActive ?? true,
      ...overrides,
    })
    .returning();
  return row;
}
