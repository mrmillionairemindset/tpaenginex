-- White-label support: custom subdomains, branding, and login customization

ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "custom_domain" varchar(255);
ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "favicon_url" text;
ALTER TABLE "tpa_settings" ADD COLUMN IF NOT EXISTS "login_message" text;

-- Unique index on custom_domain for fast subdomain lookups
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tpa_settings_custom_domain" ON "tpa_settings"("custom_domain") WHERE "custom_domain" IS NOT NULL;
