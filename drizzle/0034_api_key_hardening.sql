-- API key IP allowlists + per-request usage log

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "ip_allowlist" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "api_key_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "api_key_id" uuid NOT NULL REFERENCES "api_keys"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "method" varchar(10) NOT NULL,
  "path" varchar(500) NOT NULL,
  "status_code" integer NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "duration_ms" integer,
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_api_usage_key" ON "api_key_usage"("api_key_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_api_usage_tpa" ON "api_key_usage"("tpa_org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_api_usage_status" ON "api_key_usage"("status_code", "created_at" DESC);
