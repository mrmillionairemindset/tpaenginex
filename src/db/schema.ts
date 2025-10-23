import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, uuid, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const organizationTypeEnum = pgEnum("organization_type", ["employer", "provider"]);
export const userRoleEnum = pgEnum("user_role", [
  "employer_admin",
  "employer_user",
  "provider_admin",
  "provider_agent"
]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "needs_site",
  "scheduled",
  "in_progress",
  "results_uploaded",  // Provider uploaded results, not yet submitted
  "pending_review",    // Results submitted, awaiting employer review
  "needs_correction",  // Employer rejected, needs provider correction
  "complete",
  "cancelled"
]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "proposed",
  "confirmed",
  "completed",
  "no_show",
  "cancelled"
]);
export const documentKindEnum = pgEnum("document_kind", [
  "result",
  "chain_of_custody",
  "consent",
  "authorization",
  "other"
]);
export const reviewActionEnum = pgEnum("review_action", [
  "approved",
  "rejected"
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
  "general"
]);

// ============================================================================
// TABLES
// ============================================================================

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 100 }).unique().notNull(), // Replaced clerkOrgId with slug
  name: varchar("name", { length: 200 }).notNull(),
  type: organizationTypeEnum("type").notNull(),
  billingTier: varchar("billing_tier", { length: 50 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  contactPhone: varchar("contact_phone", { length: 30 }),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  state: varchar("state", { length: 2 }),
  zip: varchar("zip", { length: 10 }),
  isActive: boolean("is_active").default(true).notNull(),
  authExpiryDays: integer("auth_expiry_days").default(3).notNull(), // Days until authorization expires
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
  password: varchar("password", { length: 255 }), // For credentials provider
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }), // Current/active organization
  role: userRoleEnum("role"), // Role in current organization
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
  name: varchar("name", { length: 200 }).notNull(), // e.g., "Main Office", "Warehouse 3"
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
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  dob: varchar("dob", { length: 10 }).notNull(), // Required: MM/DD/YYYY
  ssnLast4: varchar("ssn_last4", { length: 4 }).notNull(), // Required: Last 4 of SSN
  phone: varchar("phone", { length: 30 }).notNull(), // Required
  email: varchar("email", { length: 320 }).notNull(), // Required
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

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "restrict" }).notNull(),
  orderNumber: varchar("order_number", { length: 50 }).unique().notNull(),
  testType: varchar("test_type", { length: 100 }).notNull(),
  urgency: varchar("urgency", { length: 30 }).default("standard"),
  jobsiteLocation: varchar("jobsite_location", { length: 255 }).notNull(), // Required: Jobsite/work location
  requestedBy: uuid("requested_by").references(() => users.id),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  status: orderStatusEnum("status").default("new").notNull(),
  externalRowId: varchar("external_row_id", { length: 40 }),
  scheduledFor: timestamp("scheduled_for"),
  completedAt: timestamp("completed_at"),
  authCreatedAt: timestamp("auth_created_at"), // When provider created authorization in Concentra HUB
  authExpiresAt: timestamp("auth_expires_at"), // Calculated expiration based on authCreatedAt + org.authExpiryDays
  authConfirmationEmail: text("auth_confirmation_email"), // Email body/ID that started the timer
  authNumber: varchar("auth_number", { length: 100 }), // Authorization number from provider system
  autoTimerStarted: boolean("auto_timer_started").default(false), // Whether timer was started automatically via email
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  candidates: many(candidates),
  orders: many(orders),
  members: many(organizationMembers),
  locations: many(organizationLocations),
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
  auditLogs: many(auditLogs),
  notifications: many(notifications),
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

export const ordersRelations = relations(orders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orders.orgId],
    references: [organizations.id],
  }),
  candidate: one(candidates, {
    fields: [orders.candidateId],
    references: [candidates.id],
  }),
  requestedByUser: one(users, {
    fields: [orders.requestedBy],
    references: [users.id],
    relationName: "requestedBy",
  }),
  appointments: many(appointments),
  documents: many(documents),
  reviews: many(orderReviews),
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

// Type exports for TypeScript
export type OrganizationType = typeof organizations.$inferSelect;
export type UserType = typeof users.$inferSelect;
export type AccountType = typeof accounts.$inferSelect;
export type SessionType = typeof sessions.$inferSelect;
export type VerificationTokenType = typeof verificationTokens.$inferSelect;
export type CandidateType = typeof candidates.$inferSelect;
export type OrderType = typeof orders.$inferSelect;
export type SiteType = typeof sites.$inferSelect;
export type AppointmentType = typeof appointments.$inferSelect;
export type DocumentType = typeof documents.$inferSelect;
export type AuditLogType = typeof auditLogs.$inferSelect;
export type OrganizationMemberType = typeof organizationMembers.$inferSelect;
export type OrderReviewType = typeof orderReviews.$inferSelect;
export type NotificationType = typeof notifications.$inferSelect;
export type OrganizationLocationType = typeof organizationLocations.$inferSelect;
