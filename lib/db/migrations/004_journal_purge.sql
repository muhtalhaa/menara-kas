-- 004_journal_purge.sql
-- Pengecualian hapus organisasi: trigger I3/I4 tidak boleh memblokir CASCADE.

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
