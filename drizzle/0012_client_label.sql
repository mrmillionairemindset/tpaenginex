-- Add clientLabel column to orders and events tables
-- Make events.clientOrgId nullable for walk-in / non-client scenarios

ALTER TABLE "orders" ADD COLUMN "client_label" varchar(255);

ALTER TABLE "events" ADD COLUMN "client_label" varchar(255);

ALTER TABLE "events" ALTER COLUMN "client_org_id" DROP NOT NULL;
