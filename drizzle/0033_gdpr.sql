-- GDPR / CCPA compliance: data export + account deletion requests

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
CREATE INDEX IF NOT EXISTS "idx_acct_deletion_scheduled"
  ON "account_deletion_requests"("scheduled_for")
  WHERE "cancelled_at" IS NULL AND "completed_at" IS NULL;

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
CREATE INDEX IF NOT EXISTS "idx_data_export_user"
  ON "data_export_requests"("user_id", "requested_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_data_export_status"
  ON "data_export_requests"("status");
