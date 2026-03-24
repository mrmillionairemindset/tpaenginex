ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS rate integer;

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_name varchar(200) NOT NULL,
  service_code varchar(50),
  quantity integer NOT NULL DEFAULT 1,
  unit_price integer NOT NULL,
  amount integer NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
