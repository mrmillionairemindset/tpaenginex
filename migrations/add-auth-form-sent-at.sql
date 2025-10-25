-- Add field to track when authorization form was sent via email
ALTER TABLE orders ADD COLUMN IF NOT EXISTS authorization_form_sent_at TIMESTAMP;

-- Add comment for clarity
COMMENT ON COLUMN orders.authorization_form_sent_at IS 'Timestamp when custom authorization form was sent via email';
