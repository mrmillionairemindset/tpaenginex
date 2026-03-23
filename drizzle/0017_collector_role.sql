ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'collector';
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
