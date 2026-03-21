CREATE TABLE IF NOT EXISTS order_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item varchar(255) NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_by uuid REFERENCES users(id),
  completed_at timestamp,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_checklists_order ON order_checklists(order_id);
