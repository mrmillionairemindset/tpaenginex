/**
 * Drug Testing Adapter Registry
 *
 * Factory functions to instantiate the correct adapter for a given type
 * or for a specific TPA tenant (based on their configured primary adapter).
 *
 * Each adapter has Live + Mock + Disabled variants. The mode is determined
 * by the DRUG_TESTING_ADAPTER_MODE env var (live | mock | disabled) with
 * per-adapter overrides available.
 */

import type { AdapterConfig, ModuleAdapter } from '@/modules/adapter-interface';
import {
  loadDrugTestingCredentials,
  getPrimaryAdapterType,
  type DrugTestingAdapterType,
  DRUG_TESTING_ADAPTER_TYPES,
} from '@/lib/drug-testing-credentials';
import { EScreenLiveAdapter, EScreenMockAdapter, EScreenDisabledAdapter } from './escreen';
import { FormFoxLiveAdapter, FormFoxMockAdapter, FormFoxDisabledAdapter } from './formfox';
import { CRLLiveAdapter, CRLMockAdapter, CRLDisabledAdapter } from './crl';
import { QuestLiveAdapter, QuestMockAdapter, QuestDisabledAdapter } from './quest';
import { LabCorpLiveAdapter, LabCorpMockAdapter, LabCorpDisabledAdapter } from './labcorp';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'adapter-registry' });

// ============================================================================
// CONSTANTS
// ============================================================================

export const ADAPTER_TYPES = DRUG_TESTING_ADAPTER_TYPES;
export type { DrugTestingAdapterType };

// ============================================================================
// FACTORY
// ============================================================================

type AdapterMode = 'live' | 'mock' | 'disabled';

function getAdapterMode(adapterType?: string): AdapterMode {
  // Per-adapter override: ESCREEN_MODE, FORMFOX_MODE, etc.
  if (adapterType) {
    const envKey = `${adapterType.toUpperCase()}_MODE`;
    const perAdapter = process.env[envKey]?.toLowerCase();
    if (perAdapter === 'live' || perAdapter === 'mock' || perAdapter === 'disabled') {
      return perAdapter;
    }
  }
  // Global fallback
  const global = (process.env.DRUG_TESTING_ADAPTER_MODE ?? 'mock').toLowerCase();
  if (global === 'live' || global === 'mock' || global === 'disabled') {
    return global;
  }
  return 'mock';
}

/**
 * Create an adapter instance for the given type and config.
 * Respects the adapter mode (live/mock/disabled) from env vars.
 */
export function getAdapter(adapterType: DrugTestingAdapterType, config: AdapterConfig): ModuleAdapter {
  const mode = getAdapterMode(adapterType);

  switch (adapterType) {
    case 'escreen':
      if (mode === 'live') return new EScreenLiveAdapter();
      if (mode === 'disabled') return new EScreenDisabledAdapter();
      return new EScreenMockAdapter();

    case 'formfox':
      if (mode === 'live') return new FormFoxLiveAdapter();
      if (mode === 'disabled') return new FormFoxDisabledAdapter();
      return new FormFoxMockAdapter();

    case 'crl':
      if (mode === 'live') return new CRLLiveAdapter();
      if (mode === 'disabled') return new CRLDisabledAdapter();
      return new CRLMockAdapter();

    case 'quest':
      if (mode === 'live') return new QuestLiveAdapter();
      if (mode === 'disabled') return new QuestDisabledAdapter();
      return new QuestMockAdapter();

    case 'labcorp':
      if (mode === 'live') return new LabCorpLiveAdapter();
      if (mode === 'disabled') return new LabCorpDisabledAdapter();
      return new LabCorpMockAdapter();

    default: {
      const _exhaustive: never = adapterType;
      throw new Error(`Unknown adapter type: ${adapterType}`);
    }
  }
}

/**
 * Get an initialized adapter for a specific TPA tenant.
 *
 * Loads the tenant's primary adapter type and credentials from
 * tenant_modules.config, instantiates and initializes the adapter.
 *
 * Returns null if the tenant has no primary adapter configured.
 */
export async function getAdapterForTenant(tpaOrgId: string): Promise<{
  adapter: ModuleAdapter;
  adapterType: DrugTestingAdapterType;
} | null> {
  const adapterType = await getPrimaryAdapterType(tpaOrgId);
  if (!adapterType) {
    log.debug({ tpaOrgId }, 'No primary drug testing adapter configured for tenant');
    return null;
  }

  const creds = await loadDrugTestingCredentials(tpaOrgId, adapterType);

  const config: AdapterConfig = {
    adapterId: adapterType,
    baseUrl: creds?.baseUrl,
    apiKey: creds?.apiKey,
    clientId: creds?.clientId,
    clientSecret: creds?.clientSecret,
    webhookSecret: creds?.webhookSecret,
    accountNumber: creds?.accountNumber,
    sftpHost: creds?.sftpHost,
    sftpPort: creds?.sftpPort,
    sftpUsername: creds?.sftpUsername,
    sftpPassword: creds?.sftpPassword,
    sftpResultsPath: creds?.sftpResultsPath,
  };

  const adapter = getAdapter(adapterType, config);
  await adapter.initialize(config);

  return { adapter, adapterType };
}

/**
 * Get an initialized adapter for a specific type and TPA tenant.
 * Used by the webhook handler when we know which adapter sent the webhook.
 */
export async function getAdapterByTypeForTenant(
  tpaOrgId: string,
  adapterType: DrugTestingAdapterType,
): Promise<ModuleAdapter> {
  const creds = await loadDrugTestingCredentials(tpaOrgId, adapterType);

  const config: AdapterConfig = {
    adapterId: adapterType,
    baseUrl: creds?.baseUrl,
    apiKey: creds?.apiKey,
    clientId: creds?.clientId,
    clientSecret: creds?.clientSecret,
    webhookSecret: creds?.webhookSecret,
    accountNumber: creds?.accountNumber,
    sftpHost: creds?.sftpHost,
    sftpPort: creds?.sftpPort,
    sftpUsername: creds?.sftpUsername,
    sftpPassword: creds?.sftpPassword,
    sftpResultsPath: creds?.sftpResultsPath,
  };

  const adapter = getAdapter(adapterType, config);
  await adapter.initialize(config);
  return adapter;
}

/**
 * Check if an adapter type string is valid.
 */
export function isValidAdapterType(type: string): type is DrugTestingAdapterType {
  return ADAPTER_TYPES.includes(type as DrugTestingAdapterType);
}
