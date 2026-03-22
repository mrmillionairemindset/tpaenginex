ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "default_service_rates" jsonb;
ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "dot_surcharge_rate" integer DEFAULT 0;
ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "default_payment_term_days" integer DEFAULT 30;
