CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "email_order_completion" boolean NOT NULL DEFAULT true,
  "email_collector_assigned" boolean NOT NULL DEFAULT true,
  "email_kit_reminder" boolean NOT NULL DEFAULT true,
  "email_results_pending" boolean NOT NULL DEFAULT true,
  "email_annual_review" boolean NOT NULL DEFAULT true,
  "email_expiry_alerts" boolean NOT NULL DEFAULT true,
  "email_weekly_digest" boolean NOT NULL DEFAULT true,
  "in_app_order_updates" boolean NOT NULL DEFAULT true,
  "in_app_dqf_events" boolean NOT NULL DEFAULT true,
  "in_app_system" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
