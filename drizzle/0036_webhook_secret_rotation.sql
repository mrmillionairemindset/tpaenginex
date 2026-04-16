-- Webhook secret rotation with graceful 24-hour transition window.
-- When an admin rotates a webhook secret, the previous secret remains
-- valid for 24 hours so subscribers can roll forward without downtime.

ALTER TABLE "webhook_subscriptions"
  ADD COLUMN IF NOT EXISTS "previous_secret" text;

ALTER TABLE "webhook_subscriptions"
  ADD COLUMN IF NOT EXISTS "previous_secret_expires_at" timestamp;

ALTER TABLE "webhook_subscriptions"
  ADD COLUMN IF NOT EXISTS "secret_rotated_at" timestamp;
