import type { Money } from "../money";
import { AccountingError } from "../errors";
import { allocateByWeights } from "../allocate";
import { splitVat, type RateScaled, type TaxTreatment } from "../tax";
import type { DraftEntry, DraftLine } from "./types";

export type BillItemInput = {
  accountId: string;
  projectId: string | null;
  amount: Money;
  description: string | null;
};

export type PurchaseBillPostingInput = {
  entryDate: string;
  memo?: string | null;
  vendorId: string;
  utangAccountId: string;
  ppnMasukanAccountId: string;
  taxCodeId: string | null;
  taxTreatment: TaxTreatment;
  vatRate: RateScaled;
  items: BillItemInput[];
  discount: Money;
};

export type BuiltBill = {
  draft: DraftEntry;
  dpp: Money;
  vat: Money;
  total: Money;
  subtotal: Money;
};

export function buildPurchaseBillEntry(
  input: PurchaseBillPostingInput,
): BuiltBill {
  if (!input.vendorId) {
    throw new AccountingError(
      "Tagihan pembelian wajib punya vendor. Pilih kontak vendor dulu.",
    );
  }
  const items = input.items.filter((item) => item.amount > 0n);
  if (items.length === 0) {
    throw new AccountingError("Tagihan wajib punya minimal satu item bernilai.");
  }
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0n);
  if (input.discount > subtotal) {
    throw new AccountingError("Diskon tidak boleh melebihi subtotal tagihan.");
  }

  const net = subtotal - input.discount;
  const split = splitVat({
    amount: net,
    rate: input.vatRate,
    treatment: input.taxTreatment,
  });
  const weights = items.map((item) => item.amount);
  const dppParts = allocateByWeights(split.dpp, weights);

  const expenseLines: DraftLine[] = items.map((item, index) => ({
    accountId: item.accountId,
    projectId: item.projectId,
    contactId: input.vendorId,
    taxCodeId: null,
    debit: dppParts[index] ?? 0n,
    credit: 0n,
    description: item.description,
  })).filter((line) => line.debit > 0n);

  const dppByProject = new Map<string, Money>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const dpp = dppParts[i] ?? 0n;
    if (!item || dpp === 0n) continue;
    const key = item.projectId ?? "";
    dppByProject.set(key, (dppByProject.get(key) ?? 0n) + dpp);
  }

  const apLines: DraftLine[] = [];
  for (const [key, amount] of dppByProject) {
    apLines.push({
      accountId: input.utangAccountId,
      projectId: key === "" ? null : key,
      contactId: input.vendorId,
      taxCodeId: null,
      debit: 0n,
      credit: amount,
      description: "Utang usaha",
    });
  }
  if (split.vat > 0n) {
    apLines.push({
      accountId: input.utangAccountId,
      projectId: null,
      contactId: input.vendorId,
      taxCodeId: input.taxCodeId,
      debit: 0n,
      credit: split.vat,
      description: "Utang PPN",
    });
  }

  const vatLine: DraftLine[] =
    split.vat > 0n
      ? [
          {
            accountId: input.ppnMasukanAccountId,
            projectId: null,
            contactId: input.vendorId,
            taxCodeId: input.taxCodeId,
            debit: split.vat,
            credit: 0n,
            description: "PPN Masukan",
          },
        ]
      : [];

  return {
    draft: {
      entryDate: input.entryDate,
      source: "TAGIHAN_PEMBELIAN",
      memo: input.memo?.trim() || null,
      lines: [...expenseLines, ...vatLine, ...apLines],
    },
    dpp: split.dpp,
    vat: split.vat,
    total: split.total,
    subtotal,
  };
}
