-- Session device management + GDPR compliance (data export, account deletion)

-- Active sessions (supplements JWT for device tracking + remote revocation)
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "session_token" varchar(255) NOT NULL UNIQUE,
  "ip_address" varchar(45),
  "user_agent" text,
  "device_label" varchar(255),
  "last_seen_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_user_sessions_user" ON "user_sessions"("user_id") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_user_sessions_expires" ON "user_sessions"("expires_at") WHERE "revoked_at" IS NULL;

-- Account deletion requests (30-day grace period)
CREATE TABLE IF NOT EXISTS "account_deletion_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "requested_at" timestamp NOT NULL DEFAULT now(),
  "scheduled_for" timestamp NOT NULL,
  "cancelled_at" timestamp,
  "completed_at" timestamp,
  "reason" text,
  "ip_address" varchar(45)
);
CREATE INDEX IF NOT EXISTS "idx_deletion_scheduled" ON "account_deletion_requests"("scheduled_for") WHERE "cancelled_at" IS NULL AND "completed_at" IS NULL;

-- Data export requests
CREATE TABLE IF NOT EXISTS "data_export_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "requested_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp,
  "download_url" text,
  "expires_at" timestamp,
  "size_bytes" integer,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "error_message" text
);
CREATE INDEX IF NOT EXISTS "idx_export_user" ON "data_export_requests"("user_id", "requested_at" DESC);
