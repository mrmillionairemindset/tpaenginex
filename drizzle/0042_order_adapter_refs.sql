-- Add adapter_id column to orders table for tracking which lab adapter submitted the order.
-- The external_row_id column already exists; we just add adapter_id and an index.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS adapter_id varchar(50);

-- Composite index for efficient lookup by adapter + external reference
CREATE INDEX IF NOT EXISTS idx_orders_adapter_external ON orders(adapter_id, external_row_id)
  WHERE adapter_id IS NOT NULL AND external_row_id IS NOT NULL;
