/**
 * Quest Diagnostics Adapter (REST)
 *
 * Quest is one of the largest clinical labs in the US. Their drug testing
 * API accepts orders with requisition numbers and pushes results back
 * via webhooks.
 *
 * Live + Mock + Disabled variants.
 *
 * API flow:
 *   POST /api/v1/drug-tests           — submit order with requisition
 *   GET  /api/v1/drug-tests/{id}      — fetch status + results
 *   GET  /api/v1/results/{reqNumber}  — fetch by requisition number
 *   Webhook events: result.available, order.collected, order.cancelled
 *
 * Quest-specific: requires account number + PSC site codes for Patient
 * Service Center collections.
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

const log = logger.child({ component: 'quest-adapter' });

// ============================================================================
// Quest API types
// ============================================================================

interface QuestOrderResponse {
  id: string;
  requisition_number: string;
  account_number: string;
  status: string;
  psc_site_code?: string;
  created_at: string;
  [k: string]: unknown;
}

interface QuestResultResponse {
  id: string;
  requisition_number: string;
  status: string;
  overall_result?: string;
  panels: Array<{
    code: string;
    name: string;
    result: string;
    cutoff_level?: string;
    confirmed?: boolean;
  }>;
  mro_reviewed_at?: string;
  mro_decision?: string;
  reported_at?: string;
  specimen_received_at?: string;
  [k: string]: unknown;
}

interface QuestWebhookPayload {
  event_type?: string;
  data?: {
    id?: string;
    requisition_number?: string;
    order_id?: string;
    account_number?: string;
    status?: string;
    result?: string;
    tpa_org_id?: string;
    [k: string]: unknown;
  };
  signature_timestamp?: string;
  [k: string]: unknown;
}

// ============================================================================
// LIVE ADAPTER
// ============================================================================

export class QuestLiveAdapter extends BaseAdapter {
  private baseUrl = '';
  private apiKey = '';
  private accountNumber = '';
  private webhookSecret = '';

  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    this.baseUrl = (config.baseUrl as string) || 'https://api.questdiagnostics.com/api/v1';
    this.apiKey = config.apiKey || '';
    this.accountNumber = (config.accountNumber as string) || '';
    this.webhookSecret = (config.webhookSecret as string) || '';
    if (!this.apiKey) {
      throw new Error('Quest adapter requires an API key');
    }
  }

  async submitOrder(order: CanonicalOrder): Promise<ExternalRef> {
    const body = {
      patient: {
        first_name: order.personFirstName,
        last_name: order.personLastName,
        date_of_birth: order.personDOB,
        external_id: order.personId,
      },
      order_id: order.orderId,
      tpa_org_id: order.tpaOrgId,
      account_number: this.accountNumber || (order as Record<string, unknown>).accountNumber,
      is_dot: order.isDOT,
      panel_codes: order.panelCodes || [],
      reason_for_test: order.serviceType,
      psc_site_code: order.collectionSite,
    };

    const result = await adapterRequest<QuestOrderResponse>({
      url: `${this.baseUrl}/drug-tests`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'X-Account-Number': this.accountNumber,
      },
      body,
      adapterId: 'quest',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'Quest order submission failed');
    }

    return {
      externalId: result.data.id,
      externalRef: result.data.requisition_number,
      rawResponse: result.data,
    };
  }

  async fetchResults(externalRef: string): Promise<CanonicalResult> {
    const result = await adapterRequest<QuestResultResponse>({
      url: `${this.baseUrl}/results/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'X-Account-Number': this.accountNumber,
      },
      adapterId: 'quest',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'Quest fetch results failed');
    }

    const data = result.data;
    return {
      externalId: data.id,
      orderId: externalRef,
      panelType: data.panels?.[0]?.name || 'drug_screen',
      resultValue: data.overall_result || data.panels?.[0]?.result || 'pending',
      mroReviewedAt: data.mro_reviewed_at ? new Date(data.mro_reviewed_at) : undefined,
      mroDecision: data.mro_decision,
      reportedAt: data.reported_at ? new Date(data.reported_at) : undefined,
      rawData: data,
    };
  }

  async checkStatus(externalRef: string): Promise<StatusUpdate> {
    const result = await adapterRequest<QuestResultResponse>({
      url: `${this.baseUrl}/drug-tests/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'X-Account-Number': this.accountNumber,
      },
      adapterId: 'quest',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'Quest status check failed');
    }

    return {
      externalId: result.data.id,
      status: result.data.status,
      updatedAt: new Date(),
      details: result.data.overall_result,
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    const p = payload as QuestWebhookPayload;
    return {
      eventType: p.event_type || 'unknown',
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
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'X-Account-Number': this.accountNumber,
        },
        adapterId: 'quest',
        timeoutMs: 10_000,
      });
      return {
        healthy: result.ok,
        latencyMs: Date.now() - start,
        message: result.ok ? 'Quest API reachable' : (result.errorMessage || 'unhealthy'),
        checkedAt: new Date(),
      };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, message: 'Quest health check failed', checkedAt: new Date() };
    }
  }
}

// ============================================================================
// MOCK ADAPTER
// ============================================================================

export interface QuestMockConfig {
  webhookSecret?: string;
  submitFixtures?: Map<string, ExternalRef>;
  resultFixtures?: Map<string, CanonicalResult>;
}

export class QuestMockAdapter extends BaseAdapter {
  private mockConfig: QuestMockConfig;

  constructor(mockConfig: QuestMockConfig = {}) {
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
      externalId: `quest_mock_${order.orderId.slice(0, 8)}`,
      externalRef: `QD-${Date.now()}`,
      rawResponse: { mock: true, accountNumber: 'MOCK-ACCT' },
    };
  }

  async fetchResults(externalRef: string): Promise<CanonicalResult> {
    if (this.mockConfig.resultFixtures?.has(externalRef)) {
      return this.mockConfig.resultFixtures.get(externalRef)!;
    }
    return {
      externalId: externalRef,
      orderId: externalRef,
      panelType: '10-panel',
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
      details: 'Mock: all panels negative',
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    const p = payload as QuestWebhookPayload;
    return {
      eventType: p.event_type || 'result.available',
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

export class QuestDisabledAdapter extends BaseAdapter {
  async submitOrder(_order: CanonicalOrder): Promise<ExternalRef> {
    throw new Error('Quest Diagnostics integration is not enabled for this tenant.');
  }

  async fetchResults(_externalRef: string): Promise<CanonicalResult> {
    throw new Error('Quest Diagnostics integration is not enabled for this tenant.');
  }

  async checkStatus(_externalRef: string): Promise<StatusUpdate> {
    throw new Error('Quest Diagnostics integration is not enabled for this tenant.');
  }

  async handleWebhook(_payload: unknown): Promise<CanonicalEvent> {
    throw new Error('Quest Diagnostics integration is not enabled for this tenant.');
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: false, message: 'Quest adapter disabled', checkedAt: new Date() };
  }
}
