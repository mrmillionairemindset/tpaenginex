-- Auth hardening: password reset, email verification, account lockout, login history

-- Add columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_failed_login_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false;

-- Password reset tokens (bcrypt-hashed, single-use)
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(255) NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_pwd_reset_user" ON "password_reset_tokens"("user_id") WHERE "used_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_pwd_reset_expires" ON "password_reset_tokens"("expires_at") WHERE "used_at" IS NULL;

-- Email verification tokens
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(255) NOT NULL UNIQUE,
  "email" varchar(320) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_email_verify_user" ON "email_verification_tokens"("user_id") WHERE "used_at" IS NULL;

-- Login history for audit trail
CREATE TABLE IF NOT EXISTS "login_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "email" varchar(320) NOT NULL,
  "event" varchar(50) NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_login_history_user" ON "login_history"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_login_history_email" ON "login_history"("email", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_login_history_event" ON "login_history"("event", "created_at" DESC);
