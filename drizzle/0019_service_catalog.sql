-- Service Catalog — per-TPA customizable service/test types
CREATE TABLE IF NOT EXISTS "service_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "category" varchar(30) NOT NULL,
  "group" varchar(50),
  "name" varchar(200) NOT NULL,
  "code" varchar(50),
  "is_dot_only" boolean NOT NULL DEFAULT false,
  "is_non_dot_only" boolean NOT NULL DEFAULT false,
  "requires_panel" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Reason Catalog — per-TPA customizable reasons for service
CREATE TABLE IF NOT EXISTS "reason_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "category" varchar(30) NOT NULL,
  "name" varchar(200) NOT NULL,
  "code" varchar(50),
  "is_dot_allowed" boolean NOT NULL DEFAULT true,
  "is_non_dot_allowed" boolean NOT NULL DEFAULT true,
  "auto_urgent" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Panel Codes — drug test panel options
CREATE TABLE IF NOT EXISTS "panel_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(200) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for TPA-scoped queries
CREATE INDEX IF NOT EXISTS "idx_service_catalog_tpa" ON "service_catalog" ("tpa_org_id");
CREATE INDEX IF NOT EXISTS "idx_reason_catalog_tpa" ON "reason_catalog" ("tpa_org_id");
CREATE INDEX IF NOT EXISTS "idx_panel_codes_tpa" ON "panel_codes" ("tpa_org_id");
