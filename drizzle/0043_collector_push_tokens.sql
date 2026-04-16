-- Collector Push Tokens — stores Expo push notification tokens for the mobile collector app

CREATE TYPE "push_token_platform" AS ENUM ('ios', 'android', 'web');

CREATE TABLE IF NOT EXISTS "collector_push_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collector_id" uuid NOT NULL REFERENCES "collectors"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "platform" "push_token_platform" NOT NULL,
  "device_id" varchar(255) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Unique constraint: one token per collector+device (upsert on re-register)
CREATE UNIQUE INDEX "collector_push_tokens_collector_device_idx"
  ON "collector_push_tokens" ("collector_id", "device_id");

-- Index for looking up active tokens by collector (push send path)
CREATE INDEX "collector_push_tokens_collector_active_idx"
  ON "collector_push_tokens" ("collector_id")
  WHERE "is_active" = true;
