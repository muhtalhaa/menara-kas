-- 002_master_data.sql
-- COA, kontak, project, kas & bank, kode pajak.

CREATE TYPE account_group AS ENUM (
  'ASET', 'LIABILITAS', 'EKUITAS',
  'PENDAPATAN', 'BEBAN_POKOK_PROJECT', 'BEBAN_OPERASIONAL', 'LAIN_LAIN'
);

CREATE TYPE normal_balance AS ENUM ('DEBIT', 'KREDIT');

CREATE TYPE cash_flow_class AS ENUM (
  'OPERASI', 'INVESTASI', 'PENDANAAN', 'BUKAN_ARUS_KAS'
);

CREATE TYPE project_status AS ENUM (
  'QUOTATION', 'BERJALAN', 'SERAH_TERIMA', 'INVOICING', 'SELESAI', 'DIBATALKAN'
);

CREATE TYPE tax_kind AS ENUM (
  'PPN_KELUARAN', 'PPN_MASUKAN', 'PPH_21', 'PPH_22', 'PPH_23', 'PPH_4_2', 'NON_PAJAK'
);

CREATE TABLE accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  account_no      text NOT NULL,
  name            text NOT NULL,
  "group"         account_group NOT NULL,
  normal_balance  normal_balance NOT NULL,
  cash_flow_class cash_flow_class NOT NULL DEFAULT 'OPERASI',
  parent_id       uuid REFERENCES accounts ON DELETE RESTRICT,
  depth           smallint NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 3),
  is_postable     boolean NOT NULL DEFAULT true,
  is_cash         boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  is_system       boolean NOT NULL DEFAULT false,
  sort_key        text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, account_no)
);

CREATE INDEX accounts_org_group_idx ON accounts (org_id, "group", sort_key);
CREATE INDEX accounts_org_cash_idx ON accounts (org_id) WHERE is_cash;

CREATE TABLE account_roles (
  org_id     uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  role       text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  PRIMARY KEY (org_id, role)
);

CREATE TABLE contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  code         text,
  name         text NOT NULL,
  is_customer  boolean NOT NULL DEFAULT false,
  is_vendor    boolean NOT NULL DEFAULT false,
  is_employee  boolean NOT NULL DEFAULT false,
  npwp         text,
  address      text,
  phone        text,
  email        citext,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  customer_id     uuid REFERENCES contacts ON DELETE RESTRICT,
  contract_value  numeric(18,2) NOT NULL DEFAULT 0 CHECK (contract_value >= 0),
  start_date      date,
  target_end_date date,
  pic_name        text,
  status          project_status NOT NULL DEFAULT 'BERJALAN',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX projects_org_status_idx ON projects (org_id, status, code);

CREATE TABLE membership_projects (
  membership_id uuid NOT NULL REFERENCES memberships ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
  PRIMARY KEY (membership_id, project_id)
);

CREATE TABLE cash_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  account_id     uuid NOT NULL UNIQUE REFERENCES accounts ON DELETE RESTRICT,
  label          text NOT NULL,
  bank_name      text,
  account_number text,
  account_holder text,
  is_active      boolean NOT NULL DEFAULT true
);

CREATE TABLE tax_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  code       text NOT NULL,
  name       text NOT NULL,
  kind       tax_kind NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  is_active  boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, code)
);

CREATE TABLE tax_rates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_code_id  uuid NOT NULL REFERENCES tax_codes ON DELETE CASCADE,
  rate_percent numeric(6,3) NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
  valid_from   date NOT NULL,
  valid_to     date,
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX tax_rates_no_overlap ON tax_rates (tax_code_id, valid_from);
