/**
 * eScreen Adapter (Abbott — REST via Checkr partnership)
 *
 * eScreen provides electronic chain-of-custody drug testing. Their API
 * accepts order submissions and pushes results back via webhooks.
 *
 * Live + Mock + Disabled variants following the Checkr pattern.
 *
 * API flow:
 *   POST /v1/drug_screenings       — submit a new drug screening order
 *   GET  /v1/drug_screenings/{id}  — fetch status + results
 *   Webhook: drug_screening.completed, drug_screening.collected
 */

import {
  BaseAdapter,
  type AdapterConfig,
  type CanonicalOrder,
  type CanonicalResult,
  type ExternalRef,
  type StatusUpdate,
  type CanonicalEvent,
  type HealthStatus,
} from '@/modules/adapter-interface';
import { verifyHmacSignature, adapterRequest } from './shared';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'escreen-adapter' });

// ============================================================================
// eScreen API types
// ============================================================================

interface EScreenOrderResponse {
  id: string;
  status: string;
  specimen_id?: string;
  site_code?: string;
  created_at?: string;
  [k: string]: unknown;
}

interface EScreenResultResponse {
  id: string;
  status: string;
  result?: string;
  panels?: Array<{
    name: string;
    result: string;
    confirmed?: boolean;
  }>;
  mro_reviewed_at?: string;
  mro_decision?: string;
  reported_at?: string;
  [k: string]: unknown;
}

interface EScreenWebhookPayload {
  type?: string;
  data?: {
    id?: string;
    order_id?: string;
    status?: string;
    result?: string;
    tpa_org_id?: string;
    panels?: Array<{ name: string; result: string }>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

// ============================================================================
// LIVE ADAPTER
// ============================================================================

export class EScreenLiveAdapter extends BaseAdapter {
  private baseUrl = '';
  private apiKey = '';
  private webhookSecret = '';

  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    this.baseUrl = (config.baseUrl as string) || 'https://api.escreen.com/v1';
    this.apiKey = config.apiKey || '';
    this.webhookSecret = (config.webhookSecret as string) || '';
    if (!this.apiKey) {
      throw new Error('eScreen adapter requires an API key');
    }
  }

  async submitOrder(order: CanonicalOrder): Promise<ExternalRef> {
    const body = {
      donor: {
        first_name: order.personFirstName,
        last_name: order.personLastName,
        date_of_birth: order.personDOB,
        external_id: order.personId,
      },
      order_id: order.orderId,
      tpa_org_id: order.tpaOrgId,
      specimen_type: order.serviceType === 'breath_alcohol' ? 'breath' : 'urine',
      panel_codes: order.panelCodes || [],
      is_dot: order.isDOT,
      site_code: order.collectionSite,
      reason_for_test: order.serviceType,
    };

    const result = await adapterRequest<EScreenOrderResponse>({
      url: `${this.baseUrl}/drug_screenings`,
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body,
      adapterId: 'escreen',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'eScreen order submission failed');
    }

    return {
      externalId: result.data.id,
      externalRef: result.data.specimen_id || result.data.id,
      rawResponse: result.data,
    };
  }

  async fetchResults(externalRef: string): Promise<CanonicalResult> {
    const result = await adapterRequest<EScreenResultResponse>({
      url: `${this.baseUrl}/drug_screenings/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      adapterId: 'escreen',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'eScreen fetch results failed');
    }

    const data = result.data;
    return {
      externalId: data.id,
      orderId: externalRef,
      panelType: data.panels?.[0]?.name || 'drug_screen',
      resultValue: data.result || data.status || 'pending',
      mroReviewedAt: data.mro_reviewed_at ? new Date(data.mro_reviewed_at) : undefined,
      mroDecision: data.mro_decision,
      reportedAt: data.reported_at ? new Date(data.reported_at) : undefined,
      rawData: data,
    };
  }

  async checkStatus(externalRef: string): Promise<StatusUpdate> {
    const result = await adapterRequest<EScreenResultResponse>({
      url: `${this.baseUrl}/drug_screenings/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      adapterId: 'escreen',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'eScreen status check failed');
    }

    return {
      externalId: result.data.id,
      status: result.data.status,
      updatedAt: new Date(),
      details: result.data.result,
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    const p = payload as EScreenWebhookPayload;
    return {
      eventType: p.type || 'unknown',
      externalId: p.data?.id || '',
      orderId: p.data?.order_id,
      payload: p,
      receivedAt: new Date(),
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return verifyHmacSignature(rawBody, this.webhookSecret, signature);
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const result = await adapterRequest<unknown>({
        url: `${this.baseUrl}/health`,
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        adapterId: 'escreen',
        timeoutMs: 10_000,
      });
      return {
        healthy: result.ok,
        latencyMs: Date.now() - start,
        message: result.ok ? 'eScreen API reachable' : (result.errorMessage || 'unhealthy'),
        checkedAt: new Date(),
      };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, message: 'eScreen health check failed', checkedAt: new Date() };
    }
  }
}

// ============================================================================
// MOCK ADAPTER
// ============================================================================

export interface EScreenMockConfig {
  webhookSecret?: string;
  submitFixtures?: Map<string, ExternalRef>;
  resultFixtures?: Map<string, CanonicalResult>;
}

export class EScreenMockAdapter extends BaseAdapter {
  private mockConfig: EScreenMockConfig;

  constructor(mockConfig: EScreenMockConfig = {}) {
    super();
    this.mockConfig = mockConfig;
  }

  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
  }

  async submitOrder(order: CanonicalOrder): Promise<ExternalRef> {
    if (this.mockConfig.submitFixtures?.has(order.orderId)) {
      return this.mockConfig.submitFixtures.get(order.orderId)!;
    }
    return {
      externalId: `es_mock_${order.orderId.slice(0, 8)}`,
      externalRef: `ES-${Date.now()}`,
      rawResponse: { mock: true, orderId: order.orderId },
    };
  }

  async fetchResults(externalRef: string): Promise<CanonicalResult> {
    if (this.mockConfig.resultFixtures?.has(externalRef)) {
      return this.mockConfig.resultFixtures.get(externalRef)!;
    }
    return {
      externalId: externalRef,
      orderId: externalRef,
      panelType: '5-panel',
      resultValue: 'negative',
      reportedAt: new Date(),
      rawData: { mock: true },
    };
  }

  async checkStatus(externalRef: string): Promise<StatusUpdate> {
    return {
      externalId: externalRef,
      status: 'completed',
      updatedAt: new Date(),
      details: 'Mock: results available',
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    const p = payload as EScreenWebhookPayload;
    return {
      eventType: p.type || 'drug_screening.completed',
      externalId: p.data?.id || 'mock_id',
      orderId: p.data?.order_id,
      payload: p,
      receivedAt: new Date(),
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.mockConfig.webhookSecret) return false;
    return verifyHmacSignature(rawBody, this.mockConfig.webhookSecret, signature);
  }
}

// ============================================================================
// DISABLED ADAPTER
// ============================================================================

export class EScreenDisabledAdapter extends BaseAdapter {
  async submitOrder(_order: CanonicalOrder): Promise<ExternalRef> {
    throw new Error('eScreen integration is not enabled for this tenant. Enable it in Settings > Drug Testing > Lab Integrations.');
  }

  async fetchResults(_externalRef: string): Promise<CanonicalResult> {
    throw new Error('eScreen integration is not enabled for this tenant.');
  }

  async checkStatus(_externalRef: string): Promise<StatusUpdate> {
    throw new Error('eScreen integration is not enabled for this tenant.');
  }

  async handleWebhook(_payload: unknown): Promise<CanonicalEvent> {
    throw new Error('eScreen integration is not enabled for this tenant.');
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: false, message: 'eScreen adapter disabled', checkedAt: new Date() };
  }
}
