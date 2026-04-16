/**
 * LabCorp Adapter (SFTP + REST hybrid)
 *
 * LabCorp accepts orders via REST API but delivers results via SFTP push
 * (pipe-delimited or HL7 formatted files). The "webhook" for LabCorp is
 * actually a file-drop processor that reads from an SFTP directory.
 *
 * SFTP is optional — if ssh2-sftp-client is not installed, the adapter
 * uses REST-only mode. SFTP can be added later as an enhancement.
 *
 * Live + Mock + Disabled variants.
 *
 * API flow:
 *   POST /api/v1/orders            — create lab order
 *   GET  /api/v1/orders/{id}       — fetch order status
 *   GET  /api/v1/results/{id}      — fetch results (REST fallback)
 *   SFTP: poll results directory for new .hl7 or .csv files
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
import { parseHL7Results, mapObservationIdToPanelType } from '@/lib/hl7-parser';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'labcorp-adapter' });

// ============================================================================
// LabCorp API types
// ============================================================================

interface LabCorpOrderResponse {
  id: string;
  accession_number: string;
  requisition_number: string;
  status: string;
  created_at: string;
  [k: string]: unknown;
}

interface LabCorpResultResponse {
  id: string;
  accession_number: string;
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
  [k: string]: unknown;
}

interface LabCorpWebhookPayload {
  event?: string;
  data?: {
    id?: string;
    accession_number?: string;
    order_id?: string;
    tpa_org_id?: string;
    status?: string;
    result?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/** Parsed result from LabCorp's SFTP pipe-delimited result format */
export interface LabCorpSftpResult {
  accessionNumber: string;
  requisitionNumber: string;
  patientId: string;
  patientLastName: string;
  patientFirstName: string;
  collectionDate: string;
  panels: Array<{
    code: string;
    name: string;
    result: string;
    cutoff: string;
    confirmed: boolean;
  }>;
  overallResult: string;
  reportedAt: string;
}

// ============================================================================
// SFTP RESULT FILE PARSER
// ============================================================================

/**
 * Parse LabCorp's pipe-delimited result file format.
 *
 * Format (one result per line):
 *   ACCESSION|REQUISITION|PATIENT_ID|LAST_NAME|FIRST_NAME|COLLECTION_DATE|
 *   PANEL_CODE|PANEL_NAME|RESULT|CUTOFF|CONFIRMED|OVERALL_RESULT|REPORTED_AT
 *
 * Lines starting with # are comments/headers.
 * Empty lines are skipped.
 */
export function parseSftpResultFile(content: string): LabCorpSftpResult[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('#'));
  const resultsByAccession = new Map<string, LabCorpSftpResult>();

  for (const line of lines) {
    const fields = line.split('|');
    if (fields.length < 13) {
      log.warn({ fieldCount: fields.length, line: line.slice(0, 100) }, 'Skipping malformed LabCorp result line');
      continue;
    }

    const [
      accession, requisition, patientId, lastName, firstName, collectionDate,
      panelCode, panelName, result, cutoff, confirmed, overallResult, reportedAt,
    ] = fields;

    const existing = resultsByAccession.get(accession) || {
      accessionNumber: accession,
      requisitionNumber: requisition,
      patientId,
      patientLastName: lastName,
      patientFirstName: firstName,
      collectionDate,
      panels: [],
      overallResult: overallResult || 'pending',
      reportedAt: reportedAt || '',
    };

    existing.panels.push({
      code: panelCode,
      name: panelName,
      result,
      cutoff: cutoff || '',
      confirmed: confirmed?.toLowerCase() === 'true' || confirmed === '1',
    });

    // Update overall result if this line has one
    if (overallResult) {
      existing.overallResult = overallResult;
    }
    if (reportedAt) {
      existing.reportedAt = reportedAt;
    }

    resultsByAccession.set(accession, existing);
  }

  return Array.from(resultsByAccession.values());
}

// ============================================================================
// LIVE ADAPTER
// ============================================================================

export class LabCorpLiveAdapter extends BaseAdapter {
  private baseUrl = '';
  private apiKey = '';
  private webhookSecret = '';
  // SFTP config — optional enhancement
  private sftpHost = '';
  private sftpPort = 22;
  private sftpUsername = '';
  private sftpPassword = '';
  private sftpResultsPath = '/results';

  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    this.baseUrl = (config.baseUrl as string) || 'https://api.labcorp.com/api/v1';
    this.apiKey = config.apiKey || '';
    this.webhookSecret = (config.webhookSecret as string) || '';
    this.sftpHost = (config.sftpHost as string) || '';
    this.sftpPort = (config.sftpPort as number) || 22;
    this.sftpUsername = (config.sftpUsername as string) || '';
    this.sftpPassword = (config.sftpPassword as string) || '';
    this.sftpResultsPath = (config.sftpResultsPath as string) || '/results';
    if (!this.apiKey) {
      throw new Error('LabCorp adapter requires an API key');
    }
  }

  get hasSftpConfig(): boolean {
    return Boolean(this.sftpHost && this.sftpUsername);
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

    const result = await adapterRequest<LabCorpOrderResponse>({
      url: `${this.baseUrl}/orders`,
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body,
      adapterId: 'labcorp',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'LabCorp order submission failed');
    }

    return {
      externalId: result.data.id,
      externalRef: result.data.accession_number || result.data.requisition_number,
      rawResponse: result.data,
    };
  }

  async fetchResults(externalRef: string): Promise<CanonicalResult> {
    // REST fallback — always available
    const result = await adapterRequest<LabCorpResultResponse>({
      url: `${this.baseUrl}/results/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      adapterId: 'labcorp',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'LabCorp fetch results failed');
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
    const result = await adapterRequest<LabCorpOrderResponse>({
      url: `${this.baseUrl}/orders/${encodeURIComponent(externalRef)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      adapterId: 'labcorp',
    });

    if (!result.ok || !result.data) {
      throw new Error(result.errorMessage || 'LabCorp status check failed');
    }

    return {
      externalId: result.data.id,
      status: result.data.status,
      updatedAt: new Date(),
    };
  }

  /**
   * Handle inbound result data. For LabCorp, the "webhook" is typically an
   * SFTP file drop that our polling job reads and passes here. Can also
   * handle JSON webhook payloads or HL7v2 messages.
   */
  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    // HL7v2 message (SFTP file contents)
    if (typeof payload === 'string' && payload.startsWith('MSH|')) {
      const parsed = parseHL7Results(payload);
      return {
        eventType: 'sftp.hl7_result',
        externalId: parsed.messageHeader?.messageControlId || '',
        orderId: parsed.observationRequests[0]?.placerOrderNumber,
        payload: {
          patient: parsed.patient,
          panels: parsed.observationResults.map((obx) => ({
            panelType: mapObservationIdToPanelType(obx.observationId),
            value: obx.observationValue,
            flags: obx.abnormalFlags,
          })),
          errors: parsed.errors,
        },
        receivedAt: new Date(),
      };
    }

    // Pipe-delimited SFTP result file
    if (typeof payload === 'string' && !payload.startsWith('{')) {
      const results = parseSftpResultFile(payload);
      return {
        eventType: 'sftp.csv_result',
        externalId: results[0]?.accessionNumber || '',
        orderId: results[0]?.requisitionNumber,
        payload: { results, resultCount: results.length },
        receivedAt: new Date(),
      };
    }

    // JSON webhook (if LabCorp sends one)
    const p = payload as LabCorpWebhookPayload;
    return {
      eventType: p.event || 'results.received',
      externalId: p.data?.id || p.data?.accession_number || '',
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
        adapterId: 'labcorp',
        timeoutMs: 10_000,
      });
      const hasSftp = this.hasSftpConfig;
      return {
        healthy: result.ok,
        latencyMs: Date.now() - start,
        message: result.ok
          ? `LabCorp API reachable${hasSftp ? ' (SFTP configured)' : ' (REST-only, SFTP not configured)'}`
          : (result.errorMessage || 'unhealthy'),
        checkedAt: new Date(),
      };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, message: 'LabCorp health check failed', checkedAt: new Date() };
    }
  }
}

// ============================================================================
// MOCK ADAPTER
// ============================================================================

export interface LabCorpMockConfig {
  webhookSecret?: string;
  submitFixtures?: Map<string, ExternalRef>;
  resultFixtures?: Map<string, CanonicalResult>;
}

export class LabCorpMockAdapter extends BaseAdapter {
  private mockConfig: LabCorpMockConfig;

  constructor(mockConfig: LabCorpMockConfig = {}) {
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
      externalId: `lc_mock_${order.orderId.slice(0, 8)}`,
      externalRef: `LC-${Date.now()}`,
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
    };
  }

  async handleWebhook(payload: unknown): Promise<CanonicalEvent> {
    // Handle HL7 and pipe-delimited in mock too (uses real parsers)
    if (typeof payload === 'string' && payload.startsWith('MSH|')) {
      const parsed = parseHL7Results(payload);
      return {
        eventType: 'sftp.hl7_result',
        externalId: parsed.messageHeader?.messageControlId || '',
        orderId: parsed.observationRequests[0]?.placerOrderNumber,
        payload: parsed,
        receivedAt: new Date(),
      };
    }
    if (typeof payload === 'string' && !payload.startsWith('{')) {
      const results = parseSftpResultFile(payload);
      return {
        eventType: 'sftp.csv_result',
        externalId: results[0]?.accessionNumber || '',
        payload: { results },
        receivedAt: new Date(),
      };
    }
    const p = payload as LabCorpWebhookPayload;
    return {
      eventType: p.event || 'results.received',
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

export class LabCorpDisabledAdapter extends BaseAdapter {
  async submitOrder(_order: CanonicalOrder): Promise<ExternalRef> {
    throw new Error('LabCorp integration is not enabled for this tenant.');
  }

  async fetchResults(_externalRef: string): Promise<CanonicalResult> {
    throw new Error('LabCorp integration is not enabled for this tenant.');
  }

  async checkStatus(_externalRef: string): Promise<StatusUpdate> {
    throw new Error('LabCorp integration is not enabled for this tenant.');
  }

  async handleWebhook(_payload: unknown): Promise<CanonicalEvent> {
    throw new Error('LabCorp integration is not enabled for this tenant.');
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: false, message: 'LabCorp adapter disabled', checkedAt: new Date() };
  }
}
