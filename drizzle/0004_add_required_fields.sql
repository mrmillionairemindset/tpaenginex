-- Migration: Add required fields for Concentra authorization

-- Add jobsite_location to orders
ALTER TABLE "orders" ADD COLUMN "jobsite_location" varchar(255);

-- Rename ssn to ssn_last4 and change length
ALTER TABLE "candidates" RENAME COLUMN "ssn" TO "ssn_last4";
ALTER TABLE "candidates" ALTER COLUMN "ssn_last4" SET DATA TYPE varchar(4);

-- Make required candidate fields NOT NULL (after ensuring existing data has values or provide defaults)
-- Note: You may need to update existing records first if they have NULL values

-- For DOB
UPDATE "candidates" SET "dob" = '01/01/1990' WHERE "dob" IS NULL;
ALTER TABLE "candidates" ALTER COLUMN "dob" SET NOT NULL;

-- For SSN Last 4
UPDATE "candidates" SET "ssn_last4" = '0000' WHERE "ssn_last4" IS NULL OR LENGTH("ssn_last4") > 4;
-- Trim to last 4 digits if longer
UPDATE "candidates" SET "ssn_last4" = RIGHT("ssn_last4", 4) WHERE LENGTH("ssn_last4") > 4;
ALTER TABLE "candidates" ALTER COLUMN "ssn_last4" SET NOT NULL;

-- For Phone
UPDATE "candidates" SET "phone" = '000-000-0000' WHERE "phone" IS NULL;
ALTER TABLE "candidates" ALTER COLUMN "phone" SET NOT NULL;

-- For Email
UPDATE "candidates" SET "email" = 'noemail@example.com' WHERE "email" IS NULL;
ALTER TABLE "candidates" ALTER COLUMN "email" SET NOT NULL;

-- For jobsite_location in orders
UPDATE "orders" SET "jobsite_location" = 'Not Specified' WHERE "jobsite_location" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "jobsite_location" SET NOT NULL;
