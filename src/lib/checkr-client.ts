/**
 * Checkr REST API client.
 *
 * Checkr is a Consumer Reporting Agency (CRA) under FCRA. Our integration
 * resells their checks so TPAs can offer background screening without
 * becoming a CRA themselves.
 *
 * API reference: https://docs.checkr.com/
 *
 * Authentication: Basic auth with the Checkr API key as the username and
 * an empty password. The API key is per-TPA-tenant and lives in
 * `tenant_modules.config.checkrApiKey` (encrypted via encryptAtRest).
 *
 * ## Webhooks (critical for FCRA compliance)
 *
 * Candidates can take hours to submit info and Checkr's reports take minutes
 * to hours to complete. Results are pushed to us via webhooks — we do not
 * poll. Webhook signatures are HMAC-SHA256 using the Checkr-provided
 * per-webhook secret.
 *
 * ## Per-TPA credentials
 *
 * Unlike FMCSA (per-CME credentials), Checkr issues one API key per CRA
 * account. A TPA has one Checkr account and uses the same key for all their
 * clients. This module expects a function that returns credentials for a
 * given tpaOrgId.
 */

import { logger } from './logger';

const log = logger.child({ component: 'checkr-client' });

// ============================================================================
// Domain types (canonical shape we use internally)
// ============================================================================

export interface CheckrCandidateInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone?: string;
  dob: string;              // ISO YYYY-MM-DD
  ssn?: string;             // full SSN — handled with extreme care, never logged
  zipcode?: string;
  driverLicenseNumber?: string;
  driverLicenseState?: string;
  /** Our internal person ID — stored as `custom_id` on Checkr side for correlation */
  externalPersonId: string;
}

export interface CheckrCreateReportInput {
  /** Checkr candidate ID (get this by creating the candidate first) */
  candidateId: string;
  /** Package slug as defined in the TPA's Checkr account, e.g. "tasker_standard" */
  packageSlug: string;
  /** Our internal background_check row ID — stored as custom_id on Checkr side */
  externalCheckId: string;
  /** Optional node (for multi-location Checkr accounts) */
  node?: string;
}

export interface CheckrCandidate {
  id: string;
  inviteUrl: string | null;
}

export interface CheckrReport {
  id: string;
  status: CheckrReportStatus;
  completedAt: string | null;
  hostedUrl: string | null;
  summary: CheckrReportSummary | null;
}

export type CheckrReportStatus =
  | 'pending'
  | 'processing'
  | 'clear'
  | 'consider'
  | 'suspended'
  | 'dispute'
  | 'canceled'
  | 'expired';

export interface CheckrReportSummary {
  /** Short list of screens that contributed findings */
  consideredScreens?: string[];
  /** Overall adjudication status — 'engaged', 'pre_adverse_action', 'post_adverse_action', etc. */
  adjudication?: string;
}

export type CheckrResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      errorCode:
        | 'validation_error'       // bad payload — won't help to retry
        | 'authentication_error'   // bad credentials
        | 'rate_limited'
        | 'server_error'
        | 'network_error'
        | 'not_found'
        | 'unknown';
      errorMessage: string;
    };

// ============================================================================
// Client interface
// ============================================================================

export interface CheckrClient {
  /** Create or update a candidate. */
  createCandidate(tpaOrgId: string, input: CheckrCandidateInput): Promise<CheckrResult<CheckrCandidate>>;
  /** Kick off a report for an existing candidate. */
  createReport(tpaOrgId: string, input: CheckrCreateReportInput): Promise<CheckrResult<CheckrReport>>;
  /** Look up the current state of a report (used only for manual refresh — webhooks are primary). */
  fetchReport(tpaOrgId: string, reportId: string): Promise<CheckrResult<CheckrReport>>;
  /** Cancel a report that has not yet run. */
  cancelReport(tpaOrgId: string, reportId: string): Promise<CheckrResult<void>>;
  /**
   * Verify a webhook signature. Returns true if the payload is authentically
   * from Checkr. Implementations MUST use a constant-time comparison.
   */
  verifyWebhookSignature(tpaOrgId: string, rawBody: string, signature: string): Promise<boolean>;
}

// ============================================================================
// Credentials lookup
// ============================================================================

export interface CheckrCredentials {
  apiKey: string;
  webhookSecret: string;
  /** Optional node scope for multi-location accounts */
  defaultNode?: string;
}

export type CheckrCredentialsLoader = (tpaOrgId: string) => Promise<CheckrCredentials | null>;

// ============================================================================
// Live client
// ============================================================================

export interface CheckrLiveConfig {
  baseUrl?: string;                          // default https://api.checkr.com/v1
  credentialsByTpa: CheckrCredentialsLoader;
  timeoutMs?: number;                        // default 30000
}

export class CheckrLiveClient implements CheckrClient {
  private readonly baseUrl: string;

  constructor(private readonly config: CheckrLiveConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.checkr.com/v1';
  }

  async createCandidate(tpaOrgId: string, input: CheckrCandidateInput): Promise<CheckrResult<CheckrCandidate>> {
    const creds = await this.config.credentialsByTpa(tpaOrgId);
    if (!creds) {
      return { ok: false, errorCode: 'authentication_error', errorMessage: 'No Checkr credentials configured for this tenant' };
    }

    // Checkr expects form-encoded or JSON. We use JSON.
    const body = {
      first_name: input.firstName,
      last_name: input.lastName,
      middle_name: input.middleName,
      email: input.email,
      phone: input.phone,
      dob: input.dob,
      ssn: input.ssn,
      zipcode: input.zipcode,
      driver_license_number: input.driverLicenseNumber,
      driver_license_state: input.driverLicenseState,
      custom_id: input.externalPersonId,
      // Required by Checkr: workflow kicks off the candidate invitation email.
      work_locations: undefined,
    };

    const res = await this.post<CheckrCandidateResponse>(creds, '/candidates', body);
    if (!res.ok) return res;
    return {
      ok: true,
      data: {
        id: res.data.id,
        inviteUrl: res.data.invitation_url ?? null,
      },
    };
  }

  async createReport(tpaOrgId: string, input: CheckrCreateReportInput): Promise<CheckrResult<CheckrReport>> {
    const creds = await this.config.credentialsByTpa(tpaOrgId);
    if (!creds) {
      return { ok: false, errorCode: 'authentication_error', errorMessage: 'No Checkr credentials configured for this tenant' };
    }

    const body = {
      candidate_id: input.candidateId,
      package: input.packageSlug,
      custom_id: input.externalCheckId,
      node: input.node ?? creds.defaultNode,
    };

    const res = await this.post<CheckrReportResponse>(creds, '/reports', body);
    if (!res.ok) return res;
    return { ok: true, data: mapReport(res.data) };
  }

  async fetchReport(tpaOrgId: string, reportId: string): Promise<CheckrResult<CheckrReport>> {
    const creds = await this.config.credentialsByTpa(tpaOrgId);
    if (!creds) {
      return { ok: false, errorCode: 'authentication_error', errorMessage: 'No Checkr credentials configured for this tenant' };
    }
    const res = await this.get<CheckrReportResponse>(creds, `/reports/${encodeURIComponent(reportId)}`);
    if (!res.ok) return res;
    return { ok: true, data: mapReport(res.data) };
  }

  async cancelReport(tpaOrgId: string, reportId: string): Promise<CheckrResult<void>> {
    const creds = await this.config.credentialsByTpa(tpaOrgId);
    if (!creds) {
      return { ok: false, errorCode: 'authentication_error', errorMessage: 'No Checkr credentials configured for this tenant' };
    }
    const res = await this.post<unknown>(creds, `/reports/${encodeURIComponent(reportId)}/cancel`, {});
    if (!res.ok) return res;
    return { ok: true, data: undefined };
  }

  async verifyWebhookSignature(tpaOrgId: string, rawBody: string, signature: string): Promise<boolean> {
    const creds = await this.config.credentialsByTpa(tpaOrgId);
    if (!creds || !creds.webhookSecret) return false;
    return verifyCheckrHmac(rawBody, creds.webhookSecret, signature);
  }

  // ----- HTTP primitives -----

  private async get<T>(creds: CheckrCredentials, path: string): Promise<CheckrResult<T>> {
    return this.request<T>(creds, 'GET', path);
  }
  private async post<T>(creds: CheckrCredentials, path: string, body: unknown): Promise<CheckrResult<T>> {
    return this.request<T>(creds, 'POST', path, body);
  }

  private async request<T>(
    creds: CheckrCredentials,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<CheckrResult<T>> {
    const timeout = this.config.timeoutMs ?? 30000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);

    try {
      const authHeader = 'Basic ' + Buffer.from(`${creds.apiKey}:`).toString('base64');
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });

      if (res.status === 401 || res.status === 403) {
        return { ok: false, errorCode: 'authentication_error', errorMessage: `Checkr rejected credentials (HTTP ${res.status})` };
      }
      if (res.status === 404) {
        return { ok: false, errorCode: 'not_found', errorMessage: `Not found: ${path}` };
      }
      if (res.status === 429) {
        return { ok: false, errorCode: 'rate_limited', errorMessage: 'Checkr rate limit exceeded' };
      }
      if (res.status >= 500) {
        return { ok: false, errorCode: 'server_error', errorMessage: `Checkr server error (HTTP ${res.status})` };
      }
      if (res.status >= 400) {
        const text = await res.text();
        return { ok: false, errorCode: 'validation_error', errorMessage: `Checkr validation error (HTTP ${res.status}): ${truncate(text, 500)}` };
      }

      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return { ok: false, errorCode: 'network_error', errorMessage: `Timeout after ${timeout}ms` };
      }
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message, path }, 'Checkr request failed');
      return { ok: false, errorCode: 'network_error', errorMessage: message };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ============================================================================
// Mock client for dev + tests
// ============================================================================

export interface CheckrMockConfig {
  /** Scripted responses for createCandidate, keyed by externalPersonId */
  candidateFixtures?: Map<string, CheckrResult<CheckrCandidate>>;
  /** Scripted responses for createReport, keyed by externalCheckId */
  reportFixtures?: Map<string, CheckrResult<CheckrReport>>;
  /** Optional webhook secret for signature verification in tests */
  webhookSecret?: string;
}

export class CheckrMockClient implements CheckrClient {
  constructor(private readonly config: CheckrMockConfig = {}) {}

  async createCandidate(_tpaOrgId: string, input: CheckrCandidateInput): Promise<CheckrResult<CheckrCandidate>> {
    if (this.config.candidateFixtures?.has(input.externalPersonId)) {
      return this.config.candidateFixtures.get(input.externalPersonId)!;
    }
    if (!input.email || !input.firstName || !input.lastName || !input.dob) {
      return { ok: false, errorCode: 'validation_error', errorMessage: 'email, firstName, lastName, and dob are required' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob)) {
      return { ok: false, errorCode: 'validation_error', errorMessage: `dob must be YYYY-MM-DD, got ${input.dob}` };
    }
    const id = `cand_mock_${input.externalPersonId.slice(0, 8)}`;
    return {
      ok: true,
      data: {
        id,
        inviteUrl: `https://apply.checkr.com/mock/${id}`,
      },
    };
  }

  async createReport(_tpaOrgId: string, input: CheckrCreateReportInput): Promise<CheckrResult<CheckrReport>> {
    if (this.config.reportFixtures?.has(input.externalCheckId)) {
      return this.config.reportFixtures.get(input.externalCheckId)!;
    }
    if (!input.candidateId || !input.packageSlug) {
      return { ok: false, errorCode: 'validation_error', errorMessage: 'candidateId and packageSlug are required' };
    }
    const id = `rep_mock_${input.externalCheckId.slice(0, 8)}`;
    return {
      ok: true,
      data: {
        id,
        status: 'pending',
        completedAt: null,
        hostedUrl: null,
        summary: null,
      },
    };
  }

  async fetchReport(_tpaOrgId: string, reportId: string): Promise<CheckrResult<CheckrReport>> {
    return {
      ok: true,
      data: {
        id: reportId,
        status: 'processing',
        completedAt: null,
        hostedUrl: null,
        summary: null,
      },
    };
  }

  async cancelReport(_tpaOrgId: string, _reportId: string): Promise<CheckrResult<void>> {
    return { ok: true, data: undefined };
  }

  async verifyWebhookSignature(_tpaOrgId: string, rawBody: string, signature: string): Promise<boolean> {
    if (!this.config.webhookSecret) return false;
    return verifyCheckrHmac(rawBody, this.config.webhookSecret, signature);
  }
}

// ============================================================================
// Disabled client
// ============================================================================

export class CheckrDisabledClient implements CheckrClient {
  async createCandidate(_tpaOrgId: string, _input: CheckrCandidateInput): Promise<CheckrResult<CheckrCandidate>> {
    return this.disabled();
  }
  async createReport(_tpaOrgId: string, _input: CheckrCreateReportInput): Promise<CheckrResult<CheckrReport>> {
    return this.disabled();
  }
  async fetchReport(_tpaOrgId: string, _reportId: string): Promise<CheckrResult<CheckrReport>> {
    return this.disabled();
  }
  async cancelReport(_tpaOrgId: string, _reportId: string): Promise<CheckrResult<void>> {
    return this.disabled();
  }
  async verifyWebhookSignature(_tpaOrgId: string, _rawBody: string, _signature: string): Promise<boolean> {
    return false;
  }
  private disabled(): CheckrResult<never> {
    return {
      ok: false,
      errorCode: 'authentication_error',
      errorMessage: 'Background screening is not enabled for this tenant. Enable the Background Screening module in Settings.',
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

let defaultClient: CheckrClient | null = null;

export function getDefaultCheckrClient(loader?: CheckrCredentialsLoader): CheckrClient {
  if (defaultClient) return defaultClient;
  const mode = (process.env.CHECKR_MODE ?? 'mock').toLowerCase();

  if (mode === 'live') {
    if (!loader) {
      log.error('CHECKR_MODE=live but no credentials loader provided — returning disabled client');
      defaultClient = new CheckrDisabledClient();
      return defaultClient;
    }
    defaultClient = new CheckrLiveClient({
      baseUrl: process.env.CHECKR_BASE_URL,
      credentialsByTpa: loader,
    });
    return defaultClient;
  }
  if (mode === 'disabled') {
    defaultClient = new CheckrDisabledClient();
    return defaultClient;
  }
  defaultClient = new CheckrMockClient({
    webhookSecret: process.env.CHECKR_WEBHOOK_SECRET_DEV ?? 'dev-checkr-secret',
  });
  return defaultClient;
}

export function resetDefaultCheckrClient(): void {
  defaultClient = null;
}

// ============================================================================
// Helpers
// ============================================================================

interface CheckrCandidateResponse {
  id: string;
  invitation_url?: string;
  [k: string]: unknown;
}

interface CheckrReportResponse {
  id: string;
  status: string;
  completed_at?: string | null;
  report_url?: string | null;
  considered_screens?: string[];
  adjudication?: string;
  [k: string]: unknown;
}

function mapReport(r: CheckrReportResponse): CheckrReport {
  const status = normalizeStatus(r.status);
  return {
    id: r.id,
    status,
    completedAt: r.completed_at ?? null,
    hostedUrl: r.report_url ?? null,
    summary:
      r.considered_screens || r.adjudication
        ? {
            consideredScreens: r.considered_screens,
            adjudication: r.adjudication,
          }
        : null,
  };
}

function normalizeStatus(s: string): CheckrReportStatus {
  switch (s) {
    case 'pending':
    case 'processing':
    case 'clear':
    case 'consider':
    case 'suspended':
    case 'dispute':
    case 'canceled':
    case 'expired':
      return s;
    default:
      return 'processing'; // conservative fallback
  }
}

/**
 * Verify a Checkr webhook signature.
 *
 * Format: the `X-Checkr-Signature` header contains an HMAC-SHA256 hex digest
 * of the raw request body, using the per-webhook secret as the key.
 *
 * Exported for testing.
 */
export function verifyCheckrHmac(rawBody: string, secret: string, signatureHeader: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHmac, timingSafeEqual } = require('crypto') as typeof import('crypto');
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provided = signatureHeader.trim();
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '…';
}

/**
 * Map a Checkr status string to our internal background_check_status enum.
 * 1:1 because our enum was designed to match.
 */
export function toInternalStatus(s: CheckrReportStatus): CheckrReportStatus {
  return s;
}
