-- POCT (Point-of-Care Testing) — AI cassette reader results and model versioning
-- Part of the Drug Testing module (not a separate module)

-- ============================================================================
-- POCT Model Versions — tracks ML model binaries for the cassette reader
-- ============================================================================

CREATE TABLE IF NOT EXISTS "poct_model_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" varchar(50) NOT NULL UNIQUE,
  "description" text,
  "architecture" varchar(50),
  "supported_cassette_types" jsonb NOT NULL,
  "coreml_model_key" text,
  "tflite_model_key" text,
  "accuracy" real,
  "false_positive_rate" real,
  "false_negative_rate" real,
  "training_dataset_size" integer,
  "is_active" boolean DEFAULT false NOT NULL,
  "activated_at" timestamp,
  "released_at" timestamp,
  "release_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ============================================================================
-- POCT Results — AI cassette reader results captured by mobile collectors
-- ============================================================================

CREATE TABLE IF NOT EXISTS "poct_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "specimen_id" uuid REFERENCES "specimens"("id") ON DELETE SET NULL,
  "collector_id" uuid NOT NULL REFERENCES "collectors"("id") ON DELETE SET NULL,
  "cassette_type" varchar(100) NOT NULL,
  "captured_image_key" text NOT NULL,
  "image_hash" varchar(64),
  "model_version" varchar(50) NOT NULL,
  "model_confidence" real,
  "classified_result" jsonb NOT NULL,
  "control_line_valid" boolean NOT NULL,
  "overall_result" varchar(20),
  "collector_override" jsonb,
  "collector_confirmed_at" timestamp,
  "reviewer_user_id" uuid REFERENCES "users"("id"),
  "reviewer_notes" text,
  "reviewed_at" timestamp,
  "review_accepted" boolean,
  "captured_at" timestamp NOT NULL,
  "processing_time_ms" integer,
  "device_info" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX "poct_results_order_idx" ON "poct_results" ("order_id");
CREATE INDEX "poct_results_tpa_captured_idx" ON "poct_results" ("tpa_org_id", "captured_at" DESC);
CREATE INDEX "poct_results_model_version_idx" ON "poct_results" ("model_version");
