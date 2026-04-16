/**
 * Per-TPA Drug Testing adapter credentials manager.
 *
 * Drug testing credentials live in `tenant_modules.config` for the
 * `drug_testing` module. They are encrypted at rest via encryptAtRest.
 *
 * Supports five adapter types: escreen, formfox, crl, quest, labcorp.
 * Each TPA tenant may configure one or more lab adapters with separate
 * credentials stored in the same config blob.
 */

import { db } from '@/db/client';
import { tenantModules } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { decryptAtRest, encryptAtRest } from './crypto';

// ============================================================================
// TYPES
// ============================================================================

export const DRUG_TESTING_ADAPTER_TYPES = ['escreen', 'formfox', 'crl', 'quest', 'labcorp'] as const;
export type DrugTestingAdapterType = (typeof DRUG_TESTING_ADAPTER_TYPES)[number];

export interface DrugTestingAdapterCredentials {
  apiKey: string;
  webhookSecret: string;
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  accountNumber?: string;
  /** SFTP credentials (LabCorp) */
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  sftpPassword?: string;
  sftpResultsPath?: string;
  /** Additional adapter-specific fields */
  [key: string]: unknown;
}

/** Shape of the drug_testing config blob in tenant_modules.config */
export interface DrugTestingModuleConfig {
  /** Which adapter this TPA uses as their primary lab */
  primaryAdapter?: DrugTestingAdapterType;
  /** Per-adapter encrypted credentials */
  adapters?: {
    [K in DrugTestingAdapterType]?: {
      apiKeyEnc?: string;
      webhookSecretEnc?: string;
      baseUrl?: string;
      clientIdEnc?: string;
      clientSecretEnc?: string;
      accountNumber?: string;
      sftpHost?: string;
      sftpPort?: number;
      sftpUsernameEnc?: string;
      sftpPasswordEnc?: string;
      sftpResultsPath?: string;
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

// ============================================================================
// LOAD
// ============================================================================

/**
 * Load drug testing adapter credentials for a TPA tenant.
 * Returns null if the module is not enabled or the adapter is not configured.
 */
export async function loadDrugTestingCredentials(
  tpaOrgId: string,
  adapterType: DrugTestingAdapterType,
): Promise<DrugTestingAdapterCredentials | null> {
  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'drug_testing'),
      eq(tenantModules.isEnabled, true),
    ),
  });
  if (!row?.config) return null;

  const config = row.config as DrugTestingModuleConfig;
  const adapterConfig = config.adapters?.[adapterType];
  if (!adapterConfig?.apiKeyEnc) return null;

  return {
    apiKey: decryptAtRest(adapterConfig.apiKeyEnc),
    webhookSecret: adapterConfig.webhookSecretEnc ? decryptAtRest(adapterConfig.webhookSecretEnc) : '',
    baseUrl: adapterConfig.baseUrl,
    clientId: adapterConfig.clientIdEnc ? decryptAtRest(adapterConfig.clientIdEnc) : undefined,
    clientSecret: adapterConfig.clientSecretEnc ? decryptAtRest(adapterConfig.clientSecretEnc) : undefined,
    accountNumber: adapterConfig.accountNumber,
    sftpHost: adapterConfig.sftpHost,
    sftpPort: adapterConfig.sftpPort,
    sftpUsername: adapterConfig.sftpUsernameEnc ? decryptAtRest(adapterConfig.sftpUsernameEnc) : undefined,
    sftpPassword: adapterConfig.sftpPasswordEnc ? decryptAtRest(adapterConfig.sftpPasswordEnc) : undefined,
    sftpResultsPath: adapterConfig.sftpResultsPath,
  };
}

// ============================================================================
// SAVE
// ============================================================================

/**
 * Save drug testing adapter credentials (encrypted).
 * Merges into the existing config blob — does not overwrite other adapters.
 * Throws if the drug_testing module is not enabled for this tenant.
 */
export async function saveDrugTestingCredentials(
  tpaOrgId: string,
  adapterType: DrugTestingAdapterType,
  creds: DrugTestingAdapterCredentials,
): Promise<void> {
  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'drug_testing'),
    ),
  });
  if (!row) {
    throw new Error('Drug Testing module is not enabled for this tenant');
  }

  const existing = (row.config as DrugTestingModuleConfig | null) ?? {};
  const existingAdapters = existing.adapters ?? {};

  const encryptedAdapterConfig = {
    ...existingAdapters[adapterType],
    apiKeyEnc: encryptAtRest(creds.apiKey),
    webhookSecretEnc: encryptAtRest(creds.webhookSecret),
    baseUrl: creds.baseUrl,
    clientIdEnc: creds.clientId ? encryptAtRest(creds.clientId) : undefined,
    clientSecretEnc: creds.clientSecret ? encryptAtRest(creds.clientSecret) : undefined,
    accountNumber: creds.accountNumber,
    sftpHost: creds.sftpHost,
    sftpPort: creds.sftpPort,
    sftpUsernameEnc: creds.sftpUsername ? encryptAtRest(creds.sftpUsername) : undefined,
    sftpPasswordEnc: creds.sftpPassword ? encryptAtRest(creds.sftpPassword) : undefined,
    sftpResultsPath: creds.sftpResultsPath,
  };

  const newConfig: DrugTestingModuleConfig = {
    ...existing,
    adapters: {
      ...existingAdapters,
      [adapterType]: encryptedAdapterConfig,
    },
  };

  await db
    .update(tenantModules)
    .set({ config: newConfig, updatedAt: new Date() })
    .where(eq(tenantModules.id, row.id));
}

// ============================================================================
// STATUS
// ============================================================================

/**
 * Get the primary adapter type for a TPA tenant.
 * Returns null if no primary adapter is configured.
 */
export async function getPrimaryAdapterType(
  tpaOrgId: string,
): Promise<DrugTestingAdapterType | null> {
  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'drug_testing'),
      eq(tenantModules.isEnabled, true),
    ),
  });
  if (!row?.config) return null;
  const config = row.config as DrugTestingModuleConfig;
  return config.primaryAdapter ?? null;
}

/**
 * Lightweight credential status — never leaks secret values.
 */
export async function getDrugTestingCredentialsStatus(
  tpaOrgId: string,
  adapterType: DrugTestingAdapterType,
): Promise<{
  configured: boolean;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  baseUrl: string | null;
}> {
  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'drug_testing'),
    ),
  });
  const config = (row?.config as DrugTestingModuleConfig | null) ?? null;
  const adapterConfig = config?.adapters?.[adapterType];
  return {
    configured: Boolean(adapterConfig?.apiKeyEnc),
    hasApiKey: Boolean(adapterConfig?.apiKeyEnc),
    hasWebhookSecret: Boolean(adapterConfig?.webhookSecretEnc),
    baseUrl: adapterConfig?.baseUrl ?? null,
  };
}
