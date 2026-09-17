import { afterEach, describe, expect, it } from "vitest";
import { fromRupiah } from "@/lib/accounting/money";
import { DomainError } from "@/lib/server/errors";
import {
  createJournalHarness,
  type JournalHarness,
} from "@/tests/helpers/journal-harness";
import {
  createKwitansi,
  createQuotation,
} from "@/lib/repositories/documents";
import { pool } from "@/lib/db/client";

describe("dokumen QT/BA/KW dan penomoran", () => {
  let harness: JournalHarness | undefined;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
      harness = undefined;
    }
  });

  async function customerId(orgId: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO contacts (org_id, name, is_customer)
       VALUES ($1, 'Pelanggan Dokumen', true) RETURNING id`,
      [orgId],
    );
    return result.rows[0]?.id ?? "";
  }

  it("mengulang seq saat tahun berganti", async () => {
    harness = await createJournalHarness();
    const customer = await customerId(harness.orgId);
    const first = await createQuotation(harness.ctx, {
      quoteDate: "2026-09-18",
      customerId: customer,
      items: [
        {
          description: "Pekerjaan 2026",
          quantity: "1",
          unitPrice: fromRupiah("10.000.000"),
          amount: fromRupiah("10.000.000"),
        },
      ],
    });
    const second = await createQuotation(harness.ctx, {
      quoteDate: "2027-01-05",
      customerId: customer,
      items: [
        {
          description: "Pekerjaan 2027",
          quantity: "1",
          unitPrice: fromRupiah("12.000.000"),
          amount: fromRupiah("12.000.000"),
        },
      ],
    });
    expect(first.documentNo).toMatch(/^001\/QT-.+\/09\/2026$/);
    expect(second.documentNo).toMatch(/^001\/QT-.+\/01\/2027$/);
  });

  it("ubah company_code tidak mengubah nomor dokumen lama", async () => {
    harness = await createJournalHarness();
    const customer = await customerId(harness.orgId);
    const created = await createQuotation(harness.ctx, {
      quoteDate: "2026-09-18",
      customerId: customer,
      items: [
        {
          description: "Penawaran tetap",
          quantity: "1",
          unitPrice: fromRupiah("5.000.000"),
          amount: fromRupiah("5.000.000"),
        },
      ],
    });
    const oldCode = created.documentNo.split("/")[1]?.split("-")[1] ?? "";
    await pool.query(
      `UPDATE organizations SET company_code = 'ZZZZ' WHERE id = $1`,
      [harness.orgId],
    );
    const stored = await pool.query<{ document_no: string }>(
      `SELECT document_no FROM quotations WHERE id = $1`,
      [created.id],
    );
    expect(stored.rows[0]?.document_no).toBe(created.documentNo);
    expect(created.documentNo).toContain(oldCode);
    expect(created.documentNo).not.toContain("ZZZZ");
  });

  it("menolak nomor dokumen duplikat", async () => {
    harness = await createJournalHarness();
    const customer = await customerId(harness.orgId);
    const created = await createQuotation(harness.ctx, {
      quoteDate: "2026-09-18",
      customerId: customer,
      items: [
        {
          description: "Satu",
          quantity: "1",
          unitPrice: fromRupiah("1.000.000"),
          amount: fromRupiah("1.000.000"),
        },
      ],
    });
    await expect(
      pool.query(
        `INSERT INTO quotations
           (org_id, document_no, seq_year, seq_no, quote_date, customer_id,
            status, subtotal, discount, tax_amount, total)
         VALUES ($1, $2, 2026, 999, '2026-09-19'::date, $3,
                 'DRAFT', 0, 0, 0, 0)`,
        [harness.orgId, created.documentNo, customer],
      ),
    ).rejects.toThrow();
  });

  it("menolak kwitansi nilai nol atau negatif", async () => {
    harness = await createJournalHarness();
    const customer = await customerId(harness.orgId);
    await expect(
      createKwitansi(harness.ctx, {
        kwDate: "2026-09-18",
        contactId: customer,
        description: "Pelunasan",
        amount: 0n,
      }),
    ).rejects.toThrow(DomainError);
    await expect(
      createKwitansi(harness.ctx, {
        kwDate: "2026-09-18",
        contactId: customer,
        description: "Pelunasan",
        amount: fromRupiah("-1000"),
      }),
    ).rejects.toThrow(/lebih dari nol/);
  });
});
