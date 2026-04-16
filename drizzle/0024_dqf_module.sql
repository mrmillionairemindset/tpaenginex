-- DQF (Driver Qualification Files) module tables
-- Phase 1B: 8 domain tables for driver qualification management

-- Enums
DO $$ BEGIN
  CREATE TYPE "dqf_application_status" AS ENUM (
    'submitted', 'under_review', 'approved', 'rejected', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "dqf_qualification_status" AS ENUM (
    'active', 'expiring_soon', 'expired', 'pending_verification', 'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "dqf_review_status" AS ENUM (
    'scheduled', 'in_progress', 'completed', 'overdue', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Driver Applications
CREATE TABLE IF NOT EXISTS "driver_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "application_date" timestamp NOT NULL DEFAULT now(),
  "status" "dqf_application_status" NOT NULL DEFAULT 'submitted',
  "previous_employer_contact" jsonb,
  "position" varchar(100),
  "cdl_number" varchar(50),
  "cdl_state" varchar(2),
  "cdl_class" varchar(5),
  "endorsements" jsonb,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Driver Qualifications
CREATE TABLE IF NOT EXISTS "driver_qualifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "qualification_type" varchar(50) NOT NULL,
  "issued_at" timestamp,
  "expires_at" timestamp,
  "document_id" uuid REFERENCES "documents"("id"),
  "status" "dqf_qualification_status" NOT NULL DEFAULT 'active',
  "issuing_authority" varchar(100),
  "reference_number" varchar(100),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- DQF Checklists
CREATE TABLE IF NOT EXISTS "dqf_checklists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "name" varchar(200) NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- DQF Checklist Items
CREATE TABLE IF NOT EXISTS "dqf_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "checklist_id" uuid NOT NULL REFERENCES "dqf_checklists"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "label" varchar(255) NOT NULL,
  "is_required" boolean NOT NULL DEFAULT true,
  "qualification_type" varchar(50),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Annual Reviews
CREATE TABLE IF NOT EXISTS "annual_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "review_date" timestamp,
  "scheduled_date" timestamp NOT NULL,
  "status" "dqf_review_status" NOT NULL DEFAULT 'scheduled',
  "signed_off_by" uuid REFERENCES "users"("id"),
  "signed_off_at" timestamp,
  "findings" text,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Employer Investigations
CREATE TABLE IF NOT EXISTS "employer_investigations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "application_id" uuid REFERENCES "driver_applications"("id"),
  "employer_name" varchar(200) NOT NULL,
  "contact_name" varchar(200),
  "contact_phone" varchar(30),
  "contact_email" varchar(320),
  "contact_date" timestamp,
  "response" text,
  "dates_of_employment" varchar(100),
  "position_held" varchar(100),
  "reason_for_leaving" varchar(255),
  "safety_violations" boolean DEFAULT false,
  "drug_alcohol_violations" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Compliance Scores
CREATE TABLE IF NOT EXISTS "compliance_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid REFERENCES "persons"("id") ON DELETE RESTRICT,
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "score" integer NOT NULL,
  "calculated_at" timestamp NOT NULL DEFAULT now(),
  "breakdown" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Public Ticket Forms
CREATE TABLE IF NOT EXISTS "public_ticket_forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "form_name" varchar(200) NOT NULL,
  "form_config" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "public_url" varchar(500),
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "submission_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_driver_applications_tpa" ON "driver_applications"("tpa_org_id");
CREATE INDEX IF NOT EXISTS "idx_driver_applications_person" ON "driver_applications"("person_id");
CREATE INDEX IF NOT EXISTS "idx_driver_qualifications_tpa" ON "driver_qualifications"("tpa_org_id");
CREATE INDEX IF NOT EXISTS "idx_driver_qualifications_person" ON "driver_qualifications"("person_id");
CREATE INDEX IF NOT EXISTS "idx_driver_qualifications_expires" ON "driver_qualifications"("expires_at");
CREATE INDEX IF NOT EXISTS "idx_annual_reviews_tpa" ON "annual_reviews"("tpa_org_id");
CREATE INDEX IF NOT EXISTS "idx_annual_reviews_scheduled" ON "annual_reviews"("scheduled_date");
CREATE INDEX IF NOT EXISTS "idx_compliance_scores_tpa_person" ON "compliance_scores"("tpa_org_id", "person_id");
CREATE INDEX IF NOT EXISTS "idx_employer_investigations_person" ON "employer_investigations"("person_id");
CREATE INDEX IF NOT EXISTS "idx_public_ticket_forms_tpa" ON "public_ticket_forms"("tpa_org_id");
