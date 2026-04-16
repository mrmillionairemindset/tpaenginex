-- Tenant Modules — feature gating per TPA tenant
CREATE TABLE IF NOT EXISTS "tenant_modules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "module_id" varchar(50) NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "enabled_at" timestamp NOT NULL DEFAULT now(),
  "disabled_at" timestamp,
  "config" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_module" ON "tenant_modules" ("tpa_org_id", "module_id");

-- Seed: enable drug_testing module for all existing TPA orgs
INSERT INTO "tenant_modules" ("tpa_org_id", "module_id", "is_enabled", "enabled_at", "created_at", "updated_at")
SELECT "id", 'drug_testing', true, now(), now(), now()
FROM "organizations"
WHERE "type" = 'tpa';
