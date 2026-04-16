-- Add random_selection notification type for Random Program Management
DO $$ BEGIN
  ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'random_selection';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
