-- TPA Platform Pivot Migration
-- Converts single-provider model to multi-tenant TPA SaaS

-- ============================================================================
-- 1. ENUM CHANGES
-- ============================================================================

-- Update organization_type enum: employer|provider → platform|tpa|client
ALTER TYPE "organization_type" RENAME VALUE 'employer' TO 'client';
ALTER TYPE "organization_type" RENAME VALUE 'provider' TO 'tpa';
ALTER TYPE "organization_type" ADD VALUE IF NOT EXISTS 'platform' BEFORE 'tpa';

-- Update user_role enum: old 4 roles → new 6 roles
ALTER TYPE "user_role" RENAME VALUE 'employer_admin' TO 'client_admin';
ALTER TYPE "user_role" RENAME VALUE 'employer_user' TO 'tpa_billing';
ALTER TYPE "user_role" RENAME VALUE 'provider_admin' TO 'tpa_admin';
ALTER TYPE "user_role" RENAME VALUE 'provider_agent' TO 'tpa_staff';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'tpa_records' AFTER 'tpa_staff';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'platform_admin' BEFORE 'tpa_admin';

-- Add new notification types
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'collector_assigned';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'collection_complete';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'kit_reminder';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'collector_confirm_reminder';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'results_pending_followup';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'order_completed_client';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'billing_queued';

-- New enums for new tables
CREATE TYPE "event_status" AS ENUM ('scheduled', 'in_progress', 'partially_complete', 'complete', 'cancelled');
CREATE TYPE "invoice_status" AS ENUM ('pending', 'sent', 'paid', 'overdue', 'voided');
CREATE TYPE "lead_stage" AS ENUM ('new_lead', 'outreach_sent', 'proposal_sent', 'follow_up', 'contract_sent', 'closed_won', 'closed_lost');

-- ============================================================================
-- 2. NEW TABLES (created first so FKs can reference them)
-- ============================================================================

-- Collectors: mobile PRN collectors dispatched to job sites
CREATE TABLE IF NOT EXISTS "collectors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "first_name" varchar(120) NOT NULL,
  "last_name" varchar(120) NOT NULL,
  "email" varchar(320) NOT NULL,
  "phone" varchar(30) NOT NULL,
  "certifications" jsonb,
  "service_area" text,
  "is_available" boolean NOT NULL DEFAULT true,
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Events: batch/random pull tracking
CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "client_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "event_number" varchar(50) NOT NULL UNIQUE,
  "service_type" varchar(50) NOT NULL,
  "collector_id" uuid REFERENCES "collectors"("id"),
  "location" text NOT NULL,
  "scheduled_date" timestamp NOT NULL,
  "total_ordered" integer NOT NULL,
  "total_completed" integer NOT NULL DEFAULT 0,
  "total_pending" integer NOT NULL DEFAULT 0,
  "status" "event_status" NOT NULL DEFAULT 'scheduled',
  "kit_mailed_at" timestamp,
  "collector_confirmed_at" timestamp,
  "completion_email_sent_at" timestamp,
  "pending_follow_up_until" timestamp,
  "notes" text,
  "internal_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Invoices: billing queue
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "invoice_number" varchar(50) NOT NULL UNIQUE,
  "client_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "order_id" uuid REFERENCES "orders"("id"),
  "event_id" uuid REFERENCES "events"("id"),
  "amount" integer,
  "status" "invoice_status" NOT NULL DEFAULT 'pending',
  "invoiced_at" timestamp,
  "paid_at" timestamp,
  "due_date" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Leads: CRM pipeline
CREATE TABLE IF NOT EXISTS "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "company_name" varchar(200) NOT NULL,
  "contact_name" varchar(200),
  "contact_email" varchar(320),
  "contact_phone" varchar(30),
  "source" varchar(100),
  "service_interest" text,
  "stage" "lead_stage" NOT NULL DEFAULT 'new_lead',
  "owned_by" uuid REFERENCES "users"("id"),
  "estimated_value" integer,
  "last_contacted_at" timestamp,
  "next_follow_up_at" timestamp,
  "notes" text,
  "converted_to_org_id" uuid REFERENCES "organizations"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- TPA Settings: per-tenant configuration
CREATE TABLE IF NOT EXISTS "tpa_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL UNIQUE REFERENCES "organizations"("id"),
  "brand_name" varchar(200),
  "logo_url" text,
  "primary_color" varchar(7),
  "reply_to_email" varchar(320),
  "default_collection_window_hours" integer DEFAULT 24,
  "dot_company_name" varchar(200),
  "dot_consortium_id" varchar(100),
  "timezone" varchar(50) DEFAULT 'America/Chicago',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ============================================================================
-- 3. ADD tpaOrgId TO EXISTING TABLES
-- ============================================================================

-- Organizations: self-referencing tpaOrgId (client orgs point to their TPA)
ALTER TABLE "organizations" ADD COLUMN "tpa_org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;

-- Orders: TPA tenant isolation + new fields
ALTER TABLE "orders" ADD COLUMN "tpa_org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "orders" ADD COLUMN "service_type" varchar(50) NOT NULL DEFAULT 'drug_screen';
ALTER TABLE "orders" ADD COLUMN "is_dot" boolean NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "priority" varchar(20) DEFAULT 'standard';
ALTER TABLE "orders" ADD COLUMN "ccf_number" varchar(50);
ALTER TABLE "orders" ADD COLUMN "result_status" varchar(30) DEFAULT 'pending';
ALTER TABLE "orders" ADD COLUMN "collector_id" uuid REFERENCES "collectors"("id");
ALTER TABLE "orders" ADD COLUMN "event_id" uuid REFERENCES "events"("id");

-- Candidates: TPA tenant isolation
ALTER TABLE "candidates" ADD COLUMN "tpa_org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;

-- Documents: TPA tenant isolation
ALTER TABLE "documents" ADD COLUMN "tpa_org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;

-- Notifications: TPA scoping
ALTER TABLE "notifications" ADD COLUMN "tpa_org_id" uuid REFERENCES "organizations"("id");

-- Audit logs: TPA scoping
ALTER TABLE "audit_logs" ADD COLUMN "tpa_org_id" uuid REFERENCES "organizations"("id");
