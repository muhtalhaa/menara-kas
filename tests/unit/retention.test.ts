import { describe, expect, it } from "vitest";
import { fromRupiah } from "@/lib/accounting/money";
import { rateFromNumeric } from "@/lib/accounting/tax";
import { buildSalesInvoiceEntry } from "@/lib/accounting/posting/build-invoice";
import { PRJ_001 } from "@/tests/fixtures/prj-001";

describe("retensi invoice", () => {
  it("memindahkan retensi ke Piutang Retensi tanpa mengurangi pendapatan", () => {
    const retention = fromRupiah("10.000.000");
    const built = buildSalesInvoiceEntry({
      entryDate: "2026-09-18",
      customerId: "cust",
      piutangAccountId: "piutang",
      ppnKeluaranAccountId: "ppn",
      piutangRetensiAccountId: "retensi",
      taxCodeId: "ppn-code",
      taxTreatment: "BELUM_TERMASUK_PPN",
      vatRate: rateFromNumeric(PRJ_001.vatRate),
      discount: 0n,
      retentionAmount: retention,
      items: [
        {
          accountId: "pendapatan",
          projectId: "prj-001",
          amount: PRJ_001.invoiceDpp,
          description: "Termin 1",
        },
      ],
    });

    expect(built.retention).toBe(retention);
    expect(
      built.draft.lines.find((line) => line.accountId === "pendapatan")?.credit,
    ).toBe(PRJ_001.invoiceDpp);
    expect(
      built.draft.lines.find((line) => line.accountId === "retensi")?.debit,
    ).toBe(retention);
    expect(
      built.draft.lines.find(
        (line) =>
          line.accountId === "piutang" &&
          line.projectId === "prj-001" &&
          line.description === "Piutang usaha",
      )?.debit,
    ).toBe(PRJ_001.invoiceDpp - retention);
  });
});
