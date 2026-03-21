CREATE TABLE IF NOT EXISTS "client_checklist_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL,
  "client_org_id" uuid NOT NULL,
  "service_type" varchar(50) NOT NULL,
  "items" jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "client_checklist_templates_tpa_org_id_organizations_id_fk" FOREIGN KEY ("tpa_org_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "client_checklist_templates_client_org_id_organizations_id_fk" FOREIGN KEY ("client_org_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action
);

-- Unique constraint: one template per client per service type
CREATE UNIQUE INDEX IF NOT EXISTS "uq_client_checklist_client_service" ON "client_checklist_templates" ("client_org_id", "service_type");

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_client_checklist_templates_tpa_org" ON "client_checklist_templates" ("tpa_org_id");
CREATE INDEX IF NOT EXISTS "idx_client_checklist_templates_client_org" ON "client_checklist_templates" ("client_org_id");
CREATE INDEX IF NOT EXISTS "idx_client_checklist_templates_active" ON "client_checklist_templates" ("client_org_id") WHERE "is_active" = true;
