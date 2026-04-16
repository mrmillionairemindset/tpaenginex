CREATE TABLE IF NOT EXISTS "signatures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
  "document_id" uuid REFERENCES "documents"("id"),
  "signer_name" varchar(200) NOT NULL,
  "signer_role" varchar(50) NOT NULL,
  "signature_data_url" text NOT NULL,
  "signed_at" timestamp NOT NULL DEFAULT now(),
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_signatures_order" ON "signatures"("order_id");
CREATE INDEX IF NOT EXISTS "idx_signatures_tpa" ON "signatures"("tpa_org_id");
