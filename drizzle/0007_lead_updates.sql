ALTER TABLE leads ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city varchar(120);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state varchar(2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip varchar(10);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS employee_count integer;
ALTER TABLE leads RENAME COLUMN service_interest TO need;
ALTER TABLE leads DROP COLUMN IF EXISTS estimated_value;
