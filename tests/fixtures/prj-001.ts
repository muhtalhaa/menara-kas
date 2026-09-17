import { fromRupiah, type Money } from "@/lib/accounting/money";

/** Angka dihitung tangan dari docs/data-model.md bagian 6.4. */
export const PRJ_001 = {
  invoiceDpp: fromRupiah("200.000.000"),
  invoiceVat: fromRupiah("22.000.000"),
  invoiceTotal: fromRupiah("222.000.000"),
  pph42: fromRupiah("4.000.000"),
  cashReceived: fromRupiah("218.000.000"),
  material: fromRupiah("80.000.000"),
  wages: fromRupiah("45.000.000"),
  rent: fromRupiah("15.000.000"),
  projectGrossProfit: fromRupiah("75.000.000"),
  projectCashNet: fromRupiah("71.000.000"),
  untaggedCashNet: fromRupiah("7.000.000"),
  bankNet: fromRupiah("78.000.000"),
  vatRate: "11",
  pph42Rate: "2",
} as const satisfies Record<string, Money | string>;
