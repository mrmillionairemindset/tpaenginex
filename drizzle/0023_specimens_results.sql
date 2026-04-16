-- Specimens and Results tables — extracted from orders for proper chain-of-custody
-- and per-panel result tracking. Part of Phase 1A-6.

-- Enums
DO $$ BEGIN
  CREATE TYPE "specimen_status" AS ENUM (
    'pending', 'collected', 'shipped', 'lab_received', 'testing', 'reported', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "result_value" AS ENUM (
    'negative', 'positive', 'inconclusive', 'cancelled', 'refused', 'pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "mro_decision" AS ENUM (
    'verified_negative', 'verified_positive', 'test_cancelled', 'refusal_to_test', 'pending_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Specimens table
CREATE TABLE IF NOT EXISTS "specimens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "specimen_type" varchar(30) NOT NULL DEFAULT 'primary',
  "ccf_number" varchar(50),
  "collected_at" timestamp,
  "collector_id" uuid REFERENCES "collectors"("id"),
  "lab_received_at" timestamp,
  "specimen_status" "specimen_status" NOT NULL DEFAULT 'pending',
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Results table
CREATE TABLE IF NOT EXISTS "results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "specimen_id" uuid NOT NULL REFERENCES "specimens"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "panel_type" varchar(50) NOT NULL,
  "result_value" "result_value" NOT NULL DEFAULT 'pending',
  "mro_reviewed_at" timestamp,
  "mro_decision" "mro_decision",
  "reported_at" timestamp,
  "source" varchar(50),
  "notes" text,
  "raw_data" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_specimens_order_id" ON "specimens"("order_id");
CREATE INDEX IF NOT EXISTS "idx_specimens_tpa_org_id" ON "specimens"("tpa_org_id");
CREATE INDEX IF NOT EXISTS "idx_specimens_ccf_number" ON "specimens"("ccf_number");
CREATE INDEX IF NOT EXISTS "idx_results_specimen_id" ON "results"("specimen_id");
CREATE INDEX IF NOT EXISTS "idx_results_order_id" ON "results"("order_id");
CREATE INDEX IF NOT EXISTS "idx_results_tpa_org_id" ON "results"("tpa_org_id");
