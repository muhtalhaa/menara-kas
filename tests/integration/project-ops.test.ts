import { afterEach, describe, expect, it } from "vitest";
import { fromRupiah } from "@/lib/accounting/money";
import { DomainError } from "@/lib/server/errors";
import {
  createJournalHarness,
  type JournalHarness,
} from "@/tests/helpers/journal-harness";
import {
  createProjectTerm,
  createPerformanceBond,
} from "@/lib/repositories/project-ops";
import { postSalesInvoice } from "@/lib/repositories/invoices";
import { pool } from "@/lib/db/client";

describe("project terms dan jaminan", () => {
  let harness: JournalHarness | undefined;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
      harness = undefined;
    }
  });

  it("menolak total persen termin di atas 100%", async () => {
    harness = await createJournalHarness();
    await createProjectTerm(harness.ctx, {
      projectId: harness.projectId,
      termNo: 1,
      name: "Termin 1",
      percent: 60,
      amount: fromRupiah("300.000.000"),
    });
    await expect(
      createProjectTerm(harness.ctx, {
        projectId: harness.projectId,
        termNo: 2,
        name: "Termin 2",
        percent: 50,
        amount: fromRupiah("250.000.000"),
      }),
    ).rejects.toThrow(/tidak boleh melebihi 100%/);
  });

  it("menolak dua invoice aktif pada satu termin", async () => {
    harness = await createJournalHarness();
    const customer = await pool.query<{ id: string }>(
      `INSERT INTO contacts (org_id, name, is_customer)
       VALUES ($1, 'Pelanggan Termin', true) RETURNING id`,
      [harness.orgId],
    );
    const customerId = customer.rows[0]?.id ?? "";
    const tax = await pool.query<{ id: string }>(
      `SELECT id FROM tax_codes WHERE org_id = $1 AND code = 'PPN_KELUARAN'`,
      [harness.orgId],
    );
    const term = await createProjectTerm(harness.ctx, {
      projectId: harness.projectId,
      termNo: 1,
      name: "DP 30%",
      percent: 30,
      amount: fromRupiah("150.000.000"),
    });

    await postSalesInvoice(harness.ctx, {
      invoiceDate: "2026-09-18",
      dueDate: "2026-10-18",
      customerId,
      projectId: harness.projectId,
      taxTreatment: "NON_PPN",
      taxCodeId: tax.rows[0]?.id,
      termId: term.id,
      items: [
        {
          description: "DP 30%",
          projectId: harness.projectId,
          accountId: harness.accounts.revenue,
          quantity: "1",
          unitPrice: fromRupiah("150.000.000"),
          amount: fromRupiah("150.000.000"),
        },
      ],
    });

    await expect(
      postSalesInvoice(harness.ctx, {
        invoiceDate: "2026-09-19",
        dueDate: "2026-10-19",
        customerId,
        projectId: harness.projectId,
        taxTreatment: "NON_PPN",
        termId: term.id,
        items: [
          {
            description: "Duplikat",
            projectId: harness.projectId,
            accountId: harness.accounts.revenue,
            quantity: "1",
            unitPrice: fromRupiah("10.000"),
            amount: fromRupiah("10.000"),
          },
        ],
      }),
    ).rejects.toThrow(DomainError);
  });

  it("menyimpan jaminan pelaksanaan", async () => {
    harness = await createJournalHarness();
    const bond = await createPerformanceBond(harness.ctx, {
      projectId: harness.projectId,
      kind: "PELAKSANAAN",
      bondNo: "BG-001",
      issuer: "Bank BCA",
      amount: fromRupiah("25.000.000"),
      issuedOn: "2026-09-01",
      expiresOn: "2026-12-01",
    });
    expect(bond.id).toBeTruthy();
  });
});
