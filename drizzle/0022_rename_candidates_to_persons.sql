-- Rename candidates table to persons and candidateId to personId on orders
-- This is part of Phase 0: canonical data layer — persons are shared across modules

ALTER TABLE "candidates" RENAME TO "persons";

ALTER TABLE "orders" RENAME COLUMN "candidate_id" TO "person_id";

-- Update any indexes that reference the old table/column names
-- (Drizzle auto-generates index names based on table/column, so we rename them)
ALTER INDEX IF EXISTS "candidates_pkey" RENAME TO "persons_pkey";
