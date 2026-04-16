-- Random Program Management (DOT 49 CFR Part 382 + Part 40)
-- Cryptographically random selection of safety-sensitive employees for drug/alcohol testing.

DO $$ BEGIN
  CREATE TYPE "random_program_type" AS ENUM ('dot', 'non_dot', 'consortium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "random_period_type" AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "random_pool_status" AS ENUM ('open', 'selected', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "random_selection_type" AS ENUM ('drug', 'alcohol', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "random_eligibility_status" AS ENUM ('active', 'excluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "random_programs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "client_org_id" uuid REFERENCES "organizations"("id"),
  "name" varchar(200) NOT NULL,
  "program_type" "random_program_type" NOT NULL,
  -- Selection rates as basis points (5000 = 50.00%) — integer arithmetic avoids float errors.
  -- DOT FMCSA minimums: 50% drug + 10% alcohol annually.
  "drug_test_rate_bp" integer NOT NULL DEFAULT 5000,
  "alcohol_test_rate_bp" integer NOT NULL DEFAULT 1000,
  "period_type" "random_period_type" NOT NULL DEFAULT 'quarterly',
  "is_active" boolean NOT NULL DEFAULT true,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_random_programs_tpa" ON "random_programs"("tpa_org_id") WHERE "is_active" = true;
CREATE INDEX IF NOT EXISTS "idx_random_programs_client" ON "random_programs"("client_org_id");

CREATE TABLE IF NOT EXISTS "random_pools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "program_id" uuid NOT NULL REFERENCES "random_programs"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "period_starts_at" timestamp NOT NULL,
  "period_ends_at" timestamp NOT NULL,
  "total_eligible" integer NOT NULL DEFAULT 0,
  "total_selected_drug" integer NOT NULL DEFAULT 0,
  "total_selected_alcohol" integer NOT NULL DEFAULT 0,
  "status" "random_pool_status" NOT NULL DEFAULT 'open',
  "selected_at" timestamp,
  "selected_by" uuid REFERENCES "users"("id"),
  "selection_seed_hash" varchar(64),
  "report_storage_key" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_random_pool_program_period" ON "random_pools"("program_id", "period_starts_at");
CREATE INDEX IF NOT EXISTS "idx_random_pools_tpa_status" ON "random_pools"("tpa_org_id", "status");

CREATE TABLE IF NOT EXISTS "random_pool_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pool_id" uuid NOT NULL REFERENCES "random_pools"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "eligibility_status" "random_eligibility_status" NOT NULL DEFAULT 'active',
  "exclude_reason" varchar(255),
  "added_at" timestamp NOT NULL DEFAULT now(),
  "excluded_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pool_member" ON "random_pool_members"("pool_id", "person_id");
CREATE INDEX IF NOT EXISTS "idx_pool_members_eligible" ON "random_pool_members"("pool_id") WHERE "eligibility_status" = 'active';

CREATE TABLE IF NOT EXISTS "random_selections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pool_id" uuid NOT NULL REFERENCES "random_pools"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE RESTRICT,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "selection_type" "random_selection_type" NOT NULL,
  "notified_at" timestamp,
  "scheduled_at" timestamp,
  "completed_at" timestamp,
  "order_id" uuid REFERENCES "orders"("id"),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_random_selections_pool" ON "random_selections"("pool_id");
CREATE INDEX IF NOT EXISTS "idx_random_selections_tpa" ON "random_selections"("tpa_org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_random_selections_pending" ON "random_selections"("tpa_org_id") WHERE "completed_at" IS NULL;
