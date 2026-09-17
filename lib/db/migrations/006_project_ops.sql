-- 006_project_ops.sql
-- Termin project, jaminan, tautan invoice, retensi.

CREATE TABLE project_terms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
  term_no       smallint NOT NULL,
  name          text NOT NULL,
  percent       numeric(6,3),
  amount        numeric(18,2) NOT NULL CHECK (amount >= 0),
  planned_date  date,
  status        text NOT NULL DEFAULT 'RENCANA',
  invoice_id    uuid REFERENCES sales_invoices ON DELETE SET NULL,
  UNIQUE (project_id, term_no),
  CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100))
);

CREATE TABLE performance_bonds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects ON DELETE RESTRICT,
  kind          text NOT NULL,
  bond_no       text NOT NULL,
  issuer        text NOT NULL,
  amount        numeric(18,2) NOT NULL CHECK (amount > 0),
  issued_on     date NOT NULL,
  expires_on    date NOT NULL,
  status        text NOT NULL DEFAULT 'AKTIF',
  notes         text,
  UNIQUE (org_id, bond_no),
  CHECK (expires_on >= issued_on),
  CHECK (kind IN ('PELAKSANAAN', 'UANG_MUKA', 'PEMELIHARAAN')),
  CHECK (status IN ('AKTIF', 'DICAIRKAN', 'DIKEMBALIKAN', 'KEDALUWARSA'))
);

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES project_terms ON DELETE SET NULL;

CREATE UNIQUE INDEX sales_invoices_active_term_uidx
  ON sales_invoices (org_id, term_id)
  WHERE term_id IS NOT NULL AND entry_id IS NOT NULL;

CREATE INDEX project_terms_org_project_idx ON project_terms (org_id, project_id, term_no);
CREATE INDEX performance_bonds_org_expires_idx ON performance_bonds (org_id, expires_on)
  WHERE status = 'AKTIF';

ALTER TABLE project_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_bonds ENABLE ROW LEVEL SECURITY;
