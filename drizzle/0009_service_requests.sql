-- Service Request Status Enum
DO $$ BEGIN
  CREATE TYPE "service_request_status" AS ENUM('submitted', 'accepted', 'declined', 'converted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Service Requests Table
CREATE TABLE IF NOT EXISTS "service_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tpa_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "client_org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "submitted_by" uuid NOT NULL REFERENCES "users"("id"),
  "donor_first_name" varchar(120) NOT NULL,
  "donor_last_name" varchar(120) NOT NULL,
  "donor_email" varchar(320),
  "donor_phone" varchar(30),
  "service_type" varchar(50) NOT NULL,
  "is_dot" boolean DEFAULT false NOT NULL,
  "priority" varchar(20) DEFAULT 'standard',
  "location" text NOT NULL,
  "requested_date" timestamp,
  "notes" text,
  "status" "service_request_status" DEFAULT 'submitted' NOT NULL,
  "decline_reason" text,
  "converted_order_id" uuid REFERENCES "orders"("id"),
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
