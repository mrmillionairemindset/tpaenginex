/**
 * Standard adapter interface for all module integrations.
 *
 * Every adapter (eScreen, CRL, FormFox, SambaSafety, etc.) implements this
 * interface. The core application calls the adapter; the adapter handles
 * protocol translation, auth, retries, and error mapping.
 *
 * Adapter config is per-tenant — stored in tenant_modules.config (jsonb),
 * not in environment variables.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AdapterConfig {
  /** Unique adapter identifier (e.g., 'escreen', 'crl', 'samba_safety') */
  adapterId: string;
  /** Base URL for the external service */
  baseUrl?: string;
  /** API key or token */
  apiKey?: string;
  /** OAuth client credentials */
  clientId?: string;
  clientSecret?: string;
  /** Additional adapter-specific config */
  [key: string]: unknown;
}

export interface ExternalRef {
  /** External system's ID for this record */
  externalId: string;
  /** Human-readable reference (e.g., requisition number) */
  externalRef?: string;
  /** Raw response from external system (for debugging) */
  rawResponse?: unknown;
}

export interface CanonicalOrder {
  orderId: string;
  tpaOrgId: string;
  personId: string;
  personFirstName: string;
  personLastName: string;
  personDOB?: string;
  serviceType: string;
  isDOT: boolean;
  panelCodes?: string[];
  collectionSite?: string;
  [key: string]: unknown;
}

export interface CanonicalResult {
  externalId: string;
  orderId: string;
  specimenId?: string;
  panelType: string;
  resultValue: string;
  mroReviewedAt?: Date;
  mroDecision?: string;
  reportedAt?: Date;
  rawData?: unknown;
}

export interface StatusUpdate {
  externalId: string;
  status: string;
  updatedAt: Date;
  details?: string;
}

export interface CanonicalEvent {
  eventType: string;
  externalId: string;
  orderId?: string;
  payload: unknown;
  receivedAt: Date;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  message?: string;
  checkedAt: Date;
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

export interface ModuleAdapter {
  /** One-time setup — validate config, establish connections */
  initialize(config: AdapterConfig): Promise<void>;

  /** Submit an order to the external system */
  submitOrder(order: CanonicalOrder): Promise<ExternalRef>;

  /** Fetch results from the external system */
  fetchResults(externalRef: string): Promise<CanonicalResult>;

  /** Check current status of a submitted order */
  checkStatus(externalRef: string): Promise<StatusUpdate>;

  /** Process an inbound webhook from the external system */
  handleWebhook(payload: unknown): Promise<CanonicalEvent>;

  /** Verify connectivity and credentials */
  healthCheck(): Promise<HealthStatus>;
}

// ============================================================================
// BASE ADAPTER (optional convenience class)
// ============================================================================

export abstract class BaseAdapter implements ModuleAdapter {
  protected config!: AdapterConfig;

  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;
  }

  abstract submitOrder(order: CanonicalOrder): Promise<ExternalRef>;
  abstract fetchResults(externalRef: string): Promise<CanonicalResult>;
  abstract checkStatus(externalRef: string): Promise<StatusUpdate>;
  abstract handleWebhook(payload: unknown): Promise<CanonicalEvent>;

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      message: `${this.config.adapterId} adapter initialized`,
      checkedAt: new Date(),
    };
  }
}
