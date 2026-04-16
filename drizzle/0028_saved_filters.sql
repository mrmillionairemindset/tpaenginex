CREATE TABLE IF NOT EXISTS "saved_filters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "page_key" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "filters" jsonb NOT NULL,
  "is_shared" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_saved_filters_user_page" ON "saved_filters"("user_id", "page_key");
