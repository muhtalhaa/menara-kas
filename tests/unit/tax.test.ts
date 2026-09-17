import { describe, expect, it } from "vitest";
import { computeWithholding, rateFromNumeric, splitVat } from "@/lib/accounting/tax";
import { PRJ_001 } from "@/tests/fixtures/prj-001";

describe("tax", () => {
  it("menghitung PPN 11% dari DPP invoice T1 secara manual", () => {
    const rate = rateFromNumeric(PRJ_001.vatRate);
    const split = splitVat({
      amount: PRJ_001.invoiceDpp,
      rate,
      treatment: "BELUM_TERMASUK_PPN",
    });
    expect(split.dpp).toBe(PRJ_001.invoiceDpp);
    expect(split.vat).toBe(PRJ_001.invoiceVat);
    expect(split.total).toBe(PRJ_001.invoiceTotal);
  });

  it("memecah nilai termasuk PPN 11% kembali ke DPP T1", () => {
    const split = splitVat({
      amount: PRJ_001.invoiceTotal,
      rate: rateFromNumeric(PRJ_001.vatRate),
      treatment: "TERMASUK_PPN",
    });
    expect(split.dpp).toBe(PRJ_001.invoiceDpp);
    expect(split.vat).toBe(PRJ_001.invoiceVat);
    expect(split.total).toBe(PRJ_001.invoiceTotal);
  });

  it("menghitung PPh 4(2) 2% dari DPP T2", () => {
    expect(
      computeWithholding({
        base: PRJ_001.invoiceDpp,
        rate: rateFromNumeric(PRJ_001.pph42Rate),
      }),
    ).toBe(PRJ_001.pph42);
    expect(PRJ_001.invoiceTotal - PRJ_001.pph42).toBe(PRJ_001.cashReceived);
  });

  it("non PPN tidak menambah pajak", () => {
    const split = splitVat({
      amount: PRJ_001.material,
      rate: rateFromNumeric("11"),
      treatment: "NON_PPN",
    });
    expect(split.vat).toBe(0n);
    expect(split.total).toBe(PRJ_001.material);
  });
});
