import type { PoolClient } from "pg";
import { withOrg, type OrgContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/server/errors";
import { recordAudit } from "@/lib/server/audit";
import { toDomainError } from "@/lib/repositories/numbering";

export type PeriodRow = {
  id: string;
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  status: "TERBUKA" | "TERKUNCI" | "DITUTUP";
  draft_count: number;
};

export async function findPeriodForDate(
  client: PoolClient,
  orgId: string,
  entryDate: string,
): Promise<{ id: string; status: PeriodRow["status"]; year: number; month: number }> {
  const result = await client.query<{
    id: string;
    status: PeriodRow["status"];
    year: number;
    month: number;
  }>(
    `SELECT id, status, year, month
     FROM periods
     WHERE org_id = $1 AND start_date <= $2::date AND end_date >= $2::date
     LIMIT 1`,
    [orgId, entryDate],
  );
  const period = result.rows[0];
  if (!period) {
    throw new DomainError(
      `Tidak ada periode untuk tanggal ${entryDate}. Periksa tahun buku di Pengaturan.`,
      { entryDate: "Tanggal di luar tahun buku." },
    );
  }
  return period;
}

export function assertPeriodOpen(
  period: { status: PeriodRow["status"]; month: number; year: number },
): void {
  if (period.status === "TERBUKA") return;
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const name = months[period.month - 1];
  throw new DomainError(
    `Periode ${name} ${period.year} sudah ${period.status}. Minta Owner membuka periode lebih dulu, atau catat transaksi ini di periode yang masih terbuka.`,
  );
}

export async function listPeriods(
  ctx: OrgContext,
  year: number,
): Promise<PeriodRow[]> {
  return withOrg(ctx, async (client) => {
    const result = await client.query<PeriodRow>(
      `SELECT p.id, p.year, p.month, p.start_date::text, p.end_date::text, p.status,
              (
                SELECT COUNT(*)::int
                FROM journal_entries e
                WHERE e.org_id = p.org_id
                  AND e.period_id = p.id
                  AND e.status = 'DRAFT'
              ) AS draft_count
       FROM periods p
       WHERE p.org_id = $1 AND p.year = $2
       ORDER BY p.month`,
      [ctx.orgId, year],
    );
    return result.rows;
  });
}

export async function lockPeriod(
  ctx: OrgContext,
  periodId: string,
): Promise<{ id: string; status: string }> {
  try {
    return await withOrg(ctx, async (client) => {
      const current = await client.query<PeriodRow>(
        `SELECT p.id, p.year, p.month, p.start_date::text, p.end_date::text, p.status,
                (
                  SELECT COUNT(*)::int FROM journal_entries e
                  WHERE e.org_id = p.org_id AND e.period_id = p.id AND e.status = 'DRAFT'
                ) AS draft_count
         FROM periods p
         WHERE p.org_id = $1 AND p.id = $2`,
        [ctx.orgId, periodId],
      );
      const period = current.rows[0];
      if (!period) {
        throw new DomainError("Periode tidak ditemukan.");
      }
      if (period.status === "DITUTUP") {
        throw new DomainError(
          `Periode ${period.month}/${period.year} sudah ditutup dan tidak bisa diubah.`,
        );
      }
      if (period.status === "TERKUNCI") {
        throw new DomainError(
          `Periode ${period.month}/${period.year} sudah terkunci.`,
        );
      }
      if (period.draft_count > 0) {
        throw new DomainError(
          `Periode ${period.month}/${period.year} masih punya ${period.draft_count} transaksi draft. Posting atau hapus draft itu dulu sebelum mengunci periode.`,
        );
      }

      await client.query(
        `UPDATE periods
         SET status = 'TERKUNCI', locked_at = now(), locked_by = $3
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, periodId, ctx.userId],
      );
      await recordAudit(
        ctx,
        "PERIOD_LOCKED",
        "period",
        periodId,
        { status: "TERBUKA" },
        { status: "TERKUNCI", year: period.year, month: period.month },
        client,
      );
      return { id: periodId, status: "TERKUNCI" };
    });
  } catch (error) {
    toDomainError(error);
  }
}

export async function unlockPeriod(
  ctx: OrgContext,
  periodId: string,
  reason: string,
): Promise<{ id: string; status: string }> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new DomainError("Alasan membuka periode wajib diisi.", {
      reason: "Tuliskan alasan pembukaan.",
    });
  }

  try {
    return await withOrg(ctx, async (client) => {
      const current = await client.query<{
        id: string;
        year: number;
        month: number;
        status: PeriodRow["status"];
      }>(
        `SELECT id, year, month, status
         FROM periods
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, periodId],
      );
      const period = current.rows[0];
      if (!period) {
        throw new DomainError("Periode tidak ditemukan.");
      }
      if (period.status === "DITUTUP") {
        throw new DomainError(
          `Periode ${period.month}/${period.year} sudah ditutup dan tidak bisa dibuka kembali.`,
        );
      }
      if (period.status !== "TERKUNCI") {
        throw new DomainError(
          `Periode ${period.month}/${period.year} tidak terkunci.`,
        );
      }

      await client.query(
        `UPDATE periods
         SET status = 'TERBUKA', locked_at = NULL, locked_by = NULL
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, periodId],
      );
      await recordAudit(
        ctx,
        "PERIOD_UNLOCKED",
        "period",
        periodId,
        { status: "TERKUNCI" },
        { status: "TERBUKA", year: period.year, month: period.month, reason: trimmed },
        client,
      );
      return { id: periodId, status: "TERBUKA" };
    });
  } catch (error) {
    toDomainError(error);
  }
}
