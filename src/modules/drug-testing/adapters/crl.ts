/**
 * CRL Adapter — Clinical Reference Laboratory (REST + HL7v2 inbound)
 *
 * CRL accepts orders via REST API and delivers results via HL7v2 ORU^R01
 * messages pushed to our webhook endpoint. The webhook handler parses
 * the HL7v2 message to extract panel results.
 *
 * Live + Mock + Disabled variants.
 *
 * API flow:
 *   POST /api/orders          — create lab order with requisition details
 *   GET  /api/orders/{id}     — fetch order status
 *   GET  /api/results/{id}    — fetch results (REST alternative to HL7)
 *   Webhook: HL7v2 ORU^R01 message body (Content-Type: x-application/hl7-v2+er7)
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
import {
  parseHL7Results,
  mapObservationIdToPanelType,
  type HL7ParsedResult,
} from '@/lib/hl7-parser';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'crl-adapter' });

// ============================================================================
// CRL API types
// ============================================================================

interface CRLOrderResponse {
  id: string;
  requisition_number: string;
  status: string;
  created_at: string;
  [k: string]: unknown;
}

interface CRLResultResponse {
  id: string;
  requisition_number: string;
  status: string;
  panels: Array<{
    code: string;
    name: string;
    result: string;
    cutoff?: string;
    confirmed?: boolean;
  }>;
  mro_reviewed_at?: string;
  mro_decision?: string;
  reported_at?: string;
  [k: string]: unknown;
}

interface CRLStatusResponse {
  id: string;
  status: string;
  updated_at: string;
  [k: string]: unknown;
}

// ============================================================================
// LIVE ADAPTER
// ============================================================================

export class CRLLiveAdapter extends BaseAdapter {
  private baseUrl = '';
  private apiKey = '';
  private webhookSecret = '';

  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    this.baseUrl = (config.baseUrl as string) || 'https://api.crl-corp.com/api';
    this.apiKey = config.apiKey || '';
    this.webhookSecret = (config.webhookSecret as string) || '';
    if (!this.apiKey) {
      throw new Error('CRL adapter requires an API key');
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
      is_dot: order.isDOT,
      panel_codes: order.panelCodes || [],
      reason_for_test: order.serviceType,
      collection_site: order.collectionSite,
    };

    const result = await adapterRequest<CRLOrderResponse>({
      url: `${this.baseUrl}/orders`,
      method: 'POST',
      headers: { 'X-Api-Key': this.apiKey },
      body,
      adapterId: 'crl',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'CRL order submission failed');
    }

    return {
      externalId: result.data.id,
      externalRef: result.data.requisition_number,
      rawResponse: result.data,
    };
  }

  async fetchResults(externalRef: string): Promise<CanonicalResult> {
    const result = await adapterRequest<CRLResultResponse>({
      url: `${this.baseUrl}/results/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: { 'X-Api-Key': this.apiKey },
      adapterId: 'crl',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'CRL fetch results failed');
    }

    const data = result.data;
    return {
      externalId: data.id,
      orderId: externalRef,
      panelType: data.panels?.[0]?.name || 'drug_screen',
      resultValue: data.panels?.[0]?.result || data.status || 'pending',
      mroReviewedAt: data.mro_reviewed_at ? new Date(data.mro_reviewed_at) : undefined,
      mroDecision: data.mro_decision,
      reportedAt: data.reported_at ? new Date(data.reported_at) : undefined,
      rawData: data,
    };
  }

  async checkStatus(externalRef: string): Promise<StatusUpdate> {
    const result = await adapterRequest<CRLStatusResponse>({
      url: `${this.baseUrl}/orders/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: { 'X-Api-Key': this.apiKey },
      adapterId: 'crl',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'CRL status check failed');
    }

    return {
      externalId: result.data.id,
      status: result.data.status,
      updatedAt: new Date(result.data.updated_at || Date.now()),
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    // CRL sends HL7v2 ORU^R01 messages as the webhook body
    const rawText = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Try HL7 parsing first
    if (typeof payload === 'string' && payload.startsWith('MSH|')) {
      const parsed = parseHL7Results(rawText);
      return mapHL7ToCanonicalEvent(parsed);
    }

    // JSON webhook fallback (some CRL integrations use JSON)
    const p = payload as { event?: string; data?: { id?: string; order_id?: string }; [k: string]: unknown };
    return {
      eventType: p.event || 'results.received',
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
        headers: { 'X-Api-Key': this.apiKey },
        adapterId: 'crl',
        timeoutMs: 10_000,
      });
      return {
        healthy: result.ok,
        latencyMs: Date.now() - start,
        message: result.ok ? 'CRL API reachable' : (result.errorMessage || 'unhealthy'),
        checkedAt: new Date(),
      };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, message: 'CRL health check failed', checkedAt: new Date() };
    }
  }
}

/**
 * Map a parsed HL7v2 result to a CanonicalEvent.
 */
function mapHL7ToCanonicalEvent(parsed: HL7ParsedResult): CanonicalEvent {
  const panels = parsed.observationResults.map((obx) => ({
    panelType: mapObservationIdToPanelType(obx.observationId),
    value: obx.observationValue,
    flags: obx.abnormalFlags,
    status: obx.resultStatus,
  }));

  return {
    eventType: 'hl7.oru_r01',
    externalId: parsed.messageHeader?.messageControlId || '',
    orderId: parsed.observationRequests[0]?.placerOrderNumber,
    payload: {
      patient: parsed.patient,
      panels,
      observationRequests: parsed.observationRequests,
      errors: parsed.errors,
      raw: parsed,
    },
    receivedAt: new Date(),
  };
}

// Re-export for use by webhook handler
export { mapHL7ToCanonicalEvent };

// ============================================================================
// MOCK ADAPTER
// ============================================================================

export interface CRLMockConfig {
  webhookSecret?: string;
  submitFixtures?: Map<string, ExternalRef>;
  resultFixtures?: Map<string, CanonicalResult>;
}

export class CRLMockAdapter extends BaseAdapter {
  private mockConfig: CRLMockConfig;

  constructor(mockConfig: CRLMockConfig = {}) {
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
      externalId: `crl_mock_${order.orderId.slice(0, 8)}`,
      externalRef: `CRL-REQ-${Date.now()}`,
      rawResponse: { mock: true },
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
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    // Try HL7 parsing for mock too
    if (typeof payload === 'string' && payload.startsWith('MSH|')) {
      const parsed = parseHL7Results(payload);
      return mapHL7ToCanonicalEvent(parsed);
    }
    return {
      eventType: 'results.received',
      externalId: 'mock_crl',
      payload,
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

export class CRLDisabledAdapter extends BaseAdapter {
  async submitOrder(_order: CanonicalOrder): Promise<ExternalRef> {
    throw new Error('CRL integration is not enabled for this tenant.');
  }

  async fetchResults(_externalRef: string): Promise<CanonicalResult> {
    throw new Error('CRL integration is not enabled for this tenant.');
  }

  async checkStatus(_externalRef: string): Promise<StatusUpdate> {
    throw new Error('CRL integration is not enabled for this tenant.');
  }

  async handleWebhook(_payload: unknown): Promise<CanonicalEvent> {
    throw new Error('CRL integration is not enabled for this tenant.');
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: false, message: 'CRL adapter disabled', checkedAt: new Date() };
  }
}
