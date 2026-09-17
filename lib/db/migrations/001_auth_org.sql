-- 001_auth_org.sql
-- Pengguna, organisasi, keanggotaan, undangan.

CREATE TYPE member_role AS ENUM (
  'OWNER',
  'ADMIN_KEUANGAN',
  'STAF_INPUT',
  'MANAJER_PROJECT'
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  company_code  text NOT NULL,
  npwp          text,
  address       text,
  phone         text,
  email         text,
  logo_key      text,
  bank_account_label text,
  fiscal_year_start_month smallint NOT NULL DEFAULT 1
    CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  require_project_groups text[] NOT NULL
    DEFAULT ARRAY['PENDAPATAN','BEBAN_POKOK_PROJECT'],
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_code),
  CHECK (company_code ~ '^[A-Z0-9]{2,6}$')
);

CREATE TABLE memberships (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  role      member_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE invitations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  email      citext NOT NULL,
  role       member_role NOT NULL,
  token      text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES users,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id          bigserial PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  user_id     uuid REFERENCES users,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_org_time_idx ON audit_logs (org_id, created_at DESC);

CREATE TABLE fiscal_years (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  year      smallint NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closing_entry_id uuid,
  UNIQUE (org_id, year)
);

CREATE TYPE period_status AS ENUM ('TERBUKA', 'TERKUNCI', 'DITUTUP');

CREATE TABLE periods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  fiscal_year_id uuid NOT NULL REFERENCES fiscal_years ON DELETE CASCADE,
  year           smallint NOT NULL,
  month          smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  status         period_status NOT NULL DEFAULT 'TERBUKA',
  locked_at      timestamptz,
  locked_by      uuid REFERENCES users,
  UNIQUE (org_id, year, month)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
