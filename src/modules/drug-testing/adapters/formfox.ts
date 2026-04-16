/**
 * FormFox Adapter (REST + eCCF generation)
 *
 * FormFox provides electronic chain-of-custody form (eCCF) management.
 * Orders create an eCCF with barcode, and results flow back via webhooks
 * when collection completes and when lab results are ready.
 *
 * Live + Mock + Disabled variants.
 *
 * API flow:
 *   POST /api/v2/orders        — create order + eCCF
 *   GET  /api/v2/orders/{id}   — fetch eCCF status + results
 *   GET  /api/v2/orders/{id}/status — quick status check
 *   Webhook events: ccf.collected, results.ready, order.cancelled
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

const log = logger.child({ component: 'formfox-adapter' });

// ============================================================================
// FormFox API types
// ============================================================================

interface FormFoxOrderResponse {
  id: string;
  eccf_number: string;
  barcode: string;
  eccf_pdf_url?: string;
  status: string;
  created_at: string;
  [k: string]: unknown;
}

interface FormFoxResultResponse {
  id: string;
  eccf_number: string;
  status: string;
  collection_status?: string;
  lab_status?: string;
  result?: string;
  panels?: Array<{
    name: string;
    result: string;
    confirmed?: boolean;
    cutoff?: string;
  }>;
  mro_reviewed_at?: string;
  mro_decision?: string;
  reported_at?: string;
  [k: string]: unknown;
}

interface FormFoxWebhookPayload {
  event?: string;
  data?: {
    id?: string;
    eccf_number?: string;
    order_id?: string;
    status?: string;
    result?: string;
    tpa_org_id?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

// ============================================================================
// LIVE ADAPTER
// ============================================================================

export class FormFoxLiveAdapter extends BaseAdapter {
  private baseUrl = '';
  private apiKey = '';
  private clientId = '';
  private clientSecret = '';
  private webhookSecret = '';

  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    this.baseUrl = (config.baseUrl as string) || 'https://api.formfox.com/api/v2';
    this.apiKey = config.apiKey || '';
    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.webhookSecret = (config.webhookSecret as string) || '';
    if (!this.apiKey && !this.clientId) {
      throw new Error('FormFox adapter requires an API key or client credentials');
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (this.apiKey) {
      return { Authorization: `Bearer ${this.apiKey}` };
    }
    // Basic auth with client credentials
    const encoded = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
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
      is_dot: order.isDOT,
      panel_codes: order.panelCodes || [],
      reason_for_test: order.serviceType,
      collection_site: order.collectionSite,
    };

    const result = await adapterRequest<FormFoxOrderResponse>({
      url: `${this.baseUrl}/orders`,
      method: 'POST',
      headers: this.getAuthHeaders(),
      body,
      adapterId: 'formfox',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'FormFox order submission failed');
    }

    return {
      externalId: result.data.id,
      externalRef: result.data.eccf_number,
      rawResponse: {
        ...result.data,
        eccfPdfUrl: result.data.eccf_pdf_url,
        barcode: result.data.barcode,
      },
    };
  }

  async fetchResults(externalRef: string): Promise<CanonicalResult> {
    const result = await adapterRequest<FormFoxResultResponse>({
      url: `${this.baseUrl}/orders/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: this.getAuthHeaders(),
      adapterId: 'formfox',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'FormFox fetch results failed');
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
    const result = await adapterRequest<FormFoxResultResponse>({
      url: `${this.baseUrl}/orders/${encodeURIComponent(externalRef)}/status`,
      method: 'GET',
      headers: this.getAuthHeaders(),
      adapterId: 'formfox',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'FormFox status check failed');
    }

    return {
      externalId: result.data.id,
      status: result.data.status,
      updatedAt: new Date(),
      details: result.data.collection_status || result.data.lab_status,
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    const p = payload as FormFoxWebhookPayload;
    return {
      eventType: p.event || 'unknown',
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
        headers: this.getAuthHeaders(),
        adapterId: 'formfox',
        timeoutMs: 10_000,
      });
      return {
        healthy: result.ok,
        latencyMs: Date.now() - start,
        message: result.ok ? 'FormFox API reachable' : (result.errorMessage || 'unhealthy'),
        checkedAt: new Date(),
      };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, message: 'FormFox health check failed', checkedAt: new Date() };
    }
  }
}

// ============================================================================
// MOCK ADAPTER
// ============================================================================

export interface FormFoxMockConfig {
  webhookSecret?: string;
  submitFixtures?: Map<string, ExternalRef>;
  resultFixtures?: Map<string, CanonicalResult>;
}

export class FormFoxMockAdapter extends BaseAdapter {
  private mockConfig: FormFoxMockConfig;

  constructor(mockConfig: FormFoxMockConfig = {}) {
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
    const eccfNumber = `ECCF-${Date.now().toString(36).toUpperCase()}`;
    return {
      externalId: `ff_mock_${order.orderId.slice(0, 8)}`,
      externalRef: eccfNumber,
      rawResponse: {
        mock: true,
        eccfPdfUrl: `https://formfox.mock/eccf/${eccfNumber}.pdf`,
        barcode: `BC${Date.now()}`,
      },
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
      status: 'results_ready',
      updatedAt: new Date(),
      details: 'Mock: collection complete, results available',
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    const p = payload as FormFoxWebhookPayload;
    return {
      eventType: p.event || 'results.ready',
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

export class FormFoxDisabledAdapter extends BaseAdapter {
  async submitOrder(_order: CanonicalOrder): Promise<ExternalRef> {
    throw new Error('FormFox integration is not enabled for this tenant. Enable it in Settings > Drug Testing > Lab Integrations.');
  }

  async fetchResults(_externalRef: string): Promise<CanonicalResult> {
    throw new Error('FormFox integration is not enabled for this tenant.');
  }

  async checkStatus(_externalRef: string): Promise<StatusUpdate> {
    throw new Error('FormFox integration is not enabled for this tenant.');
  }

  async handleWebhook(_payload: unknown): Promise<CanonicalEvent> {
    throw new Error('FormFox integration is not enabled for this tenant.');
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: false, message: 'FormFox adapter disabled', checkedAt: new Date() };
  }
}
