-- Background Screening module: Checkr + other CRAs.

DO $$ BEGIN
  CREATE TYPE "background_check_status" AS ENUM (
    'pending', 'processing', 'clear', 'consider', 'suspended', 'dispute', 'canceled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "background_provider" AS ENUM (
    'checkr', 'first_advantage', 'sterling', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "background_check_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider" "background_provider" NOT NULL DEFAULT 'checkr',
  "name" varchar(200) NOT NULL,
  "description" text,
  "provider_package_slug" varchar(100) NOT NULL,
  "includes_mvr" boolean NOT NULL DEFAULT false,
  "includes_drug_test" boolean NOT NULL DEFAULT false,
  "includes_employment_verification" boolean NOT NULL DEFAULT false,
  "includes_education_verification" boolean NOT NULL DEFAULT false,
  "retail_price_cents" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bg_pkg_tpa_name" ON "background_check_packages"("tpa_org_id", "name");
CREATE INDEX IF NOT EXISTS "idx_bg_pkg_tpa_active" ON "background_check_packages"("tpa_org_id") WHERE "is_active" = true;

CREATE TABLE IF NOT EXISTS "background_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "package_id" uuid NOT NULL REFERENCES "background_check_packages"("id") ON DELETE RESTRICT,
  "provider" "background_provider" NOT NULL DEFAULT 'checkr',
  "external_id" varchar(100),
  "external_candidate_id" varchar(100),
  "candidate_invite_url" text,
  "status" "background_check_status" NOT NULL DEFAULT 'pending',
  "summary_json" jsonb,
  "hosted_report_url" text,
  "submitted_at" timestamp,
  "completed_at" timestamp,
  "canceled_at" timestamp,
  "requested_by" uuid REFERENCES "users"("id"),
  "notes" text,
  "internal_notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bg_check_external" ON "background_checks"("provider", "external_id") WHERE "external_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_bg_check_tpa_status" ON "background_checks"("tpa_org_id", "status");
CREATE INDEX IF NOT EXISTS "idx_bg_check_person" ON "background_checks"("person_id");
CREATE INDEX IF NOT EXISTS "idx_bg_check_client" ON "background_checks"("client_org_id");

CREATE TABLE IF NOT EXISTS "background_check_charges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "check_id" uuid NOT NULL REFERENCES "background_checks"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "line_item_description" varchar(255) NOT NULL,
  "amount_cents" integer NOT NULL,
  "invoice_id" uuid REFERENCES "invoices"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_bg_charge_check" ON "background_check_charges"("check_id");
CREATE INDEX IF NOT EXISTS "idx_bg_charge_unbilled" ON "background_check_charges"("tpa_org_id") WHERE "invoice_id" IS NULL;
