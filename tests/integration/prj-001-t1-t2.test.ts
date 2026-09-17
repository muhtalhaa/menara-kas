import { afterEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db/client";
import { fromDbNumeric, fromRupiah } from "@/lib/accounting/money";
import { PRJ_001 } from "@/tests/fixtures/prj-001";
import { createJournalHarness, type JournalHarness } from "@/tests/helpers/journal-harness";
import {
  postSalesInvoice,
  receiveInvoicePayment,
} from "@/lib/repositories/invoices";
import { DomainError } from "@/lib/server/errors";

const DATE = "2026-09-18";

async function customerAndTax(orgId: string) {
  const customer = await pool.query<{ id: string }>(
    `INSERT INTO contacts (org_id, name, is_customer)
     VALUES ($1, 'Bank BCA', true)
     RETURNING id`,
    [orgId],
  );
  const tax = await pool.query<{ id: string }>(
    `SELECT id FROM tax_codes WHERE org_id = $1 AND code = 'PPN_KELUARAN'`,
    [orgId],
  );
  const pph = await pool.query<{ id: string }>(
    `SELECT id FROM tax_codes WHERE org_id = $1 AND code = 'PPH_4_2'`,
    [orgId],
  );
  return {
    customerId: customer.rows[0]?.id ?? "",
    taxCodeId: tax.rows[0]?.id ?? "",
    pphCodeId: pph.rows[0]?.id ?? "",
  };
}

describe("PRJ-001 T1 T2", () => {
  let harness: JournalHarness | undefined;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
      harness = undefined;
    }
  });

  it("T1 invoice dan T2 pelunasan membentuk jurnal sesuai data-model 6.4", async () => {
    harness = await createJournalHarness();
    const ids = await customerAndTax(harness.orgId);

    const invoice = await postSalesInvoice(harness.ctx, {
      invoiceDate: DATE,
      dueDate: "2026-10-18",
      customerId: ids.customerId,
      projectId: harness.projectId,
      taxTreatment: "BELUM_TERMASUK_PPN",
      taxCodeId: ids.taxCodeId,
      notes: "Termin 1",
      items: [
        {
          description: "Termin 1 renovasi",
          projectId: harness.projectId,
          accountId: harness.accounts.revenue,
          quantity: "1",
          unitPrice: PRJ_001.invoiceDpp,
          amount: PRJ_001.invoiceDpp,
        },
      ],
    });
    expect(invoice.documentNo).toMatch(/^\d{3}\/INV-T[A-Z0-9]+\/09\/2026$/);

    const t1 = await pool.query<{
      account_no: string;
      project_id: string | null;
      debit: string;
      credit: string;
    }>(
      `SELECT a.account_no, l.project_id, l.debit::text, l.credit::text
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
       WHERE e.org_id = $1 AND e.entry_no = $2
       ORDER BY l.line_no`,
      [harness.orgId, invoice.entryNo],
    );

    const by = (accountNo: string, project: string | null) =>
      t1.rows.find(
        (row) =>
          row.account_no === accountNo &&
          row.project_id === project,
      );

    expect(fromDbNumeric(by("1-1300", harness.projectId)?.debit ?? "0")).toBe(
      PRJ_001.invoiceDpp,
    );
    expect(fromDbNumeric(by("1-1300", null)?.debit ?? "0")).toBe(
      PRJ_001.invoiceVat,
    );
    expect(fromDbNumeric(by("4-1100", harness.projectId)?.credit ?? "0")).toBe(
      PRJ_001.invoiceDpp,
    );
    expect(fromDbNumeric(by("2-1310", null)?.credit ?? "0")).toBe(
      PRJ_001.invoiceVat,
    );

    const payment = await receiveInvoicePayment(harness.ctx, {
      paymentDate: DATE,
      invoiceId: invoice.id,
      cashAccountId: harness.accounts.bank,
      allocated: PRJ_001.invoiceTotal,
      notes: "Pelunasan INV",
      withholding: {
        taxCodeId: ids.pphCodeId,
        amount: PRJ_001.pph42,
        projectId: harness.projectId,
      },
    });

    const t2 = await pool.query<{
      account_no: string;
      project_id: string | null;
      debit: string;
      credit: string;
    }>(
      `SELECT a.account_no, l.project_id, l.debit::text, l.credit::text
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
       WHERE e.org_id = $1 AND e.entry_no = $2
       ORDER BY l.line_no`,
      [harness.orgId, payment.entryNo],
    );

    const by2 = (accountNo: string, project: string | null) =>
      t2.rows.find(
        (row) => row.account_no === accountNo && row.project_id === project,
      );

    expect(fromDbNumeric(by2("1-1200", null)?.debit ?? "0")).toBe(
      PRJ_001.cashReceived,
    );
    expect(fromDbNumeric(by2("1-1450", harness.projectId)?.debit ?? "0")).toBe(
      PRJ_001.pph42,
    );
    expect(fromDbNumeric(by2("1-1300", harness.projectId)?.credit ?? "0")).toBe(
      PRJ_001.invoiceDpp,
    );
    expect(fromDbNumeric(by2("1-1300", null)?.credit ?? "0")).toBe(
      PRJ_001.invoiceVat,
    );
  });

  it("menolak invoice tanpa pelanggan dan pelunasan melebihi sisa", async () => {
    harness = await createJournalHarness();
    await expect(
      postSalesInvoice(harness.ctx, {
        invoiceDate: DATE,
        dueDate: DATE,
        customerId: "",
        taxTreatment: "NON_PPN",
        items: [
          {
            description: "x",
            accountId: harness.accounts.revenue,
            quantity: "1",
            unitPrice: fromRupiah("1.000"),
            amount: fromRupiah("1.000"),
          },
        ],
      }),
    ).rejects.toThrow(/pelanggan/);

    const ids = await customerAndTax(harness.orgId);
    const invoice = await postSalesInvoice(harness.ctx, {
      invoiceDate: DATE,
      dueDate: DATE,
      customerId: ids.customerId,
      projectId: harness.projectId,
      taxTreatment: "NON_PPN",
      items: [
        {
          description: "jasa",
          projectId: harness.projectId,
          accountId: harness.accounts.revenue,
          quantity: "1",
          unitPrice: fromRupiah("10.000"),
          amount: fromRupiah("10.000"),
        },
      ],
    });

    await expect(
      receiveInvoicePayment(harness.ctx, {
        paymentDate: DATE,
        invoiceId: invoice.id,
        cashAccountId: harness.accounts.bank,
        allocated: fromRupiah("11.000"),
      }),
    ).rejects.toThrow(DomainError);
  });
});
