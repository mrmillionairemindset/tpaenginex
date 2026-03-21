CREATE TABLE IF NOT EXISTS "client_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL,
  "client_org_id" uuid NOT NULL,
  "kind" varchar(50) NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "storage_url" text NOT NULL,
  "file_size" integer,
  "mime_type" varchar(100),
  "uploaded_by" uuid,
  "notes" text,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "client_documents_tpa_org_id_organizations_id_fk" FOREIGN KEY ("tpa_org_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "client_documents_client_org_id_organizations_id_fk" FOREIGN KEY ("client_org_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "client_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_client_documents_client_org" ON "client_documents" ("client_org_id");
CREATE INDEX IF NOT EXISTS "idx_client_documents_tpa_org" ON "client_documents" ("tpa_org_id");
CREATE INDEX IF NOT EXISTS "idx_client_documents_kind" ON "client_documents" ("kind");
CREATE INDEX IF NOT EXISTS "idx_client_documents_not_archived" ON "client_documents" ("client_org_id") WHERE "is_archived" = false;
