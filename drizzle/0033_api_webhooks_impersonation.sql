-- API keys, outbound webhooks, and platform impersonation sessions

-- API keys (M2M auth)
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "name" varchar(200) NOT NULL,
  "key_hash" varchar(64) NOT NULL UNIQUE,
  "key_prefix" varchar(20) NOT NULL,
  "scopes" jsonb NOT NULL,
  "last_used_at" timestamp,
  "last_used_ip" varchar(45),
  "usage_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_api_keys_tpa" ON "api_keys"("tpa_org_id") WHERE "revoked_at" IS NULL;

-- Webhook subscriptions
CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "events" jsonb NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_webhook_subs_tpa" ON "webhook_subscriptions"("tpa_org_id") WHERE "is_active" = true;

-- Webhook delivery attempts
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_id" uuid NOT NULL REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "event" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "next_attempt_at" timestamp,
  "last_attempt_at" timestamp,
  "response_status" integer,
  "response_body" text,
  "error_message" text,
  "delivered_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_webhook_deliv_pending" ON "webhook_deliveries"("next_attempt_at") WHERE "status" = 'pending';
CREATE INDEX IF NOT EXISTS "idx_webhook_deliv_sub" ON "webhook_deliveries"("subscription_id", "created_at" DESC);

-- Impersonation sessions (platform admin support tool)
CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "started_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "ended_at" timestamp,
  "ip_address" varchar(45),
  "user_agent" text
);
CREATE INDEX IF NOT EXISTS "idx_imp_admin" ON "impersonation_sessions"("admin_user_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_imp_target" ON "impersonation_sessions"("target_user_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_imp_active" ON "impersonation_sessions"("expires_at") WHERE "ended_at" IS NULL;
