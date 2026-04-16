-- SSO / SAML connections for enterprise authentication
-- Jackson manages its own jackson_* tables automatically on first init.
-- This migration creates only our own tenant-facing metadata.

CREATE TABLE IF NOT EXISTS "sso_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "provider" varchar(50) NOT NULL,
  "jackson_tenant" varchar(100) NOT NULL,
  "jackson_product" varchar(100) NOT NULL DEFAULT 'tpaenginex',
  "idp_metadata_xml" text,
  "idp_metadata_url" text,
  "default_redirect_url" varchar(500),
  "jit_provisioning_enabled" boolean NOT NULL DEFAULT true,
  "default_role_for_jit" varchar(50) DEFAULT 'tpa_staff',
  "allowed_email_domains" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT false,
  "last_verified_at" timestamp,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_sso_connections_tpa_active"
  ON "sso_connections"("tpa_org_id")
  WHERE "is_active" = true;

CREATE INDEX IF NOT EXISTS "idx_sso_connections_jackson"
  ON "sso_connections"("jackson_tenant", "jackson_product");

CREATE TABLE IF NOT EXISTS "sso_login_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "connection_id" uuid NOT NULL REFERENCES "sso_connections"("id") ON DELETE CASCADE,
  "email" varchar(320) NOT NULL,
  "first_name" varchar(255),
  "last_name" varchar(255),
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_sso_login_tokens_expiry"
  ON "sso_login_tokens"("expires_at");
