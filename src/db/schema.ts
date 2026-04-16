import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, uuid, pgEnum, uniqueIndex, index, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const organizationTypeEnum = pgEnum("organization_type", [
  "platform",  // Super-admin (one row ever)
  "tpa",       // TPA tenants (paying customers)
  "client",    // Clients of a TPA (employers they serve)
]);

export const userRoleEnum = pgEnum("user_role", [
  "platform_admin",   // Full access to everything
  "tpa_admin",        // TPA owner/manager — full access to their tenant
  "tpa_staff",        // TPA scheduler/coordinator — create orders, assign collectors
  "tpa_records",      // TPA records — update results, manage documents
  "tpa_billing",      // TPA billing — access billing queue, invoices
  "client_admin",     // Client contact — read-only portal to their own orders
  "collector",        // Mobile collector — view assignments, mark complete, upload docs
]);

export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "needs_site",
  "scheduled",
  "in_progress",
  "results_uploaded",
  "pending_review",
  "needs_correction",
  "complete",
  "cancelled",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "proposed",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
]);

export const documentKindEnum = pgEnum("document_kind", [
  "result",
  "chain_of_custody",
  "consent",
  "authorization",
  "other",
]);

export const reviewActionEnum = pgEnum("review_action", [
  "approved",
  "rejected",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "order_created",
  "order_assigned",
  "order_scheduled",
  "order_completed",
  "results_uploaded",
  "results_approved",
  "results_rejected",
  "site_assigned",
  "general",
  // TPA-specific types
  "collector_assigned",
  "collection_complete",
  "kit_reminder",
  "collector_confirm_reminder",
  "results_pending_followup",
  "order_completed_client",
  "billing_queued",
  // Random program selection
  "random_selection",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "scheduled",
  "in_progress",
  "partially_complete",
  "complete",
  "cancelled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "sent",
  "paid",
  "overdue",
  "voided",
]);

export const serviceRequestStatusEnum = pgEnum("service_request_status", [
  "submitted",    // Client submitted, waiting for TPA review
  "accepted",     // TPA accepted, order will be created
  "declined",     // TPA declined with reason
  "converted",    // Converted to an order
]);

export const leadStageEnum = pgEnum("lead_stage", [
  "new_lead",
  "outreach_sent",
  "proposal_sent",
  "follow_up",
  "contract_sent",
  "closed_won",
  "closed_lost",
]);

// ============================================================================
// TABLES
// ============================================================================

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  type: organizationTypeEnum("type").notNull(),
  tpaOrgId: uuid("tpa_org_id").references((): any => organizations.id, { onDelete: "cascade" }),
  billingTier: varchar("billing_tier", { length: 50 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  contactPhone: varchar("contact_phone", { length: 30 }),
  website: text("website"),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  state: varchar("state", { length: 2 }),
  zip: varchar("zip", { length: 10 }),
  isActive: boolean("is_active").default(true).notNull(),
  authExpiryDays: integer("auth_expiry_days").default(3).notNull(),
  authFormRecipients: text("auth_form_recipients").array(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// NextAuth core tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  password: varchar("password", { length: 255 }),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
  role: userRoleEnum("role"),
  phone: varchar("phone", { length: 30 }),
  isActive: boolean("is_active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  // Two-factor authentication (TOTP)
  totpSecret: text("totp_secret"), // base32 encoded, encrypted at rest in production
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  totpVerifiedAt: timestamp("totp_verified_at"), // when the user completed initial TOTP setup
  // Account lockout / brute-force protection
  failedLoginCount: integer("failed_login_count").default(0).notNull(),
  lockedUntil: timestamp("locked_until"), // account is locked until this timestamp
  lastFailedLoginAt: timestamp("last_failed_login_at"),
  // Password policy
  passwordChangedAt: timestamp("password_changed_at"),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  // NRCME — Certified Medical Examiner credentials (for users performing DOT physicals)
  nrcmeNumber: varchar("nrcme_number", { length: 20 }),
  nrcmeExpiresAt: timestamp("nrcme_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Active user sessions — tracked for device management, remote revocation, and audit.
// Session IDs are stored in JWT tokens; getCurrentUser() validates against this table.
export const userSessions = pgTable("user_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  deviceLabel: varchar("device_label", { length: 255 }),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// API keys for machine-to-machine integrations.
// Key format: tpa_live_<random>. We store a SHA-256 hash for fast lookup,
// plus a prefix (first 8 chars) for display in the UI.
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 200 }).notNull(), // human-readable label
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(), // SHA-256 hex for O(1) lookup
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(), // first chars for UI display, e.g. "tpa_live_abcd1234"
  scopes: jsonb("scopes").$type<string[]>().notNull(), // e.g. ["orders:read", "orders:write"]
  // IP allowlist — if non-empty, only requests from these IPs/CIDRs succeed.
  // Format: array of strings, each either an exact IP or a CIDR (e.g. "203.0.113.0/24").
  ipAllowlist: jsonb("ip_allowlist").$type<string[]>().default([]).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  lastUsedIp: varchar("last_used_ip", { length: 45 }),
  usageCount: integer("usage_count").default(0).notNull(),
  expiresAt: timestamp("expires_at"), // null = no expiry
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Per-request API key usage log — powers analytics, abuse detection, compliance audit.
export const apiKeyUsage = pgTable("api_key_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  statusCode: integer("status_code").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Outbound webhook subscriptions. TPA admins configure URLs to receive events.
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(), // used for HMAC-SHA256 signing. Encrypted at rest via encryptAtRest().
  // Graceful rotation: previous secret remains valid for 24 hours after rotation.
  previousSecret: text("previous_secret"), // encrypted at rest; nullable
  previousSecretExpiresAt: timestamp("previous_secret_expires_at"), // when previousSecret stops being signed with
  secretRotatedAt: timestamp("secret_rotated_at"), // when most recent rotation happened
  events: jsonb("events").$type<string[]>().notNull(), // e.g. ["order.created", "order.completed", "dqf.review_completed"]
  isActive: boolean("is_active").default(true).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Individual webhook delivery attempts (for audit + retry tracking)
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").references(() => webhookSubscriptions.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  event: varchar("event", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending | success | failed | dead_letter
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(5).notNull(),
  nextAttemptAt: timestamp("next_attempt_at"),
  lastAttemptAt: timestamp("last_attempt_at"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Platform admin impersonation sessions — auditable, time-limited.
export const impersonationSessions = pgTable("impersonation_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // the platform_admin
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // user being impersonated
  reason: text("reason").notNull(), // required — for audit
  startedAt: timestamp("started_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  endedAt: timestamp("ended_at"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
});

// Password reset tokens — separate from NextAuth verification_tokens for clarity
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(), // bcrypt hash — we never store the raw token
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // single-use enforcement
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email verification tokens — for signup confirmation
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(), // the email being verified (may differ from current if email changed)
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Login history — audit trail for security events
export const loginHistory = pgTable("login_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(), // stored even if no userId (failed login with unknown email)
  event: varchar("event", { length: 50 }).notNull(), // "login_success" | "login_failed" | "login_locked" | "2fa_challenge" | "2fa_failed" | "password_reset_requested" | "password_reset_completed"
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Backup codes for 2FA account recovery — each code can be used exactly once
export const userBackupCodes = pgTable("user_backup_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  codeHash: varchar("code_hash", { length: 255 }).notNull(), // bcrypt hash of the code
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: uniqueIndex("uq_user_backup_code").on(table.userId, table.codeHash),
}));

// ----------------------------------------------------------------------------
// GDPR / CCPA — data export + account deletion requests
// ----------------------------------------------------------------------------

export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(), // now + 30 days
  cancelledAt: timestamp("cancelled_at"),
  completedAt: timestamp("completed_at"),
  reason: text("reason"), // optional user-provided reason
  ipAddress: varchar("ip_address", { length: 45 }),
});

export const dataExportRequests = pgTable("data_export_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  downloadUrl: text("download_url"), // signed URL to the ZIP in storage
  expiresAt: timestamp("expires_at"), // download link expires after 7 days
  sizeBytes: integer("size_bytes"),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending | processing | completed | failed
  errorMessage: text("error_message"),
});

// Junction table for multi-organization membership
export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  role: userRoleEnum("role").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  id_token: text("id_token"),
  session_state: varchar("session_state", { length: 255 }),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const organizationLocations = pgTable("organization_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  zip: varchar("zip", { length: 10 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const persons = pgTable("persons", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personType: varchar("person_type", { length: 20 }).notNull().default("candidate"),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  dob: varchar("dob", { length: 10 }).notNull(),
  ssnLast4: varchar("ssn_last4", { length: 4 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  state: varchar("state", { length: 2 }),
  zip: varchar("zip", { length: 10 }),
  lat: text("lat"),
  lng: text("lng"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Collectors — mobile PRN collectors dispatched to job sites
export const collectors = pgTable("collectors", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  certifications: jsonb("certifications").$type<string[]>(),
  serviceArea: text("service_area"),
  isAvailable: boolean("is_available").default(true).notNull(),
  notes: text("notes"),
  userId: uuid("user_id").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Collector Push Tokens — Expo push notification tokens for mobile app
export const pushTokenPlatformEnum = pgEnum("push_token_platform", [
  "ios",
  "android",
  "web",
]);

export const collectorPushTokens = pgTable("collector_push_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  collectorId: uuid("collector_id").references(() => collectors.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull(),
  platform: pushTokenPlatformEnum("platform").notNull(),
  deviceId: varchar("device_id", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  collectorDeviceUnique: uniqueIndex("collector_push_tokens_collector_device_idx")
    .on(table.collectorId, table.deviceId),
}));

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  clientLabel: varchar("client_label", { length: 255 }),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  collectorId: uuid("collector_id").references(() => collectors.id),
  eventId: uuid("event_id"),  // FK added after events table definition via relations
  orderNumber: varchar("order_number", { length: 50 }).unique().notNull(),
  testType: varchar("test_type", { length: 500 }).notNull(),
  serviceType: varchar("service_type", { length: 50 }).notNull().default("drug_screen"),
  isDOT: boolean("is_dot").default(false).notNull(),
  priority: varchar("priority", { length: 20 }).default("standard"),
  ccfNumber: varchar("ccf_number", { length: 50 }),
  reasonForService: varchar("reason_for_service", { length: 100 }),
  testingAuthority: varchar("testing_authority", { length: 20 }),
  panelCode: varchar("panel_code", { length: 50 }),
  resultStatus: varchar("result_status", { length: 30 }).default("pending"),
  urgency: varchar("urgency", { length: 30 }).default("standard"),
  jobsiteLocation: varchar("jobsite_location", { length: 255 }).notNull(),
  requestedBy: uuid("requested_by").references(() => users.id),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  needsMask: boolean("needs_mask").default(false).notNull(),
  maskSize: varchar("mask_size", { length: 20 }),
  status: orderStatusEnum("status").default("new").notNull(),
  externalRowId: varchar("external_row_id", { length: 40 }),
  adapterId: varchar("adapter_id", { length: 50 }),
  scheduledFor: timestamp("scheduled_for"),
  completedAt: timestamp("completed_at"),
  // Legacy Concentra fields — kept in DB, hidden in TPA UI
  useConcentra: boolean("use_concentra").default(true).notNull(),
  authorizationMethod: varchar("authorization_method", { length: 20 }),
  authorizationFormUrl: text("authorization_form_url"),
  authorizationFormSentAt: timestamp("authorization_form_sent_at"),
  authCreatedAt: timestamp("auth_created_at"),
  authExpiresAt: timestamp("auth_expires_at"),
  authConfirmationEmail: text("auth_confirmation_email"),
  authNumber: varchar("auth_number", { length: 100 }),
  autoTimerStarted: boolean("auto_timer_started").default(false),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Legacy table — kept but unused in TPA flow
export const sites = pgTable("sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).unique(),
  providerNetwork: varchar("provider_network", { length: 100 }),
  address: text("address").notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  zip: varchar("zip", { length: 10 }).notNull(),
  lat: text("lat"),
  lng: text("lng"),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 320 }),
  website: text("website"),
  testsSupported: jsonb("tests_supported").$type<string[]>().notNull(),
  hoursJson: jsonb("hours_json"),
  acceptsWalkIns: boolean("accepts_walk_ins").default(false),
  requiresAppointment: boolean("requires_appointment").default(true),
  isActive: boolean("is_active").default(true).notNull(),
  priority: integer("priority").default(0),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Legacy table — kept but unused in TPA flow
export const appointments = pgTable("appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "restrict" }).notNull(),
  assignedBy: uuid("assigned_by").references(() => users.id),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  status: appointmentStatusEnum("status").default("proposed").notNull(),
  confirmationCode: varchar("confirmation_code", { length: 50 }),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }),
  kind: documentKindEnum("kind").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  storageUrl: text("storage_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  isArchived: boolean("is_archived").default(false),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  actorEmail: varchar("actor_email", { length: 320 }),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 40 }).notNull(),
  diffJson: jsonb("diff_json"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderReviews = pgTable("order_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id).notNull(),
  action: reviewActionEnum("action").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Events — batch/random pull tracking
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  clientLabel: varchar("client_label", { length: 255 }),
  eventNumber: varchar("event_number", { length: 50 }).unique().notNull(),
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  collectorId: uuid("collector_id").references(() => collectors.id),
  location: text("location").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  totalOrdered: integer("total_ordered").notNull(),
  totalCompleted: integer("total_completed").default(0).notNull(),
  totalPending: integer("total_pending").default(0).notNull(),
  status: eventStatusEnum("status").default("scheduled").notNull(),
  kitMailedAt: timestamp("kit_mailed_at"),
  collectorConfirmedAt: timestamp("collector_confirmed_at"),
  completionEmailSentAt: timestamp("completion_email_sent_at"),
  pendingFollowUpUntil: timestamp("pending_follow_up_until"),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Random Program Management (DOT 49 CFR Part 382 + Part 40)
//
// A TPA configures one or more random programs per client (or consortium).
// Each program defines selection rates and a period type (quarter / month / year).
// At each period, members are randomly drawn for drug and/or alcohol testing
// using cryptographic randomness (NEVER Math.random — DOT compliance failure).
// ============================================================================

export const randomProgramTypeEnum = pgEnum("random_program_type", [
  "dot",          // DOT-regulated (FMCSA, FAA, FRA, FTA, PHMSA, USCG)
  "non_dot",      // Employer-mandated, not federally required
  "consortium",   // Multi-employer consortium pool
]);

export const randomPeriodTypeEnum = pgEnum("random_period_type", [
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
]);

export const randomPoolStatusEnum = pgEnum("random_pool_status", [
  "open",       // Period active, members can be added/removed
  "selected",   // Selection has been run; cannot modify members
  "closed",     // Period ended, archived
]);

export const randomSelectionTypeEnum = pgEnum("random_selection_type", [
  "drug",
  "alcohol",
  "both",
]);

export const randomEligibilityStatusEnum = pgEnum("random_eligibility_status", [
  "active",     // Eligible for selection
  "excluded",   // Temporarily excluded (leave, terminated, etc.)
]);

export const randomPrograms = pgTable("random_programs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  name: varchar("name", { length: 200 }).notNull(),
  programType: randomProgramTypeEnum("program_type").notNull(),
  // Selection rates expressed as decimals (0.50 = 50% of pool tested annually).
  // Per DOT 382.305: minimum 50% drug + 10% alcohol for FMCSA.
  drugTestRate: integer("drug_test_rate_bp").default(5000).notNull(), // basis points (5000 = 50.00%)
  alcoholTestRate: integer("alcohol_test_rate_bp").default(1000).notNull(), // 1000 = 10.00%
  periodType: randomPeriodTypeEnum("period_type").default("quarterly").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const randomPools = pgTable("random_pools", {
  id: uuid("id").defaultRandom().primaryKey(),
  programId: uuid("program_id").references(() => randomPrograms.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  periodStartsAt: timestamp("period_starts_at").notNull(),
  periodEndsAt: timestamp("period_ends_at").notNull(),
  totalEligible: integer("total_eligible").default(0).notNull(),
  totalSelectedDrug: integer("total_selected_drug").default(0).notNull(),
  totalSelectedAlcohol: integer("total_selected_alcohol").default(0).notNull(),
  status: randomPoolStatusEnum("status").default("open").notNull(),
  selectedAt: timestamp("selected_at"),
  selectedBy: uuid("selected_by").references(() => users.id),
  // Cryptographic seed used for the selection — stored for audit reproducibility
  selectionSeedHash: varchar("selection_seed_hash", { length: 64 }),
  // PDF report generated at selection time (S3 storage key)
  reportStorageKey: text("report_storage_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Each program has at most one open pool at a time
  uniqueOpenPool: uniqueIndex("uq_random_pool_program_period").on(
    table.programId,
    table.periodStartsAt,
  ),
}));

export const randomPoolMembers = pgTable("random_pool_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  poolId: uuid("pool_id").references(() => randomPools.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  eligibilityStatus: randomEligibilityStatusEnum("eligibility_status").default("active").notNull(),
  excludeReason: varchar("exclude_reason", { length: 255 }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  excludedAt: timestamp("excluded_at"),
}, (table) => ({
  // Same person can't be in the same pool twice
  uniquePoolPerson: uniqueIndex("uq_pool_member").on(table.poolId, table.personId),
}));

export const randomSelections = pgTable("random_selections", {
  id: uuid("id").defaultRandom().primaryKey(),
  poolId: uuid("pool_id").references(() => randomPools.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  selectionType: randomSelectionTypeEnum("selection_type").notNull(),
  notifiedAt: timestamp("notified_at"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  // The order created when this selection was scheduled
  orderId: uuid("order_id").references(() => orders.id),
  // Notes for HR (e.g., "vacation until March 1, scheduled for March 5")
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// OCCUPATIONAL HEALTH MODULE (DOT physicals + BAT + vaccinations + fit tests)
//
// Per FMCSA 49 CFR 391.41–391.49 for driver physicals, issued on Form MCSA-5876
// (Medical Examiner's Certificate). Expiration is NOT always 2 years — it
// depends on findings (hypertension, diabetes, sleep apnea etc. shorten it).
// Submission to FMCSA National Registry is required within 24 hrs of the exam.
// ============================================================================

export const physicalExamTypeEnum = pgEnum("physical_exam_type", [
  "dot",
  "non_dot",
  "pre_employment",
  "return_to_duty",
  "follow_up",
  "annual",
]);

export const physicalExamStatusEnum = pgEnum("physical_exam_status", [
  "scheduled",
  "in_progress",
  "completed",
  "abandoned",
]);

export const physicalCertificationStatusEnum = pgEnum("physical_certification_status", [
  "medically_qualified",              // Standard 2-year cert (or 1-yr if conditions)
  "qualified_with_restrictions",      // Pass with restrictions (corrective lenses, etc.)
  "temporarily_disqualified",         // Treatment required; can re-exam
  "disqualified",                     // Cannot drive
  "pending_evaluation",               // Awaiting specialist clearance
]);

export const batTestResultEnum = pgEnum("bat_test_result", [
  "negative",
  "positive",
  "refused",
  "invalid",
  "pending",
]);

export const fmcsaSubmissionStatusEnum = pgEnum("fmcsa_submission_status", [
  "not_required",  // non-DOT exam
  "pending",
  "submitted",
  "accepted",
  "rejected",
  "error",
]);

// Physical exams — the central record
export const physicalExams = pgTable("physical_exams", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  examinerId: uuid("examiner_id").references(() => users.id),
  examinerNRCMENumber: varchar("examiner_nrcme_number", { length: 20 }),
  examType: physicalExamTypeEnum("exam_type").notNull(),
  scheduledFor: timestamp("scheduled_for"),
  examDate: timestamp("exam_date"),
  status: physicalExamStatusEnum("status").default("scheduled").notNull(),
  // MEC issuance
  certificateNumber: varchar("certificate_number", { length: 50 }),
  certificationStatus: physicalCertificationStatusEnum("certification_status"),
  mecExpiresOn: timestamp("mec_expires_on"),
  mecIssuedAt: timestamp("mec_issued_at"),
  mecStorageKey: text("mec_storage_key"),       // PDF in S3
  restrictions: jsonb("restrictions").$type<string[]>().default([]),
  // FMCSA National Registry
  fmcsaSubmissionStatus: fmcsaSubmissionStatusEnum("fmcsa_submission_status").default("pending").notNull(),
  fmcsaSubmittedAt: timestamp("fmcsa_submitted_at"),
  fmcsaSubmissionId: varchar("fmcsa_submission_id", { length: 100 }),
  fmcsaErrorMessage: text("fmcsa_error_message"),
  fmcsaAttempts: integer("fmcsa_attempts").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  certNumberIdx: uniqueIndex("uq_physical_cert_number").on(table.certificateNumber),
}));

// Health history — Form MCSA-5875 Section 1 (encrypted at rest per HIPAA)
export const physicalExamHealthHistory = pgTable("physical_exam_health_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  examId: uuid("exam_id").references(() => physicalExams.id, { onDelete: "cascade" }).notNull().unique(),
  // Encrypted JSON blob containing driver-reported medical history (conditions, surgeries,
  // medications, substance use, etc.) Per HIPAA these must be encrypted at rest.
  encryptedPayload: text("encrypted_payload").notNull(),
  driverSignature: text("driver_signature"),    // base64 signature data URL
  driverSignedAt: timestamp("driver_signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Vitals + exam observations (Form MCSA-5875 Section 2)
export const physicalExamVitals = pgTable("physical_exam_vitals", {
  id: uuid("id").defaultRandom().primaryKey(),
  examId: uuid("exam_id").references(() => physicalExams.id, { onDelete: "cascade" }).notNull().unique(),
  heightInches: integer("height_inches"),
  weightPounds: integer("weight_pounds"),
  bpSystolic: integer("bp_systolic"),
  bpDiastolic: integer("bp_diastolic"),
  pulse: integer("pulse"),
  // Vision — corrected values if driver wears lenses
  visionRightUncorrected: varchar("vision_right_uncorrected", { length: 10 }),  // e.g. "20/40"
  visionLeftUncorrected: varchar("vision_left_uncorrected", { length: 10 }),
  visionBothUncorrected: varchar("vision_both_uncorrected", { length: 10 }),
  visionRightCorrected: varchar("vision_right_corrected", { length: 10 }),
  visionLeftCorrected: varchar("vision_left_corrected", { length: 10 }),
  visionBothCorrected: varchar("vision_both_corrected", { length: 10 }),
  wearsCorrectiveLenses: boolean("wears_corrective_lenses").default(false).notNull(),
  horizontalFieldOfVisionRight: integer("horizontal_field_of_vision_right"),   // degrees
  horizontalFieldOfVisionLeft: integer("horizontal_field_of_vision_left"),
  colorVisionAdequate: boolean("color_vision_adequate"),
  // Hearing (forced whisper test at 5 feet, or audiometric)
  hearingRight: varchar("hearing_right", { length: 20 }),    // "passed_whisper" | "audiometric_20db" | etc.
  hearingLeft: varchar("hearing_left", { length: 20 }),
  // Urinalysis
  urineSpecificGravity: varchar("urine_specific_gravity", { length: 10 }),
  urineProtein: varchar("urine_protein", { length: 20 }),    // "negative" | "trace" | "1+" etc.
  urineBlood: varchar("urine_blood", { length: 20 }),
  urineSugar: varchar("urine_sugar", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Findings — examiner-noted conditions requiring action or monitoring
export const physicalExamFindings = pgTable("physical_exam_findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  examId: uuid("exam_id").references(() => physicalExams.id, { onDelete: "cascade" }).notNull(),
  // Finding categories that drive MEC expiration shortening per FMCSA rules
  category: varchar("category", { length: 50 }).notNull(),
  // e.g., 'hypertension_stage1', 'hypertension_stage2', 'hypertension_stage3',
  //       'diabetes_insulin', 'diabetes_non_insulin', 'sleep_apnea_osa',
  //       'cardiovascular', 'respiratory', 'vision_monocular', 'hearing_aid',
  //       'musculoskeletal', 'neurological', 'psychiatric', 'other'
  description: text("description").notNull(),
  action: text("action"),                        // e.g., "continue medication, monitor BP"
  requiresFollowUp: boolean("requires_follow_up").default(false).notNull(),
  followUpByDate: timestamp("follow_up_by_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Breath Alcohol Tests (BAT) — separate from drug testing, usually same-day as DOT physical
export const batTests = pgTable("bat_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id),     // optional link to a drug-test order
  examId: uuid("exam_id").references(() => physicalExams.id),// optional link to a physical exam
  batTechnicianId: uuid("bat_technician_id").references(() => users.id),
  deviceMake: varchar("device_make", { length: 100 }),
  deviceSerial: varchar("device_serial", { length: 100 }),
  deviceCalibrationDate: timestamp("device_calibration_date"),
  testDate: timestamp("test_date").defaultNow().notNull(),
  screeningResult: varchar("screening_result", { length: 10 }),    // e.g., "0.020"
  confirmationResult: varchar("confirmation_result", { length: 10 }),
  status: batTestResultEnum("status").default("pending").notNull(),
  reasonForTest: varchar("reason_for_test", { length: 50 }),       // pre_employment / random / post_accident / reasonable_suspicion / return_to_duty / follow_up
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Vaccinations administered or tracked
export const vaccinations = pgTable("vaccinations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  vaccineType: varchar("vaccine_type", { length: 100 }).notNull(),
  // e.g. "hepatitis_b_1", "hepatitis_b_2", "hepatitis_b_3", "tdap", "mmr",
  //      "influenza_annual", "covid_19_booster", "tuberculin_test"
  manufacturer: varchar("manufacturer", { length: 100 }),
  lotNumber: varchar("lot_number", { length: 100 }),
  administeredAt: timestamp("administered_at").defaultNow().notNull(),
  administeredBy: uuid("administered_by").references(() => users.id),
  doseNumber: integer("dose_number"),              // for multi-dose series
  expiresAt: timestamp("expires_at"),              // for titers/annuals
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Respirator fit tests (OSHA 1910.134 for respiratory protection programs)
export const respiratorFitTests = pgTable("respirator_fit_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  testType: varchar("test_type", { length: 20 }).notNull(),        // "qualitative" | "quantitative"
  respiratorMake: varchar("respirator_make", { length: 100 }),
  respiratorModel: varchar("respirator_model", { length: 100 }),
  respiratorSize: varchar("respirator_size", { length: 20 }),      // "S" | "M" | "L"
  fitFactor: integer("fit_factor"),                                 // quantitative only
  passed: boolean("passed").notNull(),
  testedAt: timestamp("tested_at").defaultNow().notNull(),
  testedBy: uuid("tested_by").references(() => users.id),
  nextTestDueBy: timestamp("next_test_due_by"),                    // annual requirement
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// BACKGROUND SCREENING MODULE
//
// TPAs resell background screening to clients without becoming a Consumer
// Reporting Agency (CRA). We integrate with Checkr (primary), with room to
// add First Advantage, Sterling, etc. later.
//
// The lifecycle:
//   1. TPA admin defines `background_check_packages` (e.g., "Basic+",
//      "CDL Driver Package"). Each package maps to a Checkr package slug.
//   2. Client or TPA creates a `background_check` — person + package → Checkr.
//   3. Checkr asynchronously pushes `report.completed` webhook → we update
//      status (clear / consider / suspended / dispute).
//   4. Completed checks are billed back via `background_check_charges`.
// ============================================================================

export const backgroundCheckStatusEnum = pgEnum("background_check_status", [
  "pending",          // Candidate invitation sent, not yet started
  "processing",       // Checkr running the report
  "clear",            // No disqualifying findings
  "consider",         // Requires TPA review (hit on a search)
  "suspended",        // Candidate action needed (e.g., ID verification)
  "dispute",          // Candidate disputing a result per FCRA
  "canceled",
  "expired",          // Candidate didn't respond in time
]);

export const backgroundProviderEnum = pgEnum("background_provider", [
  "checkr",
  "first_advantage",
  "sterling",
  "manual",           // TPA records a result entered by hand
]);

export const backgroundCheckPackages = pgTable("background_check_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  provider: backgroundProviderEnum("provider").default("checkr").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  // Checkr package slug (e.g., "tasker_standard", "driver_pro") — identifies
  // the bundle of screens on Checkr's side.
  providerPackageSlug: varchar("provider_package_slug", { length: 100 }).notNull(),
  includesMvr: boolean("includes_mvr").default(false).notNull(),
  includesDrugTest: boolean("includes_drug_test").default(false).notNull(),
  includesEmploymentVerification: boolean("includes_employment_verification").default(false).notNull(),
  includesEducationVerification: boolean("includes_education_verification").default(false).notNull(),
  // TPA's resale price — cents. What the client pays (Checkr's wholesale cost
  // is kept out of this table to avoid leaking TPA margin via the API).
  retailPriceCents: integer("retail_price_cents").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueNamePerTpa: uniqueIndex("uq_bg_pkg_tpa_name").on(table.tpaOrgId, table.name),
}));

export const backgroundChecks = pgTable("background_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  packageId: uuid("package_id").references(() => backgroundCheckPackages.id, { onDelete: "restrict" }).notNull(),
  provider: backgroundProviderEnum("provider").default("checkr").notNull(),
  // Checkr's report ID — opaque string, unique per TPA
  externalId: varchar("external_id", { length: 100 }),
  // Checkr's candidate ID (one candidate can have many reports)
  externalCandidateId: varchar("external_candidate_id", { length: 100 }),
  // Candidate invitation URL — Checkr-hosted form where the candidate enters
  // their info. We send the candidate an email with this link.
  candidateInviteUrl: text("candidate_invite_url"),
  status: backgroundCheckStatusEnum("status").default("pending").notNull(),
  // Summary of findings from the webhook. Keeps us from calling Checkr every
  // time we want to show status in the UI.
  summaryJson: jsonb("summary_json"),
  // Signed URL to view the full report on Checkr's hosted viewer
  hostedReportUrl: text("hosted_report_url"),
  submittedAt: timestamp("submitted_at"),
  completedAt: timestamp("completed_at"),
  canceledAt: timestamp("canceled_at"),
  requestedBy: uuid("requested_by").references(() => users.id),
  notes: text("notes"),
  internalNotes: text("internal_notes"),  // NEVER exposed to client_admin per HIPAA/FCRA
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueExternalIdPerProvider: uniqueIndex("uq_bg_check_external").on(table.provider, table.externalId),
}));

export const backgroundCheckCharges = pgTable("background_check_charges", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkId: uuid("check_id").references(() => backgroundChecks.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  lineItemDescription: varchar("line_item_description", { length: 255 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  // FK to invoices once the charge has been billed. Null = not yet billed.
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// INJURY CARE MODULE
//
// Workplace incident management for TPA clients. Tracks the incident itself,
// treatment log (multiple visits per incident), required documents (WC forms,
// medical records, incident reports), and return-to-work evaluations.
//
// Key compliance: OSHA 300 recordable injuries (29 CFR 1904), workers comp
// claim tracking (state-specific, but we store the claim number).
// ============================================================================

export const injuryStatusEnum = pgEnum("injury_status", [
  "open",              // Just reported, triage pending
  "in_treatment",      // Active medical care
  "rtw_eval_pending",  // Waiting for return-to-work evaluation
  "rtw_full_duty",     // Released to full duty
  "rtw_restricted",    // Released with restrictions
  "closed",            // Case closed
  "litigation",        // Workers comp dispute / legal
]);

export const injurySeverityEnum = pgEnum("injury_severity", [
  "first_aid",         // Minor — no medical beyond first aid (not OSHA recordable)
  "medical",           // Required medical treatment — OSHA recordable
  "lost_time",         // Days away from work — OSHA recordable + lost days
  "restricted_duty",   // Transferred or restricted — OSHA recordable
  "fatality",          // OSHA must be notified within 8 hours
]);

export const rtwStatusEnum = pgEnum("rtw_status", [
  "full_duty",         // No restrictions
  "restricted_duty",   // Work restrictions apply
  "unable_to_work",    // Cannot return at this time
]);

export const injuries = pgTable("injuries", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  incidentNumber: varchar("incident_number", { length: 50 }).unique().notNull(),
  incidentDate: timestamp("incident_date").notNull(),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  reportedBy: uuid("reported_by").references(() => users.id),
  location: text("location").notNull(),
  jobAtIncident: varchar("job_at_incident", { length: 200 }),
  // Body parts affected — jsonb array of strings. Using a structured list rather
  // than free-text because OSHA 300 reporting aggregates by body part.
  bodyPartsAffected: jsonb("body_parts_affected").$type<string[]>().default([]).notNull(),
  injuryType: varchar("injury_type", { length: 50 }).notNull(),
  // e.g., "sprain", "laceration", "burn", "fracture", "concussion", "amputation",
  //       "repetitive_strain", "puncture", "crush", "chemical_exposure", "hearing_loss"
  description: text("description").notNull(),
  witnessIds: jsonb("witness_ids").$type<string[]>().default([]),  // personIds
  severity: injurySeverityEnum("severity").notNull(),
  status: injuryStatusEnum("status").default("open").notNull(),
  // OSHA recordability is a legal determination; the field defaults from severity
  // but a safety officer can override.
  oshaRecordable: boolean("osha_recordable").default(false).notNull(),
  oshaCase: varchar("osha_case", { length: 50 }),  // OSHA Form 300 case number
  workersCompClaimNumber: varchar("workers_comp_claim_number", { length: 50 }),
  workersCompCarrier: varchar("workers_comp_carrier", { length: 200 }),
  lostDaysCount: integer("lost_days_count").default(0).notNull(),
  restrictedDaysCount: integer("restricted_days_count").default(0).notNull(),
  notes: text("notes"),
  internalNotes: text("internal_notes"),  // Never exposed to client_admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const injuryTreatments = pgTable("injury_treatments", {
  id: uuid("id").defaultRandom().primaryKey(),
  injuryId: uuid("injury_id").references(() => injuries.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  treatmentDate: timestamp("treatment_date").notNull(),
  providerType: varchar("provider_type", { length: 50 }).notNull(),
  // "er" | "urgent_care" | "primary_care" | "specialist" | "physical_therapy" |
  // "occupational_medicine" | "diagnostic" | "pharmacy"
  providerName: varchar("provider_name", { length: 200 }),
  providerAddress: text("provider_address"),
  diagnosis: text("diagnosis"),
  icd10Codes: jsonb("icd10_codes").$type<string[]>().default([]),
  procedures: jsonb("procedures").$type<string[]>().default([]),
  medications: jsonb("medications").$type<Array<{ name: string; dosage?: string }>>().default([]),
  workRestrictions: text("work_restrictions"),
  nextVisitOn: timestamp("next_visit_on"),
  costCents: integer("cost_cents"),  // optional — for case cost tracking
  recordedBy: uuid("recorded_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const injuryDocuments = pgTable("injury_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  injuryId: uuid("injury_id").references(() => injuries.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  // "incident_report" | "medical_record" | "wc_claim_form" | "osha_301" |
  // "rtw_note" | "imaging" | "witness_statement" | "photo" | "other"
  fileName: varchar("file_name", { length: 255 }).notNull(),
  storageKey: text("storage_key").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const returnToWorkEvals = pgTable("return_to_work_evals", {
  id: uuid("id").defaultRandom().primaryKey(),
  injuryId: uuid("injury_id").references(() => injuries.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  evaluationDate: timestamp("evaluation_date").notNull(),
  evaluatorId: uuid("evaluator_id").references(() => users.id),
  evaluatorName: varchar("evaluator_name", { length: 200 }),
  status: rtwStatusEnum("status").notNull(),
  releasedToWorkOn: timestamp("released_to_work_on"),
  // Restrictions — structured list so we can aggregate and print them on the RTW note
  restrictions: jsonb("restrictions").$type<string[]>().default([]),
  // Example restrictions: "No lifting over 10 lbs", "No overhead work", "4-hour shifts",
  //                      "Sedentary duty only", "Frequent breaks (every 30 min)"
  followUpRequired: boolean("follow_up_required").default(false).notNull(),
  followUpDate: timestamp("follow_up_date"),
  signedOffByUserId: uuid("signed_off_by_user_id").references(() => users.id),
  signedOffAt: timestamp("signed_off_at"),
  notes: text("notes"),
  documentStorageKey: text("document_storage_key"),  // signed RTW note PDF
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invoices — billing queue
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).unique().notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  eventId: uuid("event_id").references(() => events.id),
  amount: integer("amount"),
  status: invoiceStatusEnum("status").default("pending").notNull(),
  invoicedAt: timestamp("invoiced_at"),
  paidAt: timestamp("paid_at"),
  dueDate: timestamp("due_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invoice Line Items — per-service charges on an invoice
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  serviceName: varchar("service_name", { length: 200 }).notNull(),
  serviceCode: varchar("service_code", { length: 50 }),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: integer("unit_price").notNull(), // cents
  amount: integer("amount").notNull(), // quantity * unitPrice in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Leads — CRM pipeline
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull(),
  companyName: varchar("company_name", { length: 200 }).notNull(),
  contactName: varchar("contact_name", { length: 200 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  contactPhone: varchar("contact_phone", { length: 30 }),
  source: varchar("source", { length: 100 }),
  need: text("need"),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  state: varchar("state", { length: 2 }),
  zip: varchar("zip", { length: 10 }),
  employeeCount: integer("employee_count"),
  stage: leadStageEnum("stage").default("new_lead").notNull(),
  ownedBy: uuid("owned_by").references(() => users.id),
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  notes: text("notes"),
  convertedToOrgId: uuid("converted_to_org_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Lead Email Templates — per-TPA customizable email templates for pipeline stages
export const leadEmailTemplates = pgTable("lead_email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull(),
  stage: leadStageEnum("stage").notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(), // HTML body with {{companyName}}, {{contactName}}, {{tpaName}} placeholders
  isActive: boolean("is_active").default(true).notNull(),
  delayMinutes: integer("delay_minutes").default(0).notNull(), // 0 = send immediately on stage change
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Lead Activities — activity timeline for leads
export const leadActivities = pgTable("lead_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'stage_change', 'email_sent', 'call_reminder', 'note', 'follow_up_scheduled'
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // extra data like { from: 'new_lead', to: 'outreach_sent' }
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Service Requests — client self-service intake
export const serviceRequests = pgTable("service_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id).notNull(),
  submittedBy: uuid("submitted_by").references(() => users.id).notNull(),

  // Request details
  donorFirstName: varchar("donor_first_name", { length: 120 }).notNull(),
  donorLastName: varchar("donor_last_name", { length: 120 }).notNull(),
  donorEmail: varchar("donor_email", { length: 320 }),
  donorPhone: varchar("donor_phone", { length: 30 }),
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  isDOT: boolean("is_dot").default(false).notNull(),
  priority: varchar("priority", { length: 20 }).default("standard"),
  location: text("location").notNull(),
  requestedDate: timestamp("requested_date"),
  notes: text("notes"),

  // Status
  status: serviceRequestStatusEnum("status").default("submitted").notNull(),
  declineReason: text("decline_reason"),
  convertedOrderId: uuid("converted_order_id").references(() => orders.id),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Client Documents — contracts, SOPs, BAAs attached to client orgs (not orders)
export const clientDocuments = pgTable("client_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  kind: varchar("kind", { length: 50 }).notNull(), // 'contract', 'sop', 'baa', 'coc_template', 'general'
  fileName: varchar("file_name", { length: 255 }).notNull(),
  storageUrl: text("storage_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  notes: text("notes"),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// TPA Settings — per-tenant configuration
export const tpaSettings = pgTable("tpa_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull().unique(),
  brandName: varchar("brand_name", { length: 200 }),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 7 }),
  replyToEmail: varchar("reply_to_email", { length: 320 }),
  replyToOrders: varchar("reply_to_orders", { length: 320 }),
  replyToBilling: varchar("reply_to_billing", { length: 320 }),
  replyToLeads: varchar("reply_to_leads", { length: 320 }),
  defaultCollectionWindowHours: integer("default_collection_window_hours").default(24),
  customDomain: varchar("custom_domain", { length: 255 }), // e.g., "jmti" → jmti.tpaplatform.com
  faviconUrl: text("favicon_url"),
  loginMessage: text("login_message"), // Custom message on branded login page
  dotCompanyName: varchar("dot_company_name", { length: 200 }),
  dotConsortiumId: varchar("dot_consortium_id", { length: 100 }),
  timezone: varchar("timezone", { length: 50 }).default("America/Chicago"),
  // Automation toggles
  enableSheetsSync: boolean("enable_sheets_sync").default(false).notNull(),
  enableKitReminders: boolean("enable_kit_reminders").default(true).notNull(),
  enableCollectorConfirmReminders: boolean("enable_collector_confirm_reminders").default(true).notNull(),
  enableResultsPendingDaily: boolean("enable_results_pending_daily").default(true).notNull(),
  enableOrderCompletionEmail: boolean("enable_order_completion_email").default(true).notNull(),
  enableEventCompletionEmail: boolean("enable_event_completion_email").default(true).notNull(),
  enableLeadStageEmails: boolean("enable_lead_stage_emails").default(false).notNull(),
  enableLeadFollowUpReminders: boolean("enable_lead_follow_up_reminders").default(true).notNull(),
  // Pricing — JSON map of serviceType to amount in cents
  defaultServiceRates: jsonb("default_service_rates").$type<Record<string, number>>(),
  dotSurchargeRate: integer("dot_surcharge_rate").default(0),
  defaultPaymentTermDays: integer("default_payment_term_days").default(30),
  defaultEmailFooter: text("default_email_footer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email Templates — per-TPA customizable transactional email templates
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  templateKey: varchar("template_key", { length: 100 }).notNull(), // e.g., "collector_assigned", "order_completion", "annual_review_reminder"
  subject: text("subject"),
  bodyHtml: text("body_html"),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTemplate: uniqueIndex("uq_email_template_tpa_key").on(table.tpaOrgId, table.templateKey),
}));

// Service Catalog — per-TPA customizable service/test types
export const serviceCatalog = pgTable("service_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  category: varchar("category", { length: 30 }).notNull(), // 'drug_testing' | 'occupational_health'
  group: varchar("group", { length: 50 }), // e.g. 'Audiogram', 'Blood/Lab', 'Vision', etc.
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }),
  isDotOnly: boolean("is_dot_only").default(false).notNull(),
  isNonDotOnly: boolean("is_non_dot_only").default(false).notNull(),
  requiresPanel: boolean("requires_panel").default(false).notNull(),
  rate: integer("rate"), // price in cents per service
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reason Catalog — per-TPA customizable reasons for service
export const reasonCatalog = pgTable("reason_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  category: varchar("category", { length: 30 }).notNull(), // 'drug_testing' | 'occupational_health'
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }),
  isDotAllowed: boolean("is_dot_allowed").default(true).notNull(),
  isNonDotAllowed: boolean("is_non_dot_allowed").default(true).notNull(),
  autoUrgent: boolean("auto_urgent").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Panel Codes — drug test panel options
export const panelCodes = pgTable("panel_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Order Checklists — auto-generated from service type templates
export const orderChecklists = pgTable("order_checklists", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  item: varchar("item", { length: 255 }).notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedBy: uuid("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Client Checklist Templates — per-client overrides for service type checklists
export const clientChecklistTemplates = pgTable("client_checklist_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  items: jsonb("items").$type<string[]>().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueClientServiceType: uniqueIndex("uq_client_checklist_client_service").on(table.clientOrgId, table.serviceType),
}));

// Tenant Modules — feature gating per TPA
export const tenantModules = pgTable("tenant_modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  moduleId: varchar("module_id", { length: 50 }).notNull(), // 'drug_testing' | 'dqf' | etc.
  isEnabled: boolean("is_enabled").default(true).notNull(),
  enabledAt: timestamp("enabled_at").defaultNow().notNull(),
  disabledAt: timestamp("disabled_at"),
  config: jsonb("config"), // module-specific config (adapter credentials, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTpaModule: uniqueIndex("uq_tenant_module").on(table.tpaOrgId, table.moduleId),
}));

// ----------------------------------------------------------------------------
// SSO / SAML connections — enterprise authentication per TPA tenant
// ----------------------------------------------------------------------------

export const ssoConnections = pgTable("sso_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // 'saml' | 'oidc'
  // Jackson routing: we scope to (tenant=tpaOrgId, product=tpaenginex)
  jacksonTenant: varchar("jackson_tenant", { length: 100 }).notNull(),
  jacksonProduct: varchar("jackson_product", { length: 100 }).default("tpaenginex").notNull(),
  // IdP metadata — either uploaded XML or a URL to fetch it from
  idpMetadataXml: text("idp_metadata_xml"),
  idpMetadataUrl: text("idp_metadata_url"),
  defaultRedirectUrl: varchar("default_redirect_url", { length: 500 }),
  // JIT provisioning controls
  jitProvisioningEnabled: boolean("jit_provisioning_enabled").default(true).notNull(),
  defaultRoleForJit: varchar("default_role_for_jit", { length: 50 }).default("tpa_staff"),
  allowedEmailDomains: jsonb("allowed_email_domains").$type<string[]>().default([]).notNull(),
  // Status
  isActive: boolean("is_active").default(false).notNull(),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Short-lived one-time tokens for SSO login handoff from ACS to NextAuth credentials provider.
export const ssoLoginTokens = pgTable("sso_login_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // sha256 hex
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  connectionId: uuid("connection_id").references(() => ssoConnections.id, { onDelete: "cascade" }).notNull(),
  // Normalized identity from IdP (already validated by Jackson)
  email: varchar("email", { length: 320 }).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Saved filter views — per-user saved list filters
export const savedFilters = pgTable("saved_filters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  pageKey: varchar("page_key", { length: 50 }).notNull(), // "orders" | "leads" | "dqf_drivers" | etc.
  name: varchar("name", { length: 100 }).notNull(),
  filters: jsonb("filters").notNull(), // { search, status, startDate, endDate, etc. }
  isShared: boolean("is_shared").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User notification preferences — per-user email and in-app toggles
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  // Email preferences
  emailOrderCompletion: boolean("email_order_completion").default(true).notNull(),
  emailCollectorAssigned: boolean("email_collector_assigned").default(true).notNull(),
  emailKitReminder: boolean("email_kit_reminder").default(true).notNull(),
  emailResultsPending: boolean("email_results_pending").default(true).notNull(),
  emailAnnualReview: boolean("email_annual_review").default(true).notNull(),
  emailExpiryAlerts: boolean("email_expiry_alerts").default(true).notNull(),
  emailWeeklyDigest: boolean("email_weekly_digest").default(true).notNull(),
  // In-app preferences
  inAppOrderUpdates: boolean("in_app_order_updates").default(true).notNull(),
  inAppDqfEvents: boolean("in_app_dqf_events").default(true).notNull(),
  inAppSystem: boolean("in_app_system").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Specimens — primary/split specimens per order (extracted from orders)
export const specimenStatusEnum = pgEnum("specimen_status", [
  "pending",
  "collected",
  "shipped",
  "lab_received",
  "testing",
  "reported",
  "rejected",
]);

export const specimens = pgTable("specimens", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  specimenType: varchar("specimen_type", { length: 30 }).notNull().default("primary"), // primary | split
  ccfNumber: varchar("ccf_number", { length: 50 }),
  collectedAt: timestamp("collected_at"),
  collectorId: uuid("collector_id").references(() => collectors.id),
  labReceivedAt: timestamp("lab_received_at"),
  status: specimenStatusEnum("specimen_status").default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Results — per-panel/per-specimen results (extracted from orders)
export const resultValueEnum = pgEnum("result_value", [
  "negative",
  "positive",
  "inconclusive",
  "cancelled",
  "refused",
  "pending",
]);

export const mroDecisionEnum = pgEnum("mro_decision", [
  "verified_negative",
  "verified_positive",
  "test_cancelled",
  "refusal_to_test",
  "pending_review",
]);

export const results = pgTable("results", {
  id: uuid("id").defaultRandom().primaryKey(),
  specimenId: uuid("specimen_id").references(() => specimens.id, { onDelete: "cascade" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  panelType: varchar("panel_type", { length: 50 }).notNull(), // e.g., "5-panel", "10-panel", "alcohol"
  resultValue: resultValueEnum("result_value").default("pending").notNull(),
  mroReviewedAt: timestamp("mro_reviewed_at"),
  mroDecision: mroDecisionEnum("mro_decision"),
  reportedAt: timestamp("reported_at"),
  source: varchar("source", { length: 50 }), // e.g., "manual", "escreen", "crl", "formfox"
  notes: text("notes"),
  rawData: jsonb("raw_data"), // raw lab response for debugging
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// E-SIGNATURE TABLES
// ============================================================================

export const signatures = pgTable("signatures", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id),
  signerName: varchar("signer_name", { length: 200 }).notNull(),
  signerRole: varchar("signer_role", { length: 50 }).notNull(), // "donor", "collector", "employer_rep"
  signatureDataUrl: text("signature_data_url").notNull(), // base64 PNG data URL
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// POCT (Point-of-Care Testing) TABLES
// ============================================================================

// POCT Results — AI cassette reader results captured by mobile collectors
export const poctResults = pgTable("poct_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  specimenId: uuid("specimen_id").references(() => specimens.id, { onDelete: "set null" }),
  collectorId: uuid("collector_id").references(() => collectors.id, { onDelete: "set null" }).notNull(),
  cassetteType: varchar("cassette_type", { length: 100 }).notNull(),
  capturedImageKey: text("captured_image_key").notNull(), // S3 storage key
  imageHash: varchar("image_hash", { length: 64 }), // SHA-256 hex digest for tamper detection
  modelVersion: varchar("model_version", { length: 50 }).notNull(),
  modelConfidence: real("model_confidence"), // overall confidence 0.0-1.0
  classifiedResult: jsonb("classified_result").$type<PoctDrugClassification[]>().notNull(),
  controlLineValid: boolean("control_line_valid").notNull(),
  overallResult: varchar("overall_result", { length: 20 }), // "negative" | "non_negative" | "invalid"
  collectorOverride: jsonb("collector_override").$type<PoctCollectorOverride | null>(),
  collectorConfirmedAt: timestamp("collector_confirmed_at"),
  reviewerUserId: uuid("reviewer_user_id").references(() => users.id),
  reviewerNotes: text("reviewer_notes"),
  reviewedAt: timestamp("reviewed_at"),
  reviewAccepted: boolean("review_accepted"),
  capturedAt: timestamp("captured_at").notNull(),
  processingTimeMs: integer("processing_time_ms"),
  deviceInfo: jsonb("device_info").$type<PoctDeviceInfo | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orderIdx: index("poct_results_order_idx").on(table.orderId),
  tpaCapturedIdx: index("poct_results_tpa_captured_idx").on(table.tpaOrgId, table.capturedAt),
  modelVersionIdx: index("poct_results_model_version_idx").on(table.modelVersion),
}));

// POCT Model Versions — tracks ML model binaries for the cassette reader
export const poctModelVersions = pgTable("poct_model_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  version: varchar("version", { length: 50 }).notNull().unique(), // semver
  description: text("description"),
  architecture: varchar("architecture", { length: 50 }), // "mobilenetv3" | "efficientnet_lite"
  supportedCassetteTypes: jsonb("supported_cassette_types").$type<string[]>().notNull(),
  coremlModelKey: text("coreml_model_key"), // S3 key for .mlmodelc (iOS)
  tfliteModelKey: text("tflite_model_key"), // S3 key for .tflite (Android)
  accuracy: real("accuracy"), // test set accuracy
  falsePositiveRate: real("false_positive_rate"),
  falseNegativeRate: real("false_negative_rate"),
  trainingDatasetSize: integer("training_dataset_size"),
  isActive: boolean("is_active").default(false).notNull(), // only one active version at a time
  activatedAt: timestamp("activated_at"),
  releasedAt: timestamp("released_at"),
  releaseNotes: text("release_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// TypeScript types for POCT JSONB fields
export interface PoctDrugClassification {
  drug: string;
  linePresent: boolean;
  intensity: number;
  result: "negative" | "positive" | "invalid";
}

export interface PoctCollectorOverride {
  overriddenAt: string; // ISO timestamp
  overriddenDrugs: {
    drug: string;
    originalResult: "negative" | "positive" | "invalid";
    overriddenResult: "negative" | "positive" | "invalid";
    reason: string;
  }[];
}

export interface PoctDeviceInfo {
  platform: string;
  osVersion: string;
  deviceModel: string;
  appVersion: string;
}

// ============================================================================
// DQF MODULE TABLES
// ============================================================================

export const dqfApplicationStatusEnum = pgEnum("dqf_application_status", [
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
]);

export const dqfQualificationStatusEnum = pgEnum("dqf_qualification_status", [
  "active",
  "expiring_soon",
  "expired",
  "pending_verification",
  "revoked",
]);

export const dqfReviewStatusEnum = pgEnum("dqf_review_status", [
  "scheduled",
  "in_progress",
  "completed",
  "overdue",
  "cancelled",
]);

// Driver applications — new hire intake
export const driverApplications = pgTable("driver_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  applicationDate: timestamp("application_date").defaultNow().notNull(),
  status: dqfApplicationStatusEnum("status").default("submitted").notNull(),
  previousEmployerContact: jsonb("previous_employer_contact"), // [{name, phone, email, dates}]
  position: varchar("position", { length: 100 }),
  cdlNumber: varchar("cdl_number", { length: 50 }),
  cdlState: varchar("cdl_state", { length: 2 }),
  cdlClass: varchar("cdl_class", { length: 5 }),
  endorsements: jsonb("endorsements").$type<string[]>(), // ["H","N","T","P","X"]
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Driver qualifications — license/med card/endorsements tracking
export const driverQualifications = pgTable("driver_qualifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  qualificationType: varchar("qualification_type", { length: 50 }).notNull(), // "cdl", "medical_card", "mvr", "road_test", "endorsement", etc.
  issuedAt: timestamp("issued_at"),
  expiresAt: timestamp("expires_at"),
  documentId: uuid("document_id").references(() => documents.id),
  status: dqfQualificationStatusEnum("status").default("active").notNull(),
  issuingAuthority: varchar("issuing_authority", { length: 100 }),
  referenceNumber: varchar("reference_number", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// DQF checklists — configurable qualification checklists per client
export const dqfChecklists = pgTable("dqf_checklists", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// DQF checklist items — individual items within a checklist
export const dqfChecklistItems = pgTable("dqf_checklist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  checklistId: uuid("checklist_id").references(() => dqfChecklists.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  isRequired: boolean("is_required").default(true).notNull(),
  qualificationType: varchar("qualification_type", { length: 50 }), // links to driverQualifications.qualificationType
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Annual reviews — scheduling + reminders + sign-off
export const annualReviews = pgTable("annual_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  reviewDate: timestamp("review_date"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  status: dqfReviewStatusEnum("status").default("scheduled").notNull(),
  signedOffBy: uuid("signed_off_by").references(() => users.id),
  signedOffAt: timestamp("signed_off_at"),
  findings: text("findings"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Employer investigations — DOT previous employer contact log
export const employerInvestigations = pgTable("employer_investigations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }).notNull(),
  applicationId: uuid("application_id").references(() => driverApplications.id),
  employerName: varchar("employer_name", { length: 200 }).notNull(),
  contactName: varchar("contact_name", { length: 200 }),
  contactPhone: varchar("contact_phone", { length: 30 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  contactDate: timestamp("contact_date"),
  response: text("response"),
  datesOfEmployment: varchar("dates_of_employment", { length: 100 }),
  positionHeld: varchar("position_held", { length: 100 }),
  reasonForLeaving: varchar("reason_for_leaving", { length: 255 }),
  safetyViolations: boolean("safety_violations").default(false),
  drugAlcoholViolations: boolean("drug_alcohol_violations").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Compliance scores — per-driver + per-client real-time scoring
export const complianceScores = pgTable("compliance_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  personId: uuid("person_id").references(() => persons.id, { onDelete: "restrict" }),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  score: integer("score").notNull(), // 0-100
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  breakdown: jsonb("breakdown"), // { cdl: 100, medCard: 80, mvr: 100, annualReview: 0 }
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Public ticket forms — embeddable driver application intake
export const publicTicketForms = pgTable("public_ticket_forms", {
  id: uuid("id").defaultRandom().primaryKey(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  formName: varchar("form_name", { length: 200 }).notNull(),
  formConfig: jsonb("form_config"), // field definitions, branding, etc.
  isActive: boolean("is_active").default(true).notNull(),
  publicUrl: varchar("public_url", { length: 500 }),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  submissionCount: integer("submission_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  parentTpa: one(organizations, {
    fields: [organizations.tpaOrgId],
    references: [organizations.id],
    relationName: "tpaClients",
  }),
  clientOrgs: many(organizations, { relationName: "tpaClients" }),
  users: many(users),
  persons: many(persons),
  orders: many(orders),
  members: many(organizationMembers),
  locations: many(organizationLocations),
  collectors: many(collectors),
  events: many(events, { relationName: "tpaEvents" }),
  invoices: many(invoices, { relationName: "tpaInvoices" }),
  leads: many(leads),
  tpaSettingsRecord: one(tpaSettings, {
    fields: [organizations.id],
    references: [tpaSettings.tpaOrgId],
  }),
  clientDocumentsAsTpa: many(clientDocuments, { relationName: "tpaClientDocuments" }),
  clientDocumentsAsClient: many(clientDocuments, { relationName: "clientOrgClientDocuments" }),
  clientChecklistTemplatesAsTpa: many(clientChecklistTemplates, { relationName: "tpaChecklistTemplates" }),
  clientChecklistTemplatesAsClient: many(clientChecklistTemplates, { relationName: "clientOrgChecklistTemplates" }),
  tenantModules: many(tenantModules),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  organizationMemberships: many(organizationMembers),
  ordersCreated: many(orders, { relationName: "requestedBy" }),
  appointmentsAssigned: many(appointments, { relationName: "assignedBy" }),
  documentsUploaded: many(documents, { relationName: "uploadedBy" }),
  clientDocumentsUploaded: many(clientDocuments, { relationName: "clientDocUploadedBy" }),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
  ownedLeads: many(leads),
  backupCodes: many(userBackupCodes),
  passwordResetTokens: many(passwordResetTokens),
  emailVerificationTokens: many(emailVerificationTokens),
  loginHistory: many(loginHistory),
  userSessions: many(userSessions),
  dataExportRequests: many(dataExportRequests),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [apiKeys.tpaOrgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
  }),
  usage: many(apiKeyUsage),
}));

export const apiKeyUsageRelations = relations(apiKeyUsage, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [apiKeyUsage.apiKeyId],
    references: [apiKeys.id],
  }),
  tpaOrg: one(organizations, {
    fields: [apiKeyUsage.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const webhookSubscriptionsRelations = relations(webhookSubscriptions, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [webhookSubscriptions.tpaOrgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [webhookSubscriptions.createdBy],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  subscription: one(webhookSubscriptions, {
    fields: [webhookDeliveries.subscriptionId],
    references: [webhookSubscriptions.id],
  }),
  tpaOrg: one(organizations, {
    fields: [webhookDeliveries.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const impersonationSessionsRelations = relations(impersonationSessions, ({ one }) => ({
  adminUser: one(users, {
    fields: [impersonationSessions.adminUserId],
    references: [users.id],
    relationName: "adminImpersonations",
  }),
  targetUser: one(users, {
    fields: [impersonationSessions.targetUserId],
    references: [users.id],
    relationName: "targetImpersonations",
  }),
}));

export const accountDeletionRequestsRelations = relations(accountDeletionRequests, ({ one }) => ({
  user: one(users, {
    fields: [accountDeletionRequests.userId],
    references: [users.id],
  }),
}));

export const dataExportRequestsRelations = relations(dataExportRequests, ({ one }) => ({
  user: one(users, {
    fields: [dataExportRequests.userId],
    references: [users.id],
  }),
}));

export const userBackupCodesRelations = relations(userBackupCodes, ({ one }) => ({
  user: one(users, {
    fields: [userBackupCodes.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationTokens.userId],
    references: [users.id],
  }),
}));

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, {
    fields: [loginHistory.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const personsRelations = relations(persons, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [persons.orgId],
    references: [organizations.id],
  }),
  orders: many(orders),
  driverApplications: many(driverApplications),
  driverQualifications: many(driverQualifications),
  complianceScores: many(complianceScores),
  employerInvestigations: many(employerInvestigations),
}));

export const collectorsRelations = relations(collectors, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [collectors.tpaOrgId],
    references: [organizations.id],
  }),
  orders: many(orders),
  events: many(events),
  pushTokens: many(collectorPushTokens),
  poctResults: many(poctResults),
}));

export const collectorPushTokensRelations = relations(collectorPushTokens, ({ one }) => ({
  collector: one(collectors, {
    fields: [collectorPushTokens.collectorId],
    references: [collectors.id],
  }),
  tpaOrg: one(organizations, {
    fields: [collectorPushTokens.tpaOrgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [collectorPushTokens.userId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orders.orgId],
    references: [organizations.id],
  }),
  clientOrg: one(organizations, {
    fields: [orders.clientOrgId],
    references: [organizations.id],
    relationName: "clientOrders",
  }),
  person: one(persons, {
    fields: [orders.personId],
    references: [persons.id],
  }),
  collector: one(collectors, {
    fields: [orders.collectorId],
    references: [collectors.id],
  }),
  event: one(events, {
    fields: [orders.eventId],
    references: [events.id],
  }),
  requestedByUser: one(users, {
    fields: [orders.requestedBy],
    references: [users.id],
    relationName: "requestedBy",
  }),
  appointments: many(appointments),
  documents: many(documents),
  reviews: many(orderReviews),
  invoices: many(invoices),
  checklists: many(orderChecklists),
  specimens: many(specimens),
  results: many(results),
  signatures: many(signatures),
  poctResults: many(poctResults),
}));

export const specimensRelations = relations(specimens, ({ one, many }) => ({
  order: one(orders, {
    fields: [specimens.orderId],
    references: [orders.id],
  }),
  tpaOrg: one(organizations, {
    fields: [specimens.tpaOrgId],
    references: [organizations.id],
  }),
  collector: one(collectors, {
    fields: [specimens.collectorId],
    references: [collectors.id],
  }),
  results: many(results),
}));

export const resultsRelations = relations(results, ({ one }) => ({
  specimen: one(specimens, {
    fields: [results.specimenId],
    references: [specimens.id],
  }),
  order: one(orders, {
    fields: [results.orderId],
    references: [orders.id],
  }),
  tpaOrg: one(organizations, {
    fields: [results.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const signaturesRelations = relations(signatures, ({ one }) => ({
  tpaOrg: one(organizations, { fields: [signatures.tpaOrgId], references: [organizations.id] }),
  order: one(orders, { fields: [signatures.orderId], references: [orders.id] }),
  document: one(documents, { fields: [signatures.documentId], references: [documents.id] }),
}));

export const poctResultsRelations = relations(poctResults, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [poctResults.tpaOrgId],
    references: [organizations.id],
  }),
  order: one(orders, {
    fields: [poctResults.orderId],
    references: [orders.id],
  }),
  specimen: one(specimens, {
    fields: [poctResults.specimenId],
    references: [specimens.id],
  }),
  collector: one(collectors, {
    fields: [poctResults.collectorId],
    references: [collectors.id],
  }),
  reviewer: one(users, {
    fields: [poctResults.reviewerUserId],
    references: [users.id],
  }),
}));

export const sitesRelations = relations(sites, ({ many }) => ({
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  order: one(orders, {
    fields: [appointments.orderId],
    references: [orders.id],
  }),
  site: one(sites, {
    fields: [appointments.siteId],
    references: [sites.id],
  }),
  assignedByUser: one(users, {
    fields: [appointments.assignedBy],
    references: [users.id],
    relationName: "assignedBy",
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  order: one(orders, {
    fields: [documents.orderId],
    references: [orders.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
    relationName: "uploadedBy",
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  invitedByUser: one(users, {
    fields: [organizationMembers.invitedBy],
    references: [users.id],
  }),
}));

export const orderReviewsRelations = relations(orderReviews, ({ one }) => ({
  order: one(orders, {
    fields: [orderReviews.orderId],
    references: [orders.id],
  }),
  reviewer: one(users, {
    fields: [orderReviews.reviewedBy],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [notifications.orderId],
    references: [orders.id],
  }),
}));

export const organizationLocationsRelations = relations(organizationLocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationLocations.orgId],
    references: [organizations.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [events.tpaOrgId],
    references: [organizations.id],
    relationName: "tpaEvents",
  }),
  clientOrg: one(organizations, {
    fields: [events.clientOrgId],
    references: [organizations.id],
  }),
  collector: one(collectors, {
    fields: [events.collectorId],
    references: [collectors.id],
  }),
  orders: many(orders),
  invoices: many(invoices),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const randomProgramsRelations = relations(randomPrograms, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [randomPrograms.tpaOrgId],
    references: [organizations.id],
  }),
  clientOrg: one(organizations, {
    fields: [randomPrograms.clientOrgId],
    references: [organizations.id],
    relationName: "clientRandomPrograms",
  }),
  pools: many(randomPools),
}));

export const randomPoolsRelations = relations(randomPools, ({ one, many }) => ({
  program: one(randomPrograms, {
    fields: [randomPools.programId],
    references: [randomPrograms.id],
  }),
  tpaOrg: one(organizations, {
    fields: [randomPools.tpaOrgId],
    references: [organizations.id],
  }),
  selectedByUser: one(users, {
    fields: [randomPools.selectedBy],
    references: [users.id],
  }),
  members: many(randomPoolMembers),
  selections: many(randomSelections),
}));

export const randomPoolMembersRelations = relations(randomPoolMembers, ({ one }) => ({
  pool: one(randomPools, {
    fields: [randomPoolMembers.poolId],
    references: [randomPools.id],
  }),
  person: one(persons, {
    fields: [randomPoolMembers.personId],
    references: [persons.id],
  }),
}));

export const randomSelectionsRelations = relations(randomSelections, ({ one }) => ({
  pool: one(randomPools, {
    fields: [randomSelections.poolId],
    references: [randomPools.id],
  }),
  person: one(persons, {
    fields: [randomSelections.personId],
    references: [persons.id],
  }),
  tpaOrg: one(organizations, {
    fields: [randomSelections.tpaOrgId],
    references: [organizations.id],
  }),
  order: one(orders, {
    fields: [randomSelections.orderId],
    references: [orders.id],
  }),
}));

// Occupational Health relations

export const physicalExamsRelations = relations(physicalExams, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [physicalExams.tpaOrgId],
    references: [organizations.id],
  }),
  clientOrg: one(organizations, {
    fields: [physicalExams.clientOrgId],
    references: [organizations.id],
    relationName: "clientPhysicalExams",
  }),
  person: one(persons, {
    fields: [physicalExams.personId],
    references: [persons.id],
  }),
  examiner: one(users, {
    fields: [physicalExams.examinerId],
    references: [users.id],
    relationName: "examinerPhysicalExams",
  }),
  healthHistory: one(physicalExamHealthHistory, {
    fields: [physicalExams.id],
    references: [physicalExamHealthHistory.examId],
  }),
  vitals: one(physicalExamVitals, {
    fields: [physicalExams.id],
    references: [physicalExamVitals.examId],
  }),
  findings: many(physicalExamFindings),
  batTests: many(batTests),
}));

export const physicalExamHealthHistoryRelations = relations(physicalExamHealthHistory, ({ one }) => ({
  exam: one(physicalExams, {
    fields: [physicalExamHealthHistory.examId],
    references: [physicalExams.id],
  }),
}));

export const physicalExamVitalsRelations = relations(physicalExamVitals, ({ one }) => ({
  exam: one(physicalExams, {
    fields: [physicalExamVitals.examId],
    references: [physicalExams.id],
  }),
}));

export const physicalExamFindingsRelations = relations(physicalExamFindings, ({ one }) => ({
  exam: one(physicalExams, {
    fields: [physicalExamFindings.examId],
    references: [physicalExams.id],
  }),
}));

export const batTestsRelations = relations(batTests, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [batTests.tpaOrgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [batTests.personId],
    references: [persons.id],
  }),
  order: one(orders, {
    fields: [batTests.orderId],
    references: [orders.id],
  }),
  exam: one(physicalExams, {
    fields: [batTests.examId],
    references: [physicalExams.id],
  }),
  technician: one(users, {
    fields: [batTests.batTechnicianId],
    references: [users.id],
    relationName: "batTechnician",
  }),
}));

export const vaccinationsRelations = relations(vaccinations, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [vaccinations.tpaOrgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [vaccinations.personId],
    references: [persons.id],
  }),
  administeredByUser: one(users, {
    fields: [vaccinations.administeredBy],
    references: [users.id],
    relationName: "vaccinationAdminister",
  }),
}));

export const respiratorFitTestsRelations = relations(respiratorFitTests, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [respiratorFitTests.tpaOrgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [respiratorFitTests.personId],
    references: [persons.id],
  }),
  testedByUser: one(users, {
    fields: [respiratorFitTests.testedBy],
    references: [users.id],
    relationName: "fitTestTester",
  }),
}));

// Background screening relations

export const backgroundCheckPackagesRelations = relations(backgroundCheckPackages, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [backgroundCheckPackages.tpaOrgId],
    references: [organizations.id],
  }),
  checks: many(backgroundChecks),
}));

export const backgroundChecksRelations = relations(backgroundChecks, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [backgroundChecks.tpaOrgId],
    references: [organizations.id],
  }),
  clientOrg: one(organizations, {
    fields: [backgroundChecks.clientOrgId],
    references: [organizations.id],
    relationName: "clientBackgroundChecks",
  }),
  person: one(persons, {
    fields: [backgroundChecks.personId],
    references: [persons.id],
  }),
  package: one(backgroundCheckPackages, {
    fields: [backgroundChecks.packageId],
    references: [backgroundCheckPackages.id],
  }),
  requestedByUser: one(users, {
    fields: [backgroundChecks.requestedBy],
    references: [users.id],
    relationName: "backgroundCheckRequester",
  }),
  charges: many(backgroundCheckCharges),
}));

export const backgroundCheckChargesRelations = relations(backgroundCheckCharges, ({ one }) => ({
  check: one(backgroundChecks, {
    fields: [backgroundCheckCharges.checkId],
    references: [backgroundChecks.id],
  }),
  tpaOrg: one(organizations, {
    fields: [backgroundCheckCharges.tpaOrgId],
    references: [organizations.id],
  }),
  invoice: one(invoices, {
    fields: [backgroundCheckCharges.invoiceId],
    references: [invoices.id],
  }),
}));

// Injury care relations

export const injuriesRelations = relations(injuries, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [injuries.tpaOrgId],
    references: [organizations.id],
  }),
  clientOrg: one(organizations, {
    fields: [injuries.clientOrgId],
    references: [organizations.id],
    relationName: "clientInjuries",
  }),
  person: one(persons, {
    fields: [injuries.personId],
    references: [persons.id],
  }),
  reportedByUser: one(users, {
    fields: [injuries.reportedBy],
    references: [users.id],
    relationName: "injuryReporter",
  }),
  treatments: many(injuryTreatments),
  documents: many(injuryDocuments),
  rtwEvals: many(returnToWorkEvals),
}));

export const injuryTreatmentsRelations = relations(injuryTreatments, ({ one }) => ({
  injury: one(injuries, {
    fields: [injuryTreatments.injuryId],
    references: [injuries.id],
  }),
  tpaOrg: one(organizations, {
    fields: [injuryTreatments.tpaOrgId],
    references: [organizations.id],
  }),
  recordedByUser: one(users, {
    fields: [injuryTreatments.recordedBy],
    references: [users.id],
    relationName: "treatmentRecorder",
  }),
}));

export const injuryDocumentsRelations = relations(injuryDocuments, ({ one }) => ({
  injury: one(injuries, {
    fields: [injuryDocuments.injuryId],
    references: [injuries.id],
  }),
  tpaOrg: one(organizations, {
    fields: [injuryDocuments.tpaOrgId],
    references: [organizations.id],
  }),
  uploadedByUser: one(users, {
    fields: [injuryDocuments.uploadedBy],
    references: [users.id],
    relationName: "injuryDocUploader",
  }),
}));

export const returnToWorkEvalsRelations = relations(returnToWorkEvals, ({ one }) => ({
  injury: one(injuries, {
    fields: [returnToWorkEvals.injuryId],
    references: [injuries.id],
  }),
  tpaOrg: one(organizations, {
    fields: [returnToWorkEvals.tpaOrgId],
    references: [organizations.id],
  }),
  evaluator: one(users, {
    fields: [returnToWorkEvals.evaluatorId],
    references: [users.id],
    relationName: "rtwEvaluator",
  }),
  signedOffByUser: one(users, {
    fields: [returnToWorkEvals.signedOffByUserId],
    references: [users.id],
    relationName: "rtwSignedOffBy",
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  lineItems: many(invoiceLineItems),
  tpaOrg: one(organizations, {
    fields: [invoices.tpaOrgId],
    references: [organizations.id],
    relationName: "tpaInvoices",
  }),
  clientOrg: one(organizations, {
    fields: [invoices.clientOrgId],
    references: [organizations.id],
  }),
  order: one(orders, {
    fields: [invoices.orderId],
    references: [orders.id],
  }),
  event: one(events, {
    fields: [invoices.eventId],
    references: [events.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [leads.tpaOrgId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [leads.ownedBy],
    references: [users.id],
  }),
  convertedOrg: one(organizations, {
    fields: [leads.convertedToOrgId],
    references: [organizations.id],
  }),
  activities: many(leadActivities),
}));

export const leadEmailTemplatesRelations = relations(leadEmailTemplates, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [leadEmailTemplates.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id],
  }),
  tpaOrg: one(organizations, {
    fields: [leadActivities.tpaOrgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [leadActivities.createdBy],
    references: [users.id],
  }),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [serviceRequests.tpaOrgId],
    references: [organizations.id],
    relationName: "tpaServiceRequests",
  }),
  clientOrg: one(organizations, {
    fields: [serviceRequests.clientOrgId],
    references: [organizations.id],
    relationName: "clientServiceRequests",
  }),
  submitter: one(users, {
    fields: [serviceRequests.submittedBy],
    references: [users.id],
    relationName: "submittedServiceRequests",
  }),
  reviewer: one(users, {
    fields: [serviceRequests.reviewedBy],
    references: [users.id],
    relationName: "reviewedServiceRequests",
  }),
  convertedOrder: one(orders, {
    fields: [serviceRequests.convertedOrderId],
    references: [orders.id],
  }),
}));

export const orderChecklistsRelations = relations(orderChecklists, ({ one }) => ({
  order: one(orders, {
    fields: [orderChecklists.orderId],
    references: [orders.id],
  }),
  completedByUser: one(users, {
    fields: [orderChecklists.completedBy],
    references: [users.id],
  }),
}));

export const tpaSettingsRelations = relations(tpaSettings, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [tpaSettings.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [emailTemplates.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const clientDocumentsRelations = relations(clientDocuments, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [clientDocuments.tpaOrgId],
    references: [organizations.id],
    relationName: "tpaClientDocuments",
  }),
  clientOrg: one(organizations, {
    fields: [clientDocuments.clientOrgId],
    references: [organizations.id],
    relationName: "clientOrgClientDocuments",
  }),
  uploadedByUser: one(users, {
    fields: [clientDocuments.uploadedBy],
    references: [users.id],
    relationName: "clientDocUploadedBy",
  }),
}));

export const clientChecklistTemplatesRelations = relations(clientChecklistTemplates, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [clientChecklistTemplates.tpaOrgId],
    references: [organizations.id],
    relationName: "tpaChecklistTemplates",
  }),
  clientOrg: one(organizations, {
    fields: [clientChecklistTemplates.clientOrgId],
    references: [organizations.id],
    relationName: "clientOrgChecklistTemplates",
  }),
}));

export const serviceCatalogRelations = relations(serviceCatalog, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [serviceCatalog.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const reasonCatalogRelations = relations(reasonCatalog, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [reasonCatalog.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const panelCodesRelations = relations(panelCodes, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [panelCodes.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const tenantModulesRelations = relations(tenantModules, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [tenantModules.tpaOrgId],
    references: [organizations.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

export const savedFiltersRelations = relations(savedFilters, ({ one }) => ({
  user: one(users, {
    fields: [savedFilters.userId],
    references: [users.id],
  }),
  tpaOrg: one(organizations, {
    fields: [savedFilters.tpaOrgId],
    references: [organizations.id],
  }),
}));

// DQF Relations

export const driverApplicationsRelations = relations(driverApplications, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [driverApplications.tpaOrgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [driverApplications.personId],
    references: [persons.id],
  }),
  clientOrg: one(organizations, {
    fields: [driverApplications.clientOrgId],
    references: [organizations.id],
    relationName: "clientApplications",
  }),
  investigations: many(employerInvestigations),
}));

export const driverQualificationsRelations = relations(driverQualifications, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [driverQualifications.tpaOrgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [driverQualifications.personId],
    references: [persons.id],
  }),
  document: one(documents, {
    fields: [driverQualifications.documentId],
    references: [documents.id],
  }),
}));

export const dqfChecklistsRelations = relations(dqfChecklists, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [dqfChecklists.tpaOrgId],
    references: [organizations.id],
  }),
  clientOrg: one(organizations, {
    fields: [dqfChecklists.clientOrgId],
    references: [organizations.id],
    relationName: "clientChecklists",
  }),
  items: many(dqfChecklistItems),
}));

export const dqfChecklistItemsRelations = relations(dqfChecklistItems, ({ one }) => ({
  checklist: one(dqfChecklists, {
    fields: [dqfChecklistItems.checklistId],
    references: [dqfChecklists.id],
  }),
}));

export const annualReviewsRelations = relations(annualReviews, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [annualReviews.tpaOrgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [annualReviews.personId],
    references: [persons.id],
  }),
  clientOrg: one(organizations, {
    fields: [annualReviews.clientOrgId],
    references: [organizations.id],
    relationName: "clientReviews",
  }),
  signedOffByUser: one(users, {
    fields: [annualReviews.signedOffBy],
    references: [users.id],
  }),
}));

export const employerInvestigationsRelations = relations(employerInvestigations, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [employerInvestigations.tpaOrgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [employerInvestigations.personId],
    references: [persons.id],
  }),
  application: one(driverApplications, {
    fields: [employerInvestigations.applicationId],
    references: [driverApplications.id],
  }),
}));

export const complianceScoresRelations = relations(complianceScores, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [complianceScores.tpaOrgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [complianceScores.personId],
    references: [persons.id],
  }),
  clientOrg: one(organizations, {
    fields: [complianceScores.clientOrgId],
    references: [organizations.id],
    relationName: "clientComplianceScores",
  }),
}));

export const ssoConnectionsRelations = relations(ssoConnections, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [ssoConnections.tpaOrgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [ssoConnections.createdBy],
    references: [users.id],
  }),
}));

export const ssoLoginTokensRelations = relations(ssoLoginTokens, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [ssoLoginTokens.tpaOrgId],
    references: [organizations.id],
  }),
  connection: one(ssoConnections, {
    fields: [ssoLoginTokens.connectionId],
    references: [ssoConnections.id],
  }),
}));

export const publicTicketFormsRelations = relations(publicTicketForms, ({ one }) => ({
  tpaOrg: one(organizations, {
    fields: [publicTicketForms.tpaOrgId],
    references: [organizations.id],
  }),
  clientOrg: one(organizations, {
    fields: [publicTicketForms.clientOrgId],
    references: [organizations.id],
    relationName: "clientTicketForms",
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type OrganizationType = typeof organizations.$inferSelect;
export type UserType = typeof users.$inferSelect;
export type UserBackupCodeType = typeof userBackupCodes.$inferSelect;
export type PasswordResetTokenType = typeof passwordResetTokens.$inferSelect;
export type EmailVerificationTokenType = typeof emailVerificationTokens.$inferSelect;
export type LoginHistoryType = typeof loginHistory.$inferSelect;
export type UserSessionType = typeof userSessions.$inferSelect;
export type ApiKeyType = typeof apiKeys.$inferSelect;
export type ApiKeyUsageType = typeof apiKeyUsage.$inferSelect;
export type WebhookSubscriptionType = typeof webhookSubscriptions.$inferSelect;
export type WebhookDeliveryType = typeof webhookDeliveries.$inferSelect;
export type ImpersonationSessionType = typeof impersonationSessions.$inferSelect;
export type AccountDeletionRequestType = typeof accountDeletionRequests.$inferSelect;
export type DataExportRequestType = typeof dataExportRequests.$inferSelect;
export type AccountType = typeof accounts.$inferSelect;
export type SessionType = typeof sessions.$inferSelect;
export type VerificationTokenType = typeof verificationTokens.$inferSelect;
export type PersonType = typeof persons.$inferSelect;
export type CollectorType = typeof collectors.$inferSelect;
export type OrderType = typeof orders.$inferSelect;
export type SiteType = typeof sites.$inferSelect;
export type AppointmentType = typeof appointments.$inferSelect;
export type DocumentType = typeof documents.$inferSelect;
export type AuditLogType = typeof auditLogs.$inferSelect;
export type OrganizationMemberType = typeof organizationMembers.$inferSelect;
export type OrderReviewType = typeof orderReviews.$inferSelect;
export type NotificationType = typeof notifications.$inferSelect;
export type OrganizationLocationType = typeof organizationLocations.$inferSelect;
export type EventType = typeof events.$inferSelect;
export type InvoiceType = typeof invoices.$inferSelect;
export type LeadType = typeof leads.$inferSelect;
export type LeadEmailTemplateType = typeof leadEmailTemplates.$inferSelect;
export type LeadActivityType = typeof leadActivities.$inferSelect;
export type TpaSettingsType = typeof tpaSettings.$inferSelect;
export type EmailTemplateType = typeof emailTemplates.$inferSelect;
export type OrderChecklistType = typeof orderChecklists.$inferSelect;
export type ServiceRequestType = typeof serviceRequests.$inferSelect;
export type ClientDocumentType = typeof clientDocuments.$inferSelect;
export type TenantModuleType = typeof tenantModules.$inferSelect;
export type SavedFilterType = typeof savedFilters.$inferSelect;
export type UserNotificationPreferencesType = typeof userNotificationPreferences.$inferSelect;
export type ClientChecklistTemplateType = typeof clientChecklistTemplates.$inferSelect;
export type ServiceCatalogType = typeof serviceCatalog.$inferSelect;
export type ReasonCatalogType = typeof reasonCatalog.$inferSelect;
export type PanelCodeType = typeof panelCodes.$inferSelect;
export type SpecimenType = typeof specimens.$inferSelect;
export type ResultType = typeof results.$inferSelect;
export type DriverApplicationType = typeof driverApplications.$inferSelect;
export type DriverQualificationType = typeof driverQualifications.$inferSelect;
export type DqfChecklistType = typeof dqfChecklists.$inferSelect;
export type DqfChecklistItemType = typeof dqfChecklistItems.$inferSelect;
export type AnnualReviewType = typeof annualReviews.$inferSelect;
export type EmployerInvestigationType = typeof employerInvestigations.$inferSelect;
export type ComplianceScoreType = typeof complianceScores.$inferSelect;
export type PublicTicketFormType = typeof publicTicketForms.$inferSelect;
export type SignatureType = typeof signatures.$inferSelect;
export type RandomProgramType = typeof randomPrograms.$inferSelect;
export type RandomPoolType = typeof randomPools.$inferSelect;
export type RandomPoolMemberType = typeof randomPoolMembers.$inferSelect;
export type RandomSelectionType = typeof randomSelections.$inferSelect;
export type PhysicalExamType = typeof physicalExams.$inferSelect;
export type PhysicalExamHealthHistoryType = typeof physicalExamHealthHistory.$inferSelect;
export type PhysicalExamVitalsType = typeof physicalExamVitals.$inferSelect;
export type PhysicalExamFindingType = typeof physicalExamFindings.$inferSelect;
export type BatTestType = typeof batTests.$inferSelect;
export type VaccinationType = typeof vaccinations.$inferSelect;
export type RespiratorFitTestType = typeof respiratorFitTests.$inferSelect;
export type BackgroundCheckPackageType = typeof backgroundCheckPackages.$inferSelect;
export type BackgroundCheckType = typeof backgroundChecks.$inferSelect;
export type BackgroundCheckChargeType = typeof backgroundCheckCharges.$inferSelect;
export type InjuryType = typeof injuries.$inferSelect;
export type InjuryTreatmentType = typeof injuryTreatments.$inferSelect;
export type InjuryDocumentType = typeof injuryDocuments.$inferSelect;
export type ReturnToWorkEvalType = typeof returnToWorkEvals.$inferSelect;
export type SsoConnectionType = typeof ssoConnections.$inferSelect;
export type SsoLoginTokenType = typeof ssoLoginTokens.$inferSelect;
export type CollectorPushTokenType = typeof collectorPushTokens.$inferSelect;
export type PoctResultType = typeof poctResults.$inferSelect;
export type PoctModelVersionType = typeof poctModelVersions.$inferSelect;
