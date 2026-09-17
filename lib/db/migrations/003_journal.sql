-- 003_journal.sql
-- Jurnal double-entry, penomoran, dan trigger invariant I1–I5.

CREATE TYPE entry_status AS ENUM ('DRAFT', 'TERPOSTING', 'DIBATALKAN');

CREATE TYPE entry_source AS ENUM (
  'JURNAL_UMUM', 'JURNAL_PENYESUAIAN', 'KAS_MASUK', 'KAS_KELUAR', 'TRANSFER_KAS',
  'INVOICE_PENJUALAN', 'TAGIHAN_PEMBELIAN', 'TERIMA_PEMBAYARAN', 'BAYAR_TAGIHAN',
  'DEPRESIASI', 'SALDO_AWAL', 'JURNAL_PENUTUP', 'JURNAL_PEMBALIK'
);

CREATE TYPE tax_treatment AS ENUM ('TERMASUK_PPN', 'BELUM_TERMASUK_PPN', 'NON_PPN');

CREATE TABLE numbering_sequences (
  org_id     uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  prefix     text NOT NULL,
  year       smallint NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, prefix, year)
);

CREATE TABLE journal_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  entry_no        text NOT NULL,
  entry_date      date NOT NULL,
  period_id       uuid NOT NULL REFERENCES periods ON DELETE RESTRICT,
  source          entry_source NOT NULL,
  status          entry_status NOT NULL DEFAULT 'DRAFT',
  memo            text,
  has_cash_line   boolean NOT NULL DEFAULT false,
  total_amount    numeric(18,2) NOT NULL DEFAULT 0,
  reversal_of_id  uuid REFERENCES journal_entries ON DELETE RESTRICT,
  created_by      uuid NOT NULL REFERENCES users,
  created_at      timestamptz NOT NULL DEFAULT now(),
  posted_by       uuid REFERENCES users,
  posted_at       timestamptz,
  UNIQUE (org_id, entry_no),
  CHECK ((status = 'TERPOSTING') = (posted_at IS NOT NULL))
);

CREATE INDEX entries_org_date_idx ON journal_entries (org_id, entry_date DESC, id);
CREATE INDEX entries_org_status_idx ON journal_entries (org_id, status) WHERE status = 'DRAFT';
CREATE INDEX entries_period_idx ON journal_entries (period_id);

CREATE TABLE journal_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES journal_entries ON DELETE CASCADE,
  line_no     smallint NOT NULL,

  org_id      uuid NOT NULL,
  entry_date  date NOT NULL,
  status      entry_status NOT NULL,

  account_id  uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  project_id  uuid REFERENCES projects ON DELETE RESTRICT,
  contact_id  uuid REFERENCES contacts ON DELETE RESTRICT,
  tax_code_id uuid REFERENCES tax_codes ON DELETE RESTRICT,

  debit       numeric(18,2) NOT NULL DEFAULT 0,
  credit      numeric(18,2) NOT NULL DEFAULT 0,
  description text,

  UNIQUE (entry_id, line_no),
  CONSTRAINT journal_lines_one_side CHECK (debit = 0 OR credit = 0),
  CONSTRAINT journal_lines_nonzero CHECK (debit + credit > 0)
);

CREATE INDEX lines_report_idx ON journal_lines (org_id, status, entry_date, account_id)
  INCLUDE (debit, credit);
CREATE INDEX lines_project_idx ON journal_lines (org_id, status, project_id, entry_date)
  INCLUDE (account_id, debit, credit) WHERE project_id IS NOT NULL;
CREATE INDEX lines_ledger_idx ON journal_lines (org_id, account_id, entry_date, id);
CREATE INDEX lines_contact_idx ON journal_lines (org_id, contact_id, entry_date)
  WHERE contact_id IS NOT NULL;
CREATE INDEX lines_entry_idx ON journal_lines (entry_id, line_no);

CREATE OR REPLACE FUNCTION sync_line_denorm() RETURNS trigger AS $$
BEGIN
  SELECT e.org_id, e.entry_date, e.status
    INTO NEW.org_id, NEW.entry_date, NEW.status
  FROM journal_entries e WHERE e.id = NEW.entry_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER journal_lines_denorm
  BEFORE INSERT OR UPDATE OF entry_id ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION sync_line_denorm();

CREATE OR REPLACE FUNCTION propagate_entry_change() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.entry_date IS DISTINCT FROM OLD.entry_date THEN
    UPDATE journal_lines
       SET status = NEW.status, entry_date = NEW.entry_date
     WHERE entry_id = NEW.id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_propagate
  AFTER UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION propagate_entry_change();

-- I1: jurnal seimbang, ditunda sampai akhir transaksi.
CREATE OR REPLACE FUNCTION assert_entry_balanced() RETURNS trigger AS $$
DECLARE
  v_entry uuid := COALESCE(NEW.entry_id, OLD.entry_id);
  v_debit  numeric(18,2);
  v_credit numeric(18,2);
  v_count  integer;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0), COUNT(*)
    INTO v_debit, v_credit, v_count
  FROM journal_lines WHERE entry_id = v_entry;

  IF v_count = 0 THEN
    RETURN NULL;
  END IF;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'Jurnal % harus punya minimal 2 baris', v_entry;
  END IF;
  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Jurnal % tidak seimbang: debit %, kredit %',
      v_entry, v_debit, v_credit;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_lines_balanced
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_entry_balanced();

-- I3: periode non-TERBUKA menolak perubahan transaksi.
CREATE OR REPLACE FUNCTION assert_period_open() RETURNS trigger AS $$
DECLARE v_status period_status;
BEGIN
  IF current_setting('app.closing', true) = 'on'
     OR current_setting('app.purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT status INTO v_status FROM periods
   WHERE id = COALESCE(NEW.period_id, OLD.period_id);
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Periode transaksi tidak ditemukan';
  END IF;
  IF v_status <> 'TERBUKA' THEN
    RAISE EXCEPTION 'Periode sudah % dan tidak menerima perubahan transaksi', v_status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_period_open
  BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION assert_period_open();

-- I4: jurnal terposting tidak diubah kecuali dibatalkan.
CREATE OR REPLACE FUNCTION assert_entry_immutable() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('TERPOSTING', 'DIBATALKAN') THEN
      RAISE EXCEPTION 'Jurnal terposting tidak bisa dihapus. Batalkan dengan jurnal balik.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'TERPOSTING' THEN
    IF NEW.status = 'DIBATALKAN' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Jurnal terposting tidak bisa diubah. Batalkan dengan jurnal balik.';
  END IF;

  IF OLD.status = 'DIBATALKAN' THEN
    RAISE EXCEPTION 'Jurnal yang sudah dibatalkan tidak bisa diubah.';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION assert_entry_immutable();

CREATE OR REPLACE FUNCTION assert_line_immutable() RETURNS trigger AS $$
DECLARE v_status entry_status;
BEGIN
  IF current_setting('app.purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO v_status
  FROM journal_entries
  WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);

  IF v_status IS NULL OR v_status = 'DRAFT' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Baris jurnal terposting tidak bisa dihapus. Batalkan dengan jurnal balik.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Baris tidak bisa ditambah pada jurnal terposting. Batalkan dengan jurnal balik.';
  END IF;

  -- Penyalinan status/tanggal dari entri induk (pembatalan) diizinkan.
  IF NEW.account_id = OLD.account_id
     AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
     AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id
     AND NEW.tax_code_id IS NOT DISTINCT FROM OLD.tax_code_id
     AND NEW.debit = OLD.debit
     AND NEW.credit = OLD.credit
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.line_no = OLD.line_no
     AND NEW.entry_id = OLD.entry_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Baris jurnal terposting tidak bisa diubah. Batalkan dengan jurnal balik.';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER journal_lines_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION assert_line_immutable();

-- I5: akun induk atau nonaktif tidak bisa dijurnal.
CREATE OR REPLACE FUNCTION assert_account_postable() RETURNS trigger AS $$
DECLARE
  v_postable boolean;
  v_active boolean;
  v_no text;
BEGIN
  SELECT is_postable, is_active, account_no
    INTO v_postable, v_active, v_no
  FROM accounts WHERE id = NEW.account_id;

  IF v_postable IS NULL THEN
    RAISE EXCEPTION 'Akun pada baris jurnal tidak ditemukan';
  END IF;
  IF NOT v_postable THEN
    RAISE EXCEPTION 'Akun % adalah akun induk dan tidak bisa dijurnal', v_no;
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION 'Akun % tidak aktif dan tidak bisa dijurnal', v_no;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER journal_lines_account_postable
  BEFORE INSERT OR UPDATE OF account_id ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION assert_account_postable();

ALTER TABLE numbering_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
