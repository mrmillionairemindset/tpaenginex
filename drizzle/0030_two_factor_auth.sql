-- Two-factor authentication (TOTP)
-- Adds TOTP secret storage to users + backup codes table for recovery

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_verified_at" timestamp;

CREATE TABLE IF NOT EXISTS "user_backup_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" varchar(255) NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_backup_code" ON "user_backup_codes"("user_id", "code_hash");
CREATE INDEX IF NOT EXISTS "idx_user_backup_codes_user" ON "user_backup_codes"("user_id") WHERE "used_at" IS NULL;
