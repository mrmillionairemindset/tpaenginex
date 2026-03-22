ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "reply_to_orders" varchar(320);
ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "reply_to_billing" varchar(320);
ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "reply_to_leads" varchar(320);
