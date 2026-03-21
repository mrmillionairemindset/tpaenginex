-- Lead Email Templates — per-TPA customizable email templates for pipeline stages
CREATE TABLE IF NOT EXISTS "lead_email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "stage" "lead_stage" NOT NULL,
  "subject" varchar(500) NOT NULL,
  "body" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "delay_minutes" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Lead Activities — activity timeline for leads
CREATE TABLE IF NOT EXISTS "lead_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "type" varchar(50) NOT NULL,
  "description" text NOT NULL,
  "metadata" jsonb,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "lead_email_templates_tpa_org_idx" ON "lead_email_templates" ("tpa_org_id");
CREATE INDEX IF NOT EXISTS "lead_email_templates_stage_idx" ON "lead_email_templates" ("tpa_org_id", "stage");
CREATE INDEX IF NOT EXISTS "lead_activities_lead_idx" ON "lead_activities" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_activities_tpa_org_idx" ON "lead_activities" ("tpa_org_id");
CREATE INDEX IF NOT EXISTS "lead_activities_created_at_idx" ON "lead_activities" ("lead_id", "created_at" DESC);
