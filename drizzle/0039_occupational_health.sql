-- Occupational Health module: DOT physicals, BAT, vaccinations, respirator fit tests
-- Per FMCSA 49 CFR 391.41-391.49 and OSHA 1910.134

-- Add NRCME credentials to users (for Certified Medical Examiners)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nrcme_number" varchar(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nrcme_expires_at" timestamp;

-- Enums
DO $$ BEGIN
  CREATE TYPE "physical_exam_type" AS ENUM (
    'dot', 'non_dot', 'pre_employment', 'return_to_duty', 'follow_up', 'annual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "physical_exam_status" AS ENUM (
    'scheduled', 'in_progress', 'completed', 'abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "physical_certification_status" AS ENUM (
    'medically_qualified',
    'qualified_with_restrictions',
    'temporarily_disqualified',
    'disqualified',
    'pending_evaluation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "bat_test_result" AS ENUM (
    'negative', 'positive', 'refused', 'invalid', 'pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "fmcsa_submission_status" AS ENUM (
    'not_required', 'pending', 'submitted', 'accepted', 'rejected', 'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Physical exams (central record)
CREATE TABLE IF NOT EXISTS "physical_exams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "examiner_id" uuid REFERENCES "users"("id"),
  "examiner_nrcme_number" varchar(20),
  "exam_type" "physical_exam_type" NOT NULL,
  "scheduled_for" timestamp,
  "exam_date" timestamp,
  "status" "physical_exam_status" NOT NULL DEFAULT 'scheduled',
  "certificate_number" varchar(50),
  "certification_status" "physical_certification_status",
  "mec_expires_on" timestamp,
  "mec_issued_at" timestamp,
  "mec_storage_key" text,
  "restrictions" jsonb DEFAULT '[]'::jsonb,
  "fmcsa_submission_status" "fmcsa_submission_status" NOT NULL DEFAULT 'pending',
  "fmcsa_submitted_at" timestamp,
  "fmcsa_submission_id" varchar(100),
  "fmcsa_error_message" text,
  "fmcsa_attempts" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_physical_cert_number" ON "physical_exams"("certificate_number") WHERE "certificate_number" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_physical_tpa_status" ON "physical_exams"("tpa_org_id", "status");
CREATE INDEX IF NOT EXISTS "idx_physical_person" ON "physical_exams"("person_id");
CREATE INDEX IF NOT EXISTS "idx_physical_mec_expires" ON "physical_exams"("mec_expires_on") WHERE "mec_expires_on" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_physical_fmcsa_pending" ON "physical_exams"("fmcsa_submission_status") WHERE "fmcsa_submission_status" = 'pending';

-- Health history (encrypted at rest per HIPAA)
CREATE TABLE IF NOT EXISTS "physical_exam_health_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "exam_id" uuid NOT NULL UNIQUE REFERENCES "physical_exams"("id") ON DELETE CASCADE,
  "encrypted_payload" text NOT NULL,
  "driver_signature" text,
  "driver_signed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Vitals
CREATE TABLE IF NOT EXISTS "physical_exam_vitals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "exam_id" uuid NOT NULL UNIQUE REFERENCES "physical_exams"("id") ON DELETE CASCADE,
  "height_inches" integer,
  "weight_pounds" integer,
  "bp_systolic" integer,
  "bp_diastolic" integer,
  "pulse" integer,
  "vision_right_uncorrected" varchar(10),
  "vision_left_uncorrected" varchar(10),
  "vision_both_uncorrected" varchar(10),
  "vision_right_corrected" varchar(10),
  "vision_left_corrected" varchar(10),
  "vision_both_corrected" varchar(10),
  "wears_corrective_lenses" boolean NOT NULL DEFAULT false,
  "horizontal_field_of_vision_right" integer,
  "horizontal_field_of_vision_left" integer,
  "color_vision_adequate" boolean,
  "hearing_right" varchar(20),
  "hearing_left" varchar(20),
  "urine_specific_gravity" varchar(10),
  "urine_protein" varchar(20),
  "urine_blood" varchar(20),
  "urine_sugar" varchar(20),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Findings
CREATE TABLE IF NOT EXISTS "physical_exam_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "exam_id" uuid NOT NULL REFERENCES "physical_exams"("id") ON DELETE CASCADE,
  "category" varchar(50) NOT NULL,
  "description" text NOT NULL,
  "action" text,
  "requires_follow_up" boolean NOT NULL DEFAULT false,
  "follow_up_by_date" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_findings_exam" ON "physical_exam_findings"("exam_id");

-- Breath Alcohol Tests
CREATE TABLE IF NOT EXISTS "bat_tests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "order_id" uuid REFERENCES "orders"("id"),
  "exam_id" uuid REFERENCES "physical_exams"("id"),
  "bat_technician_id" uuid REFERENCES "users"("id"),
  "device_make" varchar(100),
  "device_serial" varchar(100),
  "device_calibration_date" timestamp,
  "test_date" timestamp NOT NULL DEFAULT now(),
  "screening_result" varchar(10),
  "confirmation_result" varchar(10),
  "status" "bat_test_result" NOT NULL DEFAULT 'pending',
  "reason_for_test" varchar(50),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_bat_tpa_person" ON "bat_tests"("tpa_org_id", "person_id");

-- Vaccinations
CREATE TABLE IF NOT EXISTS "vaccinations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "vaccine_type" varchar(100) NOT NULL,
  "manufacturer" varchar(100),
  "lot_number" varchar(100),
  "administered_at" timestamp NOT NULL DEFAULT now(),
  "administered_by" uuid REFERENCES "users"("id"),
  "dose_number" integer,
  "expires_at" timestamp,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_vaccinations_person" ON "vaccinations"("person_id");
CREATE INDEX IF NOT EXISTS "idx_vaccinations_expires" ON "vaccinations"("expires_at") WHERE "expires_at" IS NOT NULL;

-- Respirator fit tests (OSHA 1910.134)
CREATE TABLE IF NOT EXISTS "respirator_fit_tests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "test_type" varchar(20) NOT NULL,
  "respirator_make" varchar(100),
  "respirator_model" varchar(100),
  "respirator_size" varchar(20),
  "fit_factor" integer,
  "passed" boolean NOT NULL,
  "tested_at" timestamp NOT NULL DEFAULT now(),
  "tested_by" uuid REFERENCES "users"("id"),
  "next_test_due_by" timestamp,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_fit_tests_person" ON "respirator_fit_tests"("person_id");
CREATE INDEX IF NOT EXISTS "idx_fit_tests_due" ON "respirator_fit_tests"("next_test_due_by") WHERE "next_test_due_by" IS NOT NULL;
