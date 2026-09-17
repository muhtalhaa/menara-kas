-- 005_invoices_payments.sql
-- Invoice penjualan, tagihan pembelian, pembayaran, dan peran pajak dibayar dimuka.

CREATE TYPE payment_direction AS ENUM ('MASUK', 'KELUAR');

CREATE TABLE sales_invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  document_no      text NOT NULL,
  seq_year         smallint NOT NULL,
  seq_no           integer NOT NULL,
  invoice_date     date NOT NULL,
  due_date         date NOT NULL,
  project_id       uuid REFERENCES projects ON DELETE RESTRICT,
  customer_id      uuid NOT NULL REFERENCES contacts ON DELETE RESTRICT,
  tax_treatment    tax_treatment NOT NULL DEFAULT 'BELUM_TERMASUK_PPN',
  tax_code_id      uuid REFERENCES tax_codes ON DELETE RESTRICT,
  tax_invoice_no   text,
  subtotal         numeric(18,2) NOT NULL DEFAULT 0,
  discount         numeric(18,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_amount       numeric(18,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  retention_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (retention_amount >= 0),
  total            numeric(18,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes            text,
  entry_id         uuid REFERENCES journal_entries ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, document_no),
  UNIQUE (org_id, seq_year, seq_no),
  CHECK (due_date >= invoice_date)
);

CREATE TABLE sales_invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES sales_invoices ON DELETE CASCADE,
  line_no     smallint NOT NULL,
  description text NOT NULL,
  project_id  uuid REFERENCES projects ON DELETE RESTRICT,
  account_id  uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  quantity    numeric(14,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  numeric(18,2) NOT NULL CHECK (unit_price >= 0),
  amount      numeric(18,2) NOT NULL CHECK (amount >= 0),
  UNIQUE (invoice_id, line_no)
);

CREATE TABLE purchase_bills (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  document_no    text NOT NULL,
  seq_year       smallint NOT NULL,
  seq_no         integer NOT NULL,
  bill_date      date NOT NULL,
  due_date       date NOT NULL,
  project_id     uuid REFERENCES projects ON DELETE RESTRICT,
  vendor_id      uuid NOT NULL REFERENCES contacts ON DELETE RESTRICT,
  tax_treatment  tax_treatment NOT NULL DEFAULT 'BELUM_TERMASUK_PPN',
  tax_code_id    uuid REFERENCES tax_codes ON DELETE RESTRICT,
  tax_invoice_no text,
  subtotal       numeric(18,2) NOT NULL DEFAULT 0,
  discount       numeric(18,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_amount     numeric(18,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total          numeric(18,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes          text,
  entry_id       uuid REFERENCES journal_entries ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, document_no),
  UNIQUE (org_id, seq_year, seq_no),
  CHECK (due_date >= bill_date)
);

CREATE TABLE purchase_bill_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     uuid NOT NULL REFERENCES purchase_bills ON DELETE CASCADE,
  line_no     smallint NOT NULL,
  description text NOT NULL,
  project_id  uuid REFERENCES projects ON DELETE RESTRICT,
  account_id  uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  quantity    numeric(14,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  numeric(18,2) NOT NULL CHECK (unit_price >= 0),
  amount      numeric(18,2) NOT NULL CHECK (amount >= 0),
  UNIQUE (bill_id, line_no)
);

CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  payment_no      text NOT NULL,
  payment_date    date NOT NULL,
  direction       payment_direction NOT NULL,
  cash_account_id uuid NOT NULL REFERENCES cash_accounts ON DELETE RESTRICT,
  contact_id      uuid REFERENCES contacts ON DELETE RESTRICT,
  gross_amount    numeric(18,2) NOT NULL CHECK (gross_amount > 0),
  cash_amount     numeric(18,2) NOT NULL CHECK (cash_amount > 0),
  notes           text,
  entry_id        uuid REFERENCES journal_entries ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, payment_no)
);

CREATE TABLE payment_withholdings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid NOT NULL REFERENCES payments ON DELETE CASCADE,
  tax_code_id  uuid NOT NULL REFERENCES tax_codes ON DELETE RESTRICT,
  base_amount  numeric(18,2) NOT NULL CHECK (base_amount >= 0),
  rate_percent numeric(6,3) NOT NULL,
  amount       numeric(18,2) NOT NULL CHECK (amount >= 0),
  slip_no      text
);

CREATE TABLE payment_allocations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  uuid NOT NULL REFERENCES payments ON DELETE CASCADE,
  invoice_id  uuid REFERENCES sales_invoices ON DELETE RESTRICT,
  bill_id     uuid REFERENCES purchase_bills ON DELETE RESTRICT,
  amount      numeric(18,2) NOT NULL CHECK (amount > 0),
  CHECK ((invoice_id IS NULL) <> (bill_id IS NULL))
);

CREATE INDEX sales_invoices_org_date_idx ON sales_invoices (org_id, invoice_date DESC);
CREATE INDEX purchase_bills_org_date_idx ON purchase_bills (org_id, bill_date DESC);
CREATE INDEX payments_org_date_idx ON payments (org_id, payment_date DESC);

INSERT INTO account_roles (org_id, role, account_id)
SELECT a.org_id, 'PAJAK_DIBAYAR_DIMUKA', a.id
FROM accounts a
WHERE a.account_no = '1-1450'
ON CONFLICT (org_id, role) DO NOTHING;

ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_withholdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
