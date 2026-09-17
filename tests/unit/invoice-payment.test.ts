import { describe, expect, it } from "vitest";
import { PRJ_001 } from "@/tests/fixtures/prj-001";
import { rateFromNumeric } from "@/lib/accounting/tax";
import { buildSalesInvoiceEntry } from "@/lib/accounting/posting/build-invoice";
import { buildReceivePaymentEntry } from "@/lib/accounting/posting/build-payment";
import { formatDocumentNo } from "@/lib/accounting/posting/document-no";
import { AccountingError } from "@/lib/accounting/errors";

describe("buildSalesInvoiceEntry T1", () => {
  it("membentuk jurnal invoice DPP 200 juta plus PPN 22 juta", () => {
    const built = buildSalesInvoiceEntry({
      entryDate: "2026-01-15",
      memo: "Termin 1",
      customerId: "cust",
      piutangAccountId: "piutang",
      ppnKeluaranAccountId: "ppn",
      taxCodeId: "ppn-code",
      taxTreatment: "BELUM_TERMASUK_PPN",
      vatRate: rateFromNumeric(PRJ_001.vatRate),
      discount: 0n,
      items: [
        {
          accountId: "pendapatan",
          projectId: "prj-001",
          amount: PRJ_001.invoiceDpp,
          description: "Termin 1",
        },
      ],
    });

    expect(built.dpp).toBe(PRJ_001.invoiceDpp);
    expect(built.vat).toBe(PRJ_001.invoiceVat);
    expect(built.total).toBe(PRJ_001.invoiceTotal);

    const debitPiutangProject = built.draft.lines.find(
      (line) =>
        line.accountId === "piutang" &&
        line.projectId === "prj-001" &&
        line.debit > 0n,
    );
    const debitPiutangPpn = built.draft.lines.find(
      (line) =>
        line.accountId === "piutang" &&
        line.projectId === null &&
        line.debit > 0n,
    );
    const creditPendapatan = built.draft.lines.find(
      (line) => line.accountId === "pendapatan",
    );
    const creditPpn = built.draft.lines.find(
      (line) => line.accountId === "ppn",
    );

    expect(debitPiutangProject?.debit).toBe(PRJ_001.invoiceDpp);
    expect(debitPiutangPpn?.debit).toBe(PRJ_001.invoiceVat);
    expect(creditPendapatan?.credit).toBe(PRJ_001.invoiceDpp);
    expect(creditPpn?.credit).toBe(PRJ_001.invoiceVat);
    expect(built.draft.source).toBe("INVOICE_PENJUALAN");
  });

  it("menolak invoice tanpa pelanggan", () => {
    expect(() =>
      buildSalesInvoiceEntry({
        entryDate: "2026-01-15",
        customerId: "",
        piutangAccountId: "piutang",
        ppnKeluaranAccountId: "ppn",
        taxCodeId: null,
        taxTreatment: "NON_PPN",
        vatRate: 0n,
        discount: 0n,
        items: [
          {
            accountId: "pendapatan",
            projectId: "p",
            amount: 100n,
            description: null,
          },
        ],
      }),
    ).toThrow(/wajib punya pelanggan/);
  });
});

describe("buildReceivePaymentEntry T2", () => {
  it("kas 218 juta, PPh 4 juta, kredit piutang 222 juta", () => {
    const draft = buildReceivePaymentEntry({
      entryDate: "2026-02-01",
      customerId: "cust",
      cashAccountId: "bank",
      piutangAccountId: "piutang",
      prepaidTaxAccountId: "prepaid",
      allocated: PRJ_001.invoiceTotal,
      arBuckets: [
        { projectId: "prj-001", amount: PRJ_001.invoiceDpp },
        { projectId: null, amount: PRJ_001.invoiceVat },
      ],
      withholding: {
        amount: PRJ_001.pph42,
        projectId: "prj-001",
        taxCodeId: "pph",
      },
    });

    expect(draft.source).toBe("TERIMA_PEMBAYARAN");
    expect(
      draft.lines.find((line) => line.accountId === "bank")?.debit,
    ).toBe(PRJ_001.cashReceived);
    expect(
      draft.lines.find((line) => line.accountId === "prepaid")?.debit,
    ).toBe(PRJ_001.pph42);
    expect(
      draft.lines.find(
        (line) => line.accountId === "piutang" && line.projectId === "prj-001",
      )?.credit,
    ).toBe(PRJ_001.invoiceDpp);
    expect(
      draft.lines.find(
        (line) => line.accountId === "piutang" && line.projectId === null,
      )?.credit,
    ).toBe(PRJ_001.invoiceVat);
  });

  it("menolak pelunasan melebihi sisa piutang", () => {
    expect(() =>
      buildReceivePaymentEntry({
        entryDate: "2026-02-01",
        customerId: "cust",
        cashAccountId: "bank",
        piutangAccountId: "piutang",
        prepaidTaxAccountId: "prepaid",
        allocated: PRJ_001.invoiceTotal + 1n,
        arBuckets: [{ projectId: "prj-001", amount: PRJ_001.invoiceTotal }],
        withholding: null,
      }),
    ).toThrow(AccountingError);
    expect(() =>
      buildReceivePaymentEntry({
        entryDate: "2026-02-01",
        customerId: "cust",
        cashAccountId: "bank",
        piutangAccountId: "piutang",
        prepaidTaxAccountId: "prepaid",
        allocated: PRJ_001.invoiceTotal + 1n,
        arBuckets: [{ projectId: "prj-001", amount: PRJ_001.invoiceTotal }],
        withholding: null,
      }),
    ).toThrow(/melebihi sisa piutang/);
  });
});

describe("formatDocumentNo", () => {
  it("memakai format 007/INV-MMS/09/2026", () => {
    expect(
      formatDocumentNo({
        seq: 7,
        prefix: "INV",
        companyCode: "MMS",
        month: 9,
        year: 2026,
      }),
    ).toBe("007/INV-MMS/09/2026");
  });
});
