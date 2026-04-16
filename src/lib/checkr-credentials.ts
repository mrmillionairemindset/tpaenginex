/**
 * Per-TPA Checkr credentials loader.
 *
 * Checkr credentials live in `tenant_modules.config` for the
 * `background_screening` module. They are encrypted at rest via encryptAtRest.
 *
 * This module exposes two functions:
 *   - loadCheckrCredentials(tpaOrgId) — called by the Checkr live client
 *     each time it needs to make an API call. Returns null if the module
 *     isn't enabled or credentials aren't configured.
 *   - saveCheckrCredentials(tpaOrgId, creds) — called from the settings UI
 *     to persist new credentials.
 */

import { db } from '@/db/client';
import { tenantModules } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { decryptAtRest, encryptAtRest } from './crypto';
import type { CheckrCredentials } from './checkr-client';

interface BackgroundScreeningConfig {
  checkrApiKeyEnc?: string;
  checkrWebhookSecretEnc?: string;
  checkrDefaultNode?: string;
  [k: string]: unknown;
}

/** Load Checkr credentials from tenant_modules.config (decrypted). Returns null if not configured. */
export async function loadCheckrCredentials(tpaOrgId: string): Promise<CheckrCredentials | null> {
  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'background_screening'),
      eq(tenantModules.isEnabled, true),
    ),
  });
  if (!row?.config) return null;
  const config = row.config as BackgroundScreeningConfig;
  if (!config.checkrApiKeyEnc) return null;
  return {
    apiKey: decryptAtRest(config.checkrApiKeyEnc),
    webhookSecret: config.checkrWebhookSecretEnc ? decryptAtRest(config.checkrWebhookSecretEnc) : '',
    defaultNode: config.checkrDefaultNode,
  };
}

/** Save Checkr credentials (encrypted). Throws if the module isn't enabled for this tenant. */
export async function saveCheckrCredentials(
  tpaOrgId: string,
  creds: { apiKey: string; webhookSecret: string; defaultNode?: string },
): Promise<void> {
  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'background_screening'),
    ),
  });
  if (!row) {
    throw new Error('Background Screening module is not enabled for this tenant');
  }
  const existing = (row.config as BackgroundScreeningConfig | null) ?? {};
  const newConfig: BackgroundScreeningConfig = {
    ...existing,
    checkrApiKeyEnc: encryptAtRest(creds.apiKey),
    checkrWebhookSecretEnc: encryptAtRest(creds.webhookSecret),
    checkrDefaultNode: creds.defaultNode,
  };
  await db
    .update(tenantModules)
    .set({ config: newConfig, updatedAt: new Date() })
    .where(eq(tenantModules.id, row.id));
}

/** Clear Checkr credentials (leaves module enabled). */
export async function clearCheckrCredentials(tpaOrgId: string): Promise<void> {
  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'background_screening'),
    ),
  });
  if (!row) return;
  const existing = (row.config as BackgroundScreeningConfig | null) ?? {};
  const newConfig: BackgroundScreeningConfig = { ...existing };
  delete newConfig.checkrApiKeyEnc;
  delete newConfig.checkrWebhookSecretEnc;
  delete newConfig.checkrDefaultNode;
  await db
    .update(tenantModules)
    .set({ config: newConfig, updatedAt: new Date() })
    .where(eq(tenantModules.id, row.id));
}

/** Lightweight status view — never leaks secret values. */
export async function getCheckrCredentialsStatus(tpaOrgId: string): Promise<{
  configured: boolean;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  defaultNode: string | null;
}> {
  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'background_screening'),
    ),
  });
  const config = (row?.config as BackgroundScreeningConfig | null) ?? null;
  return {
    configured: Boolean(config?.checkrApiKeyEnc),
    hasApiKey: Boolean(config?.checkrApiKeyEnc),
    hasWebhookSecret: Boolean(config?.checkrWebhookSecretEnc),
    defaultNode: config?.checkrDefaultNode ?? null,
  };
}
