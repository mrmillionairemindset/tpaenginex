-- Add authorization tracking fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS use_concentra BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS authorization_method VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS authorization_form_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN orders.use_concentra IS 'Whether to use Concentra network (employer choice)';
COMMENT ON COLUMN orders.authorization_method IS 'concentra | custom | null - Method used for authorization';
COMMENT ON COLUMN orders.authorization_form_url IS 'URL to generated custom auth form PDF';
