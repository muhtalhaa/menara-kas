import { randomBytes } from "node:crypto";
import { pool } from "@/lib/db/client";
import { seedChartOfAccounts } from "@/lib/db/seed/coa";
import type { OrgContext } from "@/lib/db/tenant";

export type JournalHarness = {
  ctx: OrgContext;
  orgId: string;
  userId: string;
  periodId: string;
  projectId: string;
  accounts: {
    parent: string;
    kas: string;
    bank: string;
    piutang: string;
    revenue: string;
    material: string;
    sewa: string;
  };
  cleanup: () => Promise<void>;
};

function token(): string {
  return randomBytes(3).toString("hex").slice(0, 5).toUpperCase();
}

export async function createJournalHarness(): Promise<JournalHarness> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash, email_verified_at)
       VALUES ($1, 'Tester Jurnal', 'x', now())
       RETURNING id`,
      [`jurnal-${token()}@example.test`],
    );
    const userId = user.rows[0]?.id;
    if (!userId) throw new Error("Gagal membuat user tes.");

    const org = await client.query<{ id: string }>(
      `INSERT INTO organizations (name, company_code)
       VALUES ('Tes Jurnal', $1)
       RETURNING id`,
      [`T${token()}`],
    );
    const orgId = org.rows[0]?.id;
    if (!orgId) throw new Error("Gagal membuat organisasi tes.");

    await client.query(
      `INSERT INTO memberships (org_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [orgId, userId],
    );

    const fy = await client.query<{ id: string }>(
      `INSERT INTO fiscal_years (org_id, year) VALUES ($1, 2026) RETURNING id`,
      [orgId],
    );
    const fiscalYearId = fy.rows[0]?.id;
    if (!fiscalYearId) throw new Error("Gagal membuat tahun buku tes.");

    let periodId = "";
    for (let month = 1; month <= 12; month++) {
      const start = `2026-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(2026, month, 0).getDate();
      const end = `2026-${String(month).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;
      const period = await client.query<{ id: string }>(
        `INSERT INTO periods (org_id, fiscal_year_id, year, month, start_date, end_date, status)
         VALUES ($1, $2, 2026, $3, $4::date, $5::date, 'TERBUKA')
         RETURNING id`,
        [orgId, fiscalYearId, month, start, end],
      );
      if (month === 9) {
        periodId = period.rows[0]?.id ?? "";
      }
    }
    if (!periodId) throw new Error("Gagal membuat periode tes.");

    await seedChartOfAccounts(client, orgId, "konstruksi");

    const project = await client.query<{ id: string }>(
      `INSERT INTO projects (org_id, code, name, contract_value)
       VALUES ($1, 'PRJ-001', 'Renovasi Kantor BCA Sudirman', 500000000)
       RETURNING id`,
      [orgId],
    );
    const projectId = project.rows[0]?.id;
    if (!projectId) throw new Error("Gagal membuat project tes.");

    const accounts = await client.query<{ id: string; account_no: string }>(
      `SELECT id, account_no FROM accounts
       WHERE org_id = $1 AND account_no = ANY($2::text[])`,
      [
        orgId,
        ["1-1000", "1-1100", "1-1200", "1-1300", "4-1100", "5-1100", "6-2100"],
      ],
    );
    const byNo = new Map(accounts.rows.map((row) => [row.account_no, row.id]));
    const required = [
      "1-1000",
      "1-1100",
      "1-1200",
      "1-1300",
      "4-1100",
      "5-1100",
      "6-2100",
    ];
    for (const no of required) {
      if (!byNo.get(no)) throw new Error(`Akun tes ${no} tidak ditemukan.`);
    }

    await client.query("COMMIT");

    return {
      ctx: { orgId, userId },
      orgId,
      userId,
      periodId,
      projectId,
      accounts: {
        parent: byNo.get("1-1000") ?? "",
        kas: byNo.get("1-1100") ?? "",
        bank: byNo.get("1-1200") ?? "",
        piutang: byNo.get("1-1300") ?? "",
        revenue: byNo.get("4-1100") ?? "",
        material: byNo.get("5-1100") ?? "",
        sewa: byNo.get("6-2100") ?? "",
      },
      cleanup: async () => {
        const cleaner = await pool.connect();
        try {
          await cleaner.query("BEGIN");
          await cleaner.query("SELECT set_config('app.purge', 'on', true)");
          await cleaner.query(
            `DELETE FROM performance_bonds WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(
            `DELETE FROM project_terms WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(
            `DELETE FROM kwitansi WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(
            `DELETE FROM berita_acara WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(
            `DELETE FROM payments WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(
            `DELETE FROM sales_invoices WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(
            `DELETE FROM quotations WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(
            `DELETE FROM purchase_bills WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(
            `DELETE FROM journal_entries WHERE org_id = $1`,
            [orgId],
          );
          await cleaner.query(`DELETE FROM organizations WHERE id = $1`, [
            orgId,
          ]);
          await cleaner.query(`DELETE FROM users WHERE id = $1`, [userId]);
          await cleaner.query("COMMIT");
        } catch (error) {
          await cleaner.query("ROLLBACK");
          throw error;
        } finally {
          cleaner.release();
        }
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
