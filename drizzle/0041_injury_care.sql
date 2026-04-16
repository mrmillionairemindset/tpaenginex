-- Injury Care module — workplace incident management with OSHA 300 tracking,
-- treatment log, required documents, and return-to-work evaluations.

DO $$ BEGIN
  CREATE TYPE "injury_status" AS ENUM (
    'open', 'in_treatment', 'rtw_eval_pending', 'rtw_full_duty', 'rtw_restricted', 'closed', 'litigation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "injury_severity" AS ENUM (
    'first_aid', 'medical', 'lost_time', 'restricted_duty', 'fatality'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "rtw_status" AS ENUM ('full_duty', 'restricted_duty', 'unable_to_work');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "injuries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "incident_number" varchar(50) NOT NULL UNIQUE,
  "incident_date" timestamp NOT NULL,
  "reported_at" timestamp NOT NULL DEFAULT now(),
  "reported_by" uuid REFERENCES "users"("id"),
  "location" text NOT NULL,
  "job_at_incident" varchar(200),
  "body_parts_affected" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "injury_type" varchar(50) NOT NULL,
  "description" text NOT NULL,
  "witness_ids" jsonb DEFAULT '[]'::jsonb,
  "severity" "injury_severity" NOT NULL,
  "status" "injury_status" NOT NULL DEFAULT 'open',
  "osha_recordable" boolean NOT NULL DEFAULT false,
  "osha_case" varchar(50),
  "workers_comp_claim_number" varchar(50),
  "workers_comp_carrier" varchar(200),
  "lost_days_count" integer NOT NULL DEFAULT 0,
  "restricted_days_count" integer NOT NULL DEFAULT 0,
  "notes" text,
  "internal_notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_injuries_tpa_status" ON "injuries"("tpa_org_id", "status");
CREATE INDEX IF NOT EXISTS "idx_injuries_person" ON "injuries"("person_id");
CREATE INDEX IF NOT EXISTS "idx_injuries_client" ON "injuries"("client_org_id");
CREATE INDEX IF NOT EXISTS "idx_injuries_incident_date" ON "injuries"("incident_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_injuries_osha_recordable" ON "injuries"("tpa_org_id", "incident_date" DESC) WHERE "osha_recordable" = true;

CREATE TABLE IF NOT EXISTS "injury_treatments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "injury_id" uuid NOT NULL REFERENCES "injuries"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "treatment_date" timestamp NOT NULL,
  "provider_type" varchar(50) NOT NULL,
  "provider_name" varchar(200),
  "provider_address" text,
  "diagnosis" text,
  "icd10_codes" jsonb DEFAULT '[]'::jsonb,
  "procedures" jsonb DEFAULT '[]'::jsonb,
  "medications" jsonb DEFAULT '[]'::jsonb,
  "work_restrictions" text,
  "next_visit_on" timestamp,
  "cost_cents" integer,
  "recorded_by" uuid REFERENCES "users"("id"),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_treatments_injury" ON "injury_treatments"("injury_id", "treatment_date" DESC);

CREATE TABLE IF NOT EXISTS "injury_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "injury_id" uuid NOT NULL REFERENCES "injuries"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "document_type" varchar(50) NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "storage_key" text NOT NULL,
  "file_size" integer,
  "mime_type" varchar(100),
  "uploaded_by" uuid REFERENCES "users"("id"),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_injury_docs_injury" ON "injury_documents"("injury_id");

CREATE TABLE IF NOT EXISTS "return_to_work_evals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "injury_id" uuid NOT NULL REFERENCES "injuries"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "evaluation_date" timestamp NOT NULL,
  "evaluator_id" uuid REFERENCES "users"("id"),
  "evaluator_name" varchar(200),
  "status" "rtw_status" NOT NULL,
  "released_to_work_on" timestamp,
  "restrictions" jsonb DEFAULT '[]'::jsonb,
  "follow_up_required" boolean NOT NULL DEFAULT false,
  "follow_up_date" timestamp,
  "signed_off_by_user_id" uuid REFERENCES "users"("id"),
  "signed_off_at" timestamp,
  "notes" text,
  "document_storage_key" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_rtw_injury" ON "return_to_work_evals"("injury_id", "evaluation_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_rtw_followup" ON "return_to_work_evals"("follow_up_date") WHERE "follow_up_required" = true;
