-- 007_documents.sql
-- Quotation, Berita Acara, Kwitansi, tautan ke invoice.

CREATE TABLE quotations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  document_no    text NOT NULL,
  seq_year       smallint NOT NULL,
  seq_no         integer NOT NULL,
  quote_date     date NOT NULL,
  valid_until    date,
  project_id     uuid REFERENCES projects ON DELETE RESTRICT,
  customer_id    uuid NOT NULL REFERENCES contacts ON DELETE RESTRICT,
  status         text NOT NULL DEFAULT 'DRAFT',
  subtotal       numeric(18,2) NOT NULL DEFAULT 0,
  discount       numeric(18,2) NOT NULL DEFAULT 0,
  tax_amount     numeric(18,2) NOT NULL DEFAULT 0,
  total          numeric(18,2) NOT NULL DEFAULT 0,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, document_no),
  UNIQUE (org_id, seq_year, seq_no),
  CHECK (status IN ('DRAFT', 'DIKIRIM', 'DITERIMA', 'DITOLAK', 'KEDALUWARSA'))
);

CREATE TABLE quotation_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  uuid NOT NULL REFERENCES quotations ON DELETE CASCADE,
  line_no       smallint NOT NULL,
  description   text NOT NULL,
  quantity      numeric(14,3) NOT NULL DEFAULT 1,
  unit_price    numeric(18,2) NOT NULL,
  amount        numeric(18,2) NOT NULL,
  UNIQUE (quotation_id, line_no)
);

CREATE TABLE berita_acara (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  document_no   text NOT NULL,
  seq_year      smallint NOT NULL,
  seq_no        integer NOT NULL,
  ba_date       date NOT NULL,
  project_id    uuid NOT NULL REFERENCES projects ON DELETE RESTRICT,
  customer_id   uuid NOT NULL REFERENCES contacts ON DELETE RESTRICT,
  invoice_id    uuid REFERENCES sales_invoices ON DELETE SET NULL,
  description   text NOT NULL,
  acknowledged_value numeric(18,2),
  signatory_client text,
  signatory_ours   text,
  status        text NOT NULL DEFAULT 'DRAFT',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, document_no),
  UNIQUE (org_id, seq_year, seq_no),
  CHECK (status IN ('DRAFT', 'DITERBITKAN'))
);

CREATE TABLE kwitansi (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  document_no   text NOT NULL,
  seq_year      smallint NOT NULL,
  seq_no        integer NOT NULL,
  kw_date       date NOT NULL,
  project_id    uuid REFERENCES projects ON DELETE RESTRICT,
  contact_id    uuid NOT NULL REFERENCES contacts ON DELETE RESTRICT,
  payment_id    uuid REFERENCES payments ON DELETE SET NULL,
  description   text NOT NULL,
  amount        numeric(18,2) NOT NULL CHECK (amount > 0),
  payment_method text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, document_no),
  UNIQUE (org_id, seq_year, seq_no)
);

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES quotations ON DELETE SET NULL;

ALTER TABLE project_terms
  ADD COLUMN IF NOT EXISTS ba_id uuid REFERENCES berita_acara ON DELETE SET NULL;

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE berita_acara ENABLE ROW LEVEL SECURITY;
ALTER TABLE kwitansi ENABLE ROW LEVEL SECURITY;
