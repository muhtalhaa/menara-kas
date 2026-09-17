import { describe, expect, it } from "vitest";
import { fromRupiah } from "@/lib/accounting/money";
import { rateFromNumeric } from "@/lib/accounting/tax";
import { buildPurchaseBillEntry } from "@/lib/accounting/posting/build-bill";
import { AccountingError } from "@/lib/accounting/errors";
import { PRJ_001 } from "@/tests/fixtures/prj-001";

describe("buildPurchaseBillEntry", () => {
  it("membentuk utang dan beban tanpa PPN untuk vendor non PKP", () => {
    const built = buildPurchaseBillEntry({
      entryDate: "2026-09-18",
      vendorId: "vendor",
      utangAccountId: "utang",
      ppnMasukanAccountId: "ppn",
      taxCodeId: null,
      taxTreatment: "NON_PPN",
      vatRate: rateFromNumeric("11"),
      discount: 0n,
      items: [
        {
          accountId: "mat",
          projectId: "prj-001",
          amount: PRJ_001.material,
          description: "Material",
        },
      ],
    });
    expect(built.vat).toBe(0n);
    expect(built.total).toBe(PRJ_001.material);
    expect(
      built.draft.lines.find((line) => line.accountId === "mat")?.debit,
    ).toBe(PRJ_001.material);
    expect(
      built.draft.lines.find((line) => line.accountId === "utang")?.credit,
    ).toBe(PRJ_001.material);
  });

  it("menolak tagihan tanpa vendor", () => {
    expect(() =>
      buildPurchaseBillEntry({
        entryDate: "2026-09-18",
        vendorId: "",
        utangAccountId: "utang",
        ppnMasukanAccountId: "ppn",
        taxCodeId: null,
        taxTreatment: "NON_PPN",
        vatRate: 0n,
        discount: 0n,
        items: [
          {
            accountId: "mat",
            projectId: null,
            amount: fromRupiah("1.000"),
            description: null,
          },
        ],
      }),
    ).toThrow(AccountingError);
  });
});
