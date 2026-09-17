import { seedChartOfAccounts } from "@/lib/db/seed/coa";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db/client";
import { DomainError } from "@/lib/server/errors";
import { COMPANY_CODE_PATTERN } from "@/lib/server/types";
import { setSessionCookies } from "@/lib/server/auth";

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ userId: string }> {
  if (input.password.length < 10) {
    throw new DomainError("Kata sandi minimal 10 karakter.", {
      password: "Kata sandi minimal 10 karakter.",
    });
  }

  const hash = await bcrypt.hash(input.password, 12);
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash, email_verified_at)
       VALUES ($1, $2, $3, now())
       RETURNING id`,
      [input.email.toLowerCase(), input.name.trim(), hash],
    );
    return { userId: result.rows[0]!.id };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      throw new DomainError(
        "Email sudah terdaftar. Silakan masuk atau pakai email lain.",
        { email: "Email sudah terdaftar." },
      );
    }
    throw error;
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ userId: string; orgId: string | null }> {
  const result = await pool.query<{
    id: string;
    password_hash: string;
  }>(`SELECT id, password_hash FROM users WHERE email = $1`, [
    input.email.toLowerCase(),
  ]);

  const user = result.rows[0];
  if (!user) {
    throw new DomainError("Email atau kata sandi salah.");
  }

  const ok = await bcrypt.compare(input.password, user.password_hash);
  if (!ok) {
    throw new DomainError("Email atau kata sandi salah.");
  }

  const membership = await pool.query<{ org_id: string }>(
    `SELECT org_id FROM memberships
     WHERE user_id = $1 AND is_active = true
     ORDER BY created_at ASC
     LIMIT 1`,
    [user.id],
  );

  return {
    userId: user.id,
    orgId: membership.rows[0]?.org_id ?? null,
  };
}

export async function createOrganization(input: {
  userId: string;
  name: string;
  companyCode: string;
  npwp?: string;
  address?: string;
  phone?: string;
  email?: string;
  bankAccountLabel?: string;
  coaTemplate: "konstruksi" | "konsultan" | "kosong";
}): Promise<{ orgId: string }> {
  const code = input.companyCode.trim().toUpperCase();
  if (!COMPANY_CODE_PATTERN.test(code)) {
    throw new DomainError(
      "Kode perusahaan harus 2–6 karakter huruf kapital atau angka.",
      { companyCode: "Format kode tidak valid. Contoh: MMS, KRY01." },
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const org = await client.query<{ id: string }>(
      `INSERT INTO organizations
         (name, company_code, npwp, address, phone, email, bank_account_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.name.trim(),
        code,
        input.npwp ?? null,
        input.address ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.bankAccountLabel ?? null,
      ],
    );
    const orgId = org.rows[0]!.id;

    await client.query(
      `INSERT INTO memberships (org_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [orgId, input.userId],
    );

    const { year } = currentYearMonth();
    const fy = await client.query<{ id: string }>(
      `INSERT INTO fiscal_years (org_id, year) VALUES ($1, $2) RETURNING id`,
      [orgId, year],
    );
    const fiscalYearId = fy.rows[0]!.id;
    for (let month = 1; month <= 12; month++) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0);
      const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      await client.query(
        `INSERT INTO periods (org_id, fiscal_year_id, year, month, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, 'TERBUKA')`,
        [orgId, fiscalYearId, year, month, start, end],
      );
    }

    await client.query(
      `INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, after)
       VALUES ($1, $2, 'ORG_CREATED', 'organization', $1, $3::jsonb)`,
      [
        orgId,
        input.userId,
        JSON.stringify({
          name: input.name,
          companyCode: code,
          coaTemplate: input.coaTemplate,
        }),
      ],
    );

    await seedChartOfAccounts(client, orgId, input.coaTemplate);

    await client.query("COMMIT");
    await setSessionCookies(input.userId, orgId);
    return { orgId };
  } catch (error) {
    await client.query("ROLLBACK");
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      throw new DomainError(
        "Kode perusahaan sudah dipakai. Pilih kode lain.",
        { companyCode: "Kode sudah dipakai." },
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrganizationProfile(input: {
  orgId: string;
  userId: string;
  name: string;
  companyCode: string;
  npwp?: string;
  address?: string;
  phone?: string;
  email?: string;
  bankAccountLabel?: string;
}) {
  const code = input.companyCode.trim().toUpperCase();
  if (!COMPANY_CODE_PATTERN.test(code)) {
    throw new DomainError(
      "Kode perusahaan harus 2–6 karakter huruf kapital atau angka.",
      { companyCode: "Format kode tidak valid." },
    );
  }

  try {
    await pool.query(
      `UPDATE organizations
       SET name = $2,
           company_code = $3,
           npwp = $4,
           address = $5,
           phone = $6,
           email = $7,
           bank_account_label = $8
       WHERE id = $1`,
      [
        input.orgId,
        input.name.trim(),
        code,
        input.npwp ?? null,
        input.address ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.bankAccountLabel ?? null,
      ],
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      throw new DomainError("Kode perusahaan sudah dipakai.", {
        companyCode: "Kode sudah dipakai.",
      });
    }
    throw error;
  }
}
