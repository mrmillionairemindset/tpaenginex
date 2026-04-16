/**
 * FMCSA National Registry of Certified Medical Examiners — submission client.
 *
 * Certified Medical Examiners (CMEs) are required by 49 CFR 390.105 to submit
 * results of every DOT driver physical exam to the National Registry within
 * the end of the next calendar day after the exam.
 *
 * This module provides a clean interface (`FmcsaRegistryClient`) with two
 * implementations:
 *   - `FmcsaLiveClient` — submits to FMCSA's real registry API
 *   - `FmcsaMockClient`  — used in dev/test; simulates success/failure scenarios
 *
 * Selection is driven by `FMCSA_REGISTRY_MODE` env var:
 *   - `live`     → FmcsaLiveClient, requires FMCSA_REGISTRY_URL + per-CME credentials
 *   - `mock`     → FmcsaMockClient (default in dev)
 *   - `disabled` → throws if called — use when TPA hasn't signed up for this feature
 *
 * ## FMCSA submission format
 *
 * FMCSA's production endpoint accepts an XML payload with the MCSA-5875 data
 * plus MCSA-5876 certificate data. Authentication is per-CME via a registry-
 * issued username/password or API key. The CME (not the TPA) must have an
 * active account on https://nationalregistry.fmcsa.dot.gov.
 *
 * In practice TPAs submit on behalf of their CMEs using stored credentials.
 *
 * The exact XML schema is not published publicly; it's in the CME account
 * documentation. This module's live client is structured to be filled in
 * against the real spec once a TPA onboards with sandbox access. The mock
 * client + the job retry logic can be exercised today against fixtures.
 */

import { logger } from './logger';

const log = logger.child({ component: 'fmcsa-registry' });

// ============================================================================
// Canonical exam payload (what we build from our DB and hand to the client)
// ============================================================================

export interface FmcsaExamPayload {
  /** Our internal exam ID — stored as externalRef on the FMCSA side for traceability */
  examId: string;
  /** The CME's National Registry number — how FMCSA knows which examiner certified this */
  examinerNRCMENumber: string;
  /** Driver info */
  driver: {
    firstName: string;
    lastName: string;
    dob: string;               // YYYY-MM-DD per FMCSA format
    cdlNumber?: string | null;
    cdlState?: string | null;
  };
  /** Exam metadata */
  examDate: string;            // YYYY-MM-DD
  examType: 'dot';             // only DOT exams go to FMCSA; we guard at call sites
  /** Certification outcome */
  certificationStatus:
    | 'medically_qualified'
    | 'qualified_with_restrictions'
    | 'temporarily_disqualified'
    | 'disqualified'
    | 'pending_evaluation';
  mecExpiresOn: string | null; // YYYY-MM-DD; null if disqualified
  certificateNumber: string;
  restrictions: string[];
}

// ============================================================================
// Result types
// ============================================================================

export type FmcsaSubmissionResult =
  | {
      ok: true;
      /** FMCSA-assigned submission ID — opaque string we store for audit + reconciliation */
      fmcsaSubmissionId: string;
      /** FMCSA accepted the submission synchronously? Or queued for review? */
      status: 'accepted' | 'pending';
    }
  | {
      ok: false;
      /** Machine-readable error category for deciding retry behavior */
      errorCode:
        | 'validation_error'     // bad payload — retry will not help
        | 'authentication_error' // bad credentials — retry will not help until creds fixed
        | 'rate_limited'         // retry later
        | 'server_error'         // retry later
        | 'network_error'        // retry later
        | 'duplicate_submission' // already submitted — treat as success for idempotency
        | 'unknown';
      errorMessage: string;
    };

/**
 * Common shape for any FMCSA client.
 */
export interface FmcsaRegistryClient {
  /**
   * Submit a single exam to the FMCSA Registry. Must be idempotent with respect
   * to the exam — repeated submissions for the same examId MUST be detected by
   * the underlying implementation (via duplicate detection) and return
   * `duplicate_submission`, which the caller treats as success.
   */
  submit(payload: FmcsaExamPayload): Promise<FmcsaSubmissionResult>;
}

// ============================================================================
// Live client — real FMCSA submission
// ============================================================================

export interface FmcsaLiveConfig {
  registryUrl: string;                    // e.g. https://nationalregistry.fmcsa.dot.gov/api/v1
  /** Per-CME credentials. We look these up by NRCME number. */
  credentialsByNRCME: (nrcme: string) => Promise<{
    username: string;
    password: string;
  } | null>;
  /** Request timeout in ms (recommended 30000 for FMCSA, which is slow) */
  timeoutMs?: number;
}

export class FmcsaLiveClient implements FmcsaRegistryClient {
  constructor(private readonly config: FmcsaLiveConfig) {}

  async submit(payload: FmcsaExamPayload): Promise<FmcsaSubmissionResult> {
    const creds = await this.config.credentialsByNRCME(payload.examinerNRCMENumber);
    if (!creds) {
      return {
        ok: false,
        errorCode: 'authentication_error',
        errorMessage: `No FMCSA credentials configured for NRCME ${payload.examinerNRCMENumber}`,
      };
    }

    const body = buildFmcsaXmlPayload(payload);
    const timeout = this.config.timeoutMs ?? 30000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);

    try {
      const authHeader =
        'Basic ' +
        Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
      const res = await fetch(`${this.config.registryUrl}/exams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml',
          Authorization: authHeader,
          'X-Client-Id': 'tpaengx',
        },
        body,
        signal: ac.signal,
      });

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          errorCode: 'authentication_error',
          errorMessage: `FMCSA rejected credentials (HTTP ${res.status})`,
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          errorCode: 'rate_limited',
          errorMessage: 'FMCSA rate limit exceeded',
        };
      }
      if (res.status === 409) {
        // Some registries return 409 for duplicate — treat as already-submitted success.
        const resBody = await res.text();
        const submissionId = parseSubmissionId(resBody);
        return {
          ok: false,
          errorCode: 'duplicate_submission',
          errorMessage: submissionId
            ? `Duplicate: already submitted as ${submissionId}`
            : 'Duplicate submission',
        };
      }
      if (res.status >= 500) {
        return {
          ok: false,
          errorCode: 'server_error',
          errorMessage: `FMCSA server error (HTTP ${res.status})`,
        };
      }
      if (res.status >= 400) {
        const text = await res.text();
        return {
          ok: false,
          errorCode: 'validation_error',
          errorMessage: `FMCSA validation error (HTTP ${res.status}): ${truncate(text, 500)}`,
        };
      }

      const resBody = await res.text();
      const submissionId = parseSubmissionId(resBody);
      if (!submissionId) {
        return {
          ok: false,
          errorCode: 'unknown',
          errorMessage: `Could not parse submission ID from FMCSA response`,
        };
      }
      return {
        ok: true,
        fmcsaSubmissionId: submissionId,
        status: 'accepted',
      };
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return {
          ok: false,
          errorCode: 'network_error',
          errorMessage: `Timeout after ${timeout}ms`,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        errorCode: 'network_error',
        errorMessage: message,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ============================================================================
// Mock client — for dev + tests
// ============================================================================

export interface FmcsaMockConfig {
  /** Optional override: return a specific result for a given exam ID */
  fixtureByExamId?: Map<string, FmcsaSubmissionResult>;
  /** If true, fail with transient errors periodically to exercise retry logic */
  simulateFlakiness?: boolean;
}

export class FmcsaMockClient implements FmcsaRegistryClient {
  private attempts = new Map<string, number>();

  constructor(private readonly config: FmcsaMockConfig = {}) {}

  async submit(payload: FmcsaExamPayload): Promise<FmcsaSubmissionResult> {
    if (this.config.fixtureByExamId?.has(payload.examId)) {
      return this.config.fixtureByExamId.get(payload.examId)!;
    }

    // Validate required fields (simulate FMCSA's strictness)
    if (!payload.examinerNRCMENumber) {
      return {
        ok: false,
        errorCode: 'validation_error',
        errorMessage: 'examinerNRCMENumber is required',
      };
    }
    if (!/^[A-Z]{2}\d+$|^\d{10}$/.test(payload.examinerNRCMENumber)) {
      // Real NRCME numbers are 10 digits; also allow a test-friendly shape
      // ([A-Z]{2}\d+) for fixtures like "TEST12345".
      return {
        ok: false,
        errorCode: 'validation_error',
        errorMessage: `Invalid NRCME number format: ${payload.examinerNRCMENumber}`,
      };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.examDate)) {
      return {
        ok: false,
        errorCode: 'validation_error',
        errorMessage: `examDate must be YYYY-MM-DD, got ${payload.examDate}`,
      };
    }

    if (this.config.simulateFlakiness) {
      const attempt = (this.attempts.get(payload.examId) ?? 0) + 1;
      this.attempts.set(payload.examId, attempt);
      if (attempt <= 2) {
        return {
          ok: false,
          errorCode: 'server_error',
          errorMessage: `Simulated transient failure (attempt ${attempt})`,
        };
      }
    }

    return {
      ok: true,
      fmcsaSubmissionId: `MOCK-${payload.examId.slice(0, 8)}-${Date.now()}`,
      status: 'accepted',
    };
  }
}

// ============================================================================
// Disabled client — used when TPA hasn't opted in
// ============================================================================

export class FmcsaDisabledClient implements FmcsaRegistryClient {
  async submit(_payload: FmcsaExamPayload): Promise<FmcsaSubmissionResult> {
    return {
      ok: false,
      errorCode: 'authentication_error',
      errorMessage:
        'FMCSA submission is not enabled for this tenant. Contact support to add the FMCSA Registry service to your subscription.',
    };
  }
}

// ============================================================================
// Factory — picks the right client based on env
// ============================================================================

let defaultClient: FmcsaRegistryClient | null = null;

export function getDefaultFmcsaClient(): FmcsaRegistryClient {
  if (defaultClient) return defaultClient;
  const mode = (process.env.FMCSA_REGISTRY_MODE ?? 'mock').toLowerCase();

  if (mode === 'live') {
    const registryUrl = process.env.FMCSA_REGISTRY_URL;
    if (!registryUrl) {
      log.error('FMCSA_REGISTRY_MODE=live but FMCSA_REGISTRY_URL is not set — falling back to disabled client');
      defaultClient = new FmcsaDisabledClient();
      return defaultClient;
    }
    // In production, credentials come from tenant_modules.config.fmcsaCredentials
    // or an environment secret keyed by NRCME. This factory sets up a placeholder
    // credentialsByNRCME that callers must replace with a real lookup.
    defaultClient = new FmcsaLiveClient({
      registryUrl,
      credentialsByNRCME: async () => null, // intentionally returns null → caller must inject real creds
    });
    return defaultClient;
  }
  if (mode === 'disabled') {
    defaultClient = new FmcsaDisabledClient();
    return defaultClient;
  }
  // default: mock
  defaultClient = new FmcsaMockClient();
  return defaultClient;
}

/**
 * Clear the cached default client. Tests use this to reset between cases.
 */
export function resetDefaultFmcsaClient(): void {
  defaultClient = null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build the FMCSA-compliant XML payload. This is a simplified skeleton —
 * the real schema is defined in the FMCSA CME account documentation and
 * will be filled in here once sandbox access is obtained.
 *
 * Exported for unit testing.
 */
export function buildFmcsaXmlPayload(payload: FmcsaExamPayload): string {
  const restrictions = payload.restrictions
    .map((r) => `    <Restriction>${escapeXml(r)}</Restriction>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ExamSubmission xmlns="http://nationalregistry.fmcsa.dot.gov/schema/v1">
  <ExaminerNumber>${escapeXml(payload.examinerNRCMENumber)}</ExaminerNumber>
  <ExternalRef>${escapeXml(payload.examId)}</ExternalRef>
  <Driver>
    <FirstName>${escapeXml(payload.driver.firstName)}</FirstName>
    <LastName>${escapeXml(payload.driver.lastName)}</LastName>
    <DateOfBirth>${escapeXml(payload.driver.dob)}</DateOfBirth>
    ${payload.driver.cdlNumber ? `<CDLNumber>${escapeXml(payload.driver.cdlNumber)}</CDLNumber>` : ''}
    ${payload.driver.cdlState ? `<CDLState>${escapeXml(payload.driver.cdlState)}</CDLState>` : ''}
  </Driver>
  <Exam>
    <ExamDate>${escapeXml(payload.examDate)}</ExamDate>
    <CertificationStatus>${escapeXml(payload.certificationStatus)}</CertificationStatus>
    ${payload.mecExpiresOn ? `<ExpirationDate>${escapeXml(payload.mecExpiresOn)}</ExpirationDate>` : ''}
    <CertificateNumber>${escapeXml(payload.certificateNumber)}</CertificateNumber>
    <Restrictions>
${restrictions}
    </Restrictions>
  </Exam>
</ExamSubmission>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function parseSubmissionId(xmlOrJson: string): string | null {
  // Try JSON first (newer FMCSA endpoints)
  try {
    const parsed = JSON.parse(xmlOrJson);
    if (typeof parsed?.submissionId === 'string') return parsed.submissionId;
  } catch {
    // fall through to XML
  }
  const m = xmlOrJson.match(/<SubmissionId>([^<]+)<\/SubmissionId>/);
  return m ? m[1] : null;
}

/**
 * Determine whether a failed submission should be retried based on the
 * error code. Validation + auth errors are permanent; others are transient.
 */
export function isRetryableError(errorCode: string): boolean {
  switch (errorCode) {
    case 'rate_limited':
    case 'server_error':
    case 'network_error':
    case 'unknown':
      return true;
    case 'validation_error':
    case 'authentication_error':
    case 'duplicate_submission':
      return false;
    default:
      return false;
  }
}

/**
 * Compute the next retry time using exponential backoff.
 * Attempt 1: 5 minutes, 2: 30 minutes, 3: 3 hours, 4: 12 hours, 5: 24 hours
 * After 5 failed attempts, stop retrying and mark as 'error' for manual review.
 */
export function nextRetryDelayMs(attempts: number): number {
  switch (attempts) {
    case 1:
      return 5 * 60 * 1000;
    case 2:
      return 30 * 60 * 1000;
    case 3:
      return 3 * 60 * 60 * 1000;
    case 4:
      return 12 * 60 * 60 * 1000;
    case 5:
      return 24 * 60 * 60 * 1000;
    default:
      return -1; // -1 means give up
  }
}

export const MAX_FMCSA_ATTEMPTS = 5;
