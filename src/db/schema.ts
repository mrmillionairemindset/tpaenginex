import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const candidates = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
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

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  tpaOrgId: uuid("tpa_org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  clientOrgId: uuid("client_org_id").references(() => organizations.id),
  clientLabel: varchar("client_label", { length: 255 }),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "restrict" }).notNull(),
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
  candidates: many(candidates),
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

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [candidates.orgId],
    references: [organizations.id],
  }),
  orders: many(orders),
}));

export const collectorsRelations = relations(collectors, ({ one, many }) => ({
  tpaOrg: one(organizations, {
    fields: [collectors.tpaOrgId],
    references: [organizations.id],
  }),
  orders: many(orders),
  events: many(events),
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
  candidate: one(candidates, {
    fields: [orders.candidateId],
    references: [candidates.id],
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

export const invoicesRelations = relations(invoices, ({ one }) => ({
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

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type OrganizationType = typeof organizations.$inferSelect;
export type UserType = typeof users.$inferSelect;
export type AccountType = typeof accounts.$inferSelect;
export type SessionType = typeof sessions.$inferSelect;
export type VerificationTokenType = typeof verificationTokens.$inferSelect;
export type CandidateType = typeof candidates.$inferSelect;
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
export type OrderChecklistType = typeof orderChecklists.$inferSelect;
export type ServiceRequestType = typeof serviceRequests.$inferSelect;
export type ClientDocumentType = typeof clientDocuments.$inferSelect;
export type ClientChecklistTemplateType = typeof clientChecklistTemplates.$inferSelect;
export type ServiceCatalogType = typeof serviceCatalog.$inferSelect;
export type ReasonCatalogType = typeof reasonCatalog.$inferSelect;
export type PanelCodeType = typeof panelCodes.$inferSelect;
