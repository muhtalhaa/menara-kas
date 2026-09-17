import { afterEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db/client";
import { DomainError } from "@/lib/server/errors";
import { fromRupiah } from "@/lib/accounting/money";
import { postEntry, reverseEntry, saveDraft, updateDraft } from "@/lib/repositories/entries";
import { buildCashOutEntry } from "@/lib/accounting/posting/build-cash";
import { lockPeriod } from "@/lib/repositories/periods";
import {
  createJournalHarness,
  type JournalHarness,
} from "@/tests/helpers/journal-harness";

const DATE = "2026-09-18";

describe("invariant jurnal (PostgreSQL)", () => {
  let harness: JournalHarness | undefined;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
      harness = undefined;
    }
  });

  it("memposting jurnal seimbang lewat postEntry", async () => {
    harness = await createJournalHarness();
    const saved = await postEntry(harness.ctx, {
      entryDate: DATE,
      source: "JURNAL_UMUM",
      memo: "Setoran modal",
      lines: [
        {
          accountId: harness.accounts.kas,
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: fromRupiah("1.000.000"),
          credit: 0n,
          description: "Kas masuk",
        },
        {
          accountId: harness.accounts.sewa,
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: 0n,
          credit: fromRupiah("1.000.000"),
          description: "lawan sementara",
        },
      ],
    });
    expect(saved.status).toBe("TERPOSTING");
    expect(saved.entryNo).toMatch(/^JU-2026-\d{4}$/);
  });

  it("I1 trigger menolak jurnal tidak seimbang yang disisipkan SQL", async () => {
    harness = await createJournalHarness();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const entry = await client.query<{ id: string }>(
        `INSERT INTO journal_entries
           (org_id, entry_no, entry_date, period_id, source, status, created_by)
         VALUES ($1, 'JU-2026-0099', $2::date, $3, 'JURNAL_UMUM', 'DRAFT', $4)
         RETURNING id`,
        [harness.orgId, DATE, harness.periodId, harness.userId],
      );
      const entryId = entry.rows[0]?.id;
      await client.query(
        `INSERT INTO journal_lines (entry_id, line_no, account_id, debit, credit)
         VALUES ($1, 1, $2, 100000, 0)`,
        [entryId, harness.accounts.kas],
      );
      await client.query(
        `INSERT INTO journal_lines (entry_id, line_no, account_id, debit, credit)
         VALUES ($1, 2, $2, 0, 40000)`,
        [entryId, harness.accounts.sewa],
      );
      await expect(client.query("COMMIT")).rejects.toThrow(/tidak seimbang/);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("I2 CHECK menolak baris yang debit dan kredit sekaligus", async () => {
    harness = await createJournalHarness();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const entry = await client.query<{ id: string }>(
        `INSERT INTO journal_entries
           (org_id, entry_no, entry_date, period_id, source, status, created_by)
         VALUES ($1, 'JU-2026-0098', $2::date, $3, 'JURNAL_UMUM', 'DRAFT', $4)
         RETURNING id`,
        [harness.orgId, DATE, harness.periodId, harness.userId],
      );
      await expect(
        client.query(
          `INSERT INTO journal_lines (entry_id, line_no, account_id, debit, credit)
           VALUES ($1, 1, $2, 10000, 10000)`,
          [entry.rows[0]?.id, harness.accounts.kas],
        ),
      ).rejects.toThrow(/journal_lines_one_side/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("I3 menolak posting ke periode terkunci", async () => {
    harness = await createJournalHarness();
    await lockPeriod(harness.ctx, harness.periodId);
    await expect(
      postEntry(harness.ctx, {
        entryDate: DATE,
        source: "JURNAL_UMUM",
        memo: "terlambat",
        lines: [
          {
            accountId: harness.accounts.kas,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: fromRupiah("10.000"),
            credit: 0n,
            description: null,
          },
          {
            accountId: harness.accounts.sewa,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: 0n,
            credit: fromRupiah("10.000"),
            description: null,
          },
        ],
      }),
    ).rejects.toThrow(DomainError);
    await expect(
      postEntry(harness.ctx, {
        entryDate: DATE,
        source: "JURNAL_UMUM",
        memo: "terlambat",
        lines: [
          {
            accountId: harness.accounts.kas,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: fromRupiah("10.000"),
            credit: 0n,
            description: null,
          },
          {
            accountId: harness.accounts.sewa,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: 0n,
            credit: fromRupiah("10.000"),
            description: null,
          },
        ],
      }),
    ).rejects.toThrow(/sudah TERKUNCI/);
  });

  it("menolak mengunci periode yang masih punya draft", async () => {
    harness = await createJournalHarness();
    await saveDraft(harness.ctx, {
      entryDate: DATE,
      source: "JURNAL_UMUM",
      memo: "draft",
      lines: [
        {
          accountId: harness.accounts.kas,
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: fromRupiah("10.000"),
          credit: 0n,
          description: null,
        },
        {
          accountId: harness.accounts.sewa,
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: 0n,
          credit: fromRupiah("10.000"),
          description: null,
        },
      ],
    });
    await expect(lockPeriod(harness.ctx, harness.periodId)).rejects.toThrow(
      /masih punya 1 transaksi draft/,
    );
  });

  it("I4 menolak mengubah jurnal terposting, termasuk lewat SQL", async () => {
    harness = await createJournalHarness();
    const saved = await postEntry(harness.ctx, {
      entryDate: DATE,
      source: "JURNAL_UMUM",
      memo: "asli",
      lines: [
        {
          accountId: harness.accounts.kas,
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: fromRupiah("25.000"),
          credit: 0n,
          description: null,
        },
        {
          accountId: harness.accounts.sewa,
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: 0n,
          credit: fromRupiah("25.000"),
          description: null,
        },
      ],
    });

    await expect(
      updateDraft(harness.ctx, saved.id, {
        entryDate: DATE,
        source: "JURNAL_UMUM",
        memo: "diubah",
        lines: [
          {
            accountId: harness.accounts.kas,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: fromRupiah("25.000"),
            credit: 0n,
            description: null,
          },
          {
            accountId: harness.accounts.sewa,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: 0n,
            credit: fromRupiah("25.000"),
            description: null,
          },
        ],
      }),
    ).rejects.toThrow(/tidak bisa diubah/);

    await expect(
      pool.query(`UPDATE journal_entries SET memo = 'hack' WHERE id = $1`, [
        saved.id,
      ]),
    ).rejects.toThrow(/tidak bisa diubah/);
  });

  it("I5 menolak akun induk", async () => {
    harness = await createJournalHarness();
    await expect(
      postEntry(harness.ctx, {
        entryDate: DATE,
        source: "JURNAL_UMUM",
        memo: "induk",
        lines: [
          {
            accountId: harness.accounts.parent,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: fromRupiah("5.000"),
            credit: 0n,
            description: null,
          },
          {
            accountId: harness.accounts.kas,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: 0n,
            credit: fromRupiah("5.000"),
            description: null,
          },
        ],
      }),
    ).rejects.toThrow(/akun induk/);
  });

  it("I6 menolak beban pokok tanpa project", async () => {
    harness = await createJournalHarness();
    await expect(
      postEntry(harness.ctx, {
        entryDate: DATE,
        source: "JURNAL_UMUM",
        memo: "material",
        lines: [
          {
            accountId: harness.accounts.material,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: fromRupiah("80.000.000"),
            credit: 0n,
            description: null,
          },
          {
            accountId: harness.accounts.kas,
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: 0n,
            credit: fromRupiah("80.000.000"),
            description: null,
          },
        ],
      }),
    ).rejects.toThrow(/wajib punya project/);
  });

  it("membuat jurnal balik dan menandai asal DIBATALKAN", async () => {
    harness = await createJournalHarness();
    const saved = await postEntry(harness.ctx, {
      entryDate: DATE,
      source: "JURNAL_UMUM",
      memo: "akan dibalik",
      lines: [
        {
          accountId: harness.accounts.kas,
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: fromRupiah("15.000"),
          credit: 0n,
          description: null,
        },
        {
          accountId: harness.accounts.sewa,
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: 0n,
          credit: fromRupiah("15.000"),
          description: null,
        },
      ],
    });
    const reversal = await reverseEntry(harness.ctx, {
      entryId: saved.id,
      reversalDate: DATE,
    });
    expect(reversal.entryNo).toMatch(/^JB-2026-\d{4}$/);
    const original = await pool.query<{ status: string }>(
      `SELECT status FROM journal_entries WHERE id = $1`,
      [saved.id],
    );
    expect(original.rows[0]?.status).toBe("DIBATALKAN");
  });

  it("kas keluar tanpa project pada beban pokok ditolak saat posting", async () => {
    harness = await createJournalHarness();
    await expect(
      postEntry(
        harness.ctx,
        buildCashOutEntry({
          entryDate: DATE,
          memo: "material tanpa project",
          cashAccountId: harness.accounts.kas,
          lines: [
            {
              accountId: harness.accounts.material,
              amount: fromRupiah("80.000.000"),
            },
          ],
        }),
      ),
    ).rejects.toThrow(/wajib punya project/);
  });

  it("kas keluar terposting memakai nomor KK-YYYY-####", async () => {
    harness = await createJournalHarness();
    const saved = await postEntry(
      harness.ctx,
      buildCashOutEntry({
        entryDate: DATE,
        memo: "material PRJ-001",
        cashAccountId: harness.accounts.bank,
        lines: [
          {
            accountId: harness.accounts.material,
            projectId: harness.projectId,
            amount: fromRupiah("80.000.000"),
          },
        ],
      }),
    );
    expect(saved.status).toBe("TERPOSTING");
    expect(saved.entryNo).toMatch(/^KK-2026-\d{4}$/);
  });
});
