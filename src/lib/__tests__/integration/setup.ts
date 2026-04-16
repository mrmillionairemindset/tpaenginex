/**
 * Integration test setup: starts a real Postgres 16 container via Testcontainers,
 * pushes the Drizzle schema against it, and exposes `testDb` / `getTestDb()` to
 * the test suite.
 *
 * If Docker is not available (CI without dockerd, sandboxed dev machine), the
 * helpers expose `dockerAvailable = false` and describe.skipIf is used in the
 * suites so the run does not fail. The message is printed once during setup.
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { execSync } from 'child_process';
import path from 'path';
import * as schema from '@/db/schema';

type TestDb = PostgresJsDatabase<typeof schema>;

export interface IntegrationContext {
  container: StartedPostgreSqlContainer;
  sql: ReturnType<typeof postgres>;
  db: TestDb;
  url: string;
}

let context: IntegrationContext | null = null;
let attemptedStart = false;
let startupError: Error | null = null;

/**
 * True when Docker + testcontainers can spin up a container. Checked lazily
 * on the first call to `ensureIntegrationContext()`. Suites use this via
 * `describe.skipIf(!dockerAvailable)` to skip cleanly on machines without Docker.
 */
export let dockerAvailable = false;

/**
 * Start the container (if not already started) and push the schema.
 * Returns the shared context. Safe to call from multiple describe blocks.
 */
export async function ensureIntegrationContext(): Promise<IntegrationContext | null> {
  if (context) return context;
  if (attemptedStart) return null;
  attemptedStart = true;

  try {
    const container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('tpaenginex_test')
      .withUsername('testuser')
      .withPassword('testpass')
      .start();

    const url = container.getConnectionUri();

    // Run `drizzle-kit push` against the ephemeral database to materialize the schema.
    // Using the CLI (rather than the SQL files directly) keeps the test DB exactly
    // aligned with the current schema.ts regardless of migration file history.
    const projectRoot = path.resolve(__dirname, '../../../..');
    execSync('npx drizzle-kit push --force', {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });

    const sql = postgres(url, { max: 5 });
    const db = drizzle(sql, { schema });

    context = { container, sql, db, url };
    dockerAvailable = true;
    return context;
  } catch (err) {
    startupError = err instanceof Error ? err : new Error(String(err));
    // Most common: Docker daemon not running / not installed.
    // eslint-disable-next-line no-console
    console.warn(
      `[integration-setup] Skipping integration tests — could not start Postgres container: ${startupError.message}`,
    );
    dockerAvailable = false;
    return null;
  }
}

export function getTestDb(): TestDb {
  if (!context) {
    throw new Error('Integration context not initialized — call ensureIntegrationContext() in beforeAll.');
  }
  return context.db;
}

export function getTestSql(): ReturnType<typeof postgres> {
  if (!context) {
    throw new Error('Integration context not initialized — call ensureIntegrationContext() in beforeAll.');
  }
  return context.sql;
}

export async function teardownIntegrationContext(): Promise<void> {
  if (!context) return;
  try {
    await context.sql.end({ timeout: 5 });
  } catch {
    // ignore
  }
  try {
    await context.container.stop();
  } catch {
    // ignore
  }
  context = null;
}

/**
 * Truncate all data between tests so state does not leak. Keeps the schema.
 * Call this in `beforeEach` when the test suite depends on a clean slate.
 */
export async function resetTestData(): Promise<void> {
  if (!context) return;
  // Truncate everything in the public schema that has rows — simple and fast.
  const sql = context.sql;
  await sql.unsafe(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename NOT LIKE 'drizzle_%'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
}
