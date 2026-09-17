import type { Money } from "../money";
import { AccountingError } from "../errors";
import { allocateByWeights } from "../allocate";
import { splitVat, type RateScaled, type TaxTreatment } from "../tax";
import type { DraftEntry, DraftLine } from "./types";

export type InvoiceItemInput = {
  accountId: string;
  projectId: string | null;
  amount: Money;
  description: string | null;
};

export type SalesInvoicePostingInput = {
  entryDate: string;
  memo?: string | null;
  customerId: string;
  piutangAccountId: string;
  ppnKeluaranAccountId: string;
  piutangRetensiAccountId?: string | null;
  taxCodeId: string | null;
  taxTreatment: TaxTreatment;
  vatRate: RateScaled;
  items: InvoiceItemInput[];
  discount: Money;
  retentionAmount?: Money;
};

export type BuiltInvoice = {
  draft: DraftEntry;
  dpp: Money;
  vat: Money;
  total: Money;
  subtotal: Money;
  retention: Money;
};

function groupAmounts(
  items: InvoiceItemInput[],
): Array<{ projectId: string | null; amount: Money; accountId: string; description: string | null }> {
  return items.filter((item) => item.amount > 0n);
}

export function buildSalesInvoiceEntry(
  input: SalesInvoicePostingInput,
): BuiltInvoice {
  if (!input.customerId) {
    throw new AccountingError(
      "Invoice wajib punya pelanggan. Pilih kontak pelanggan dulu.",
    );
  }
  const items = groupAmounts(input.items);
  if (items.length === 0) {
    throw new AccountingError("Invoice wajib punya minimal satu item bernilai.");
  }
  if (input.discount < 0n) {
    throw new AccountingError("Diskon tidak boleh negatif.");
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0n);
  if (input.discount > subtotal) {
    throw new AccountingError(
      "Diskon tidak boleh melebihi subtotal invoice.",
    );
  }

  const net = subtotal - input.discount;
  const split = splitVat({
    amount: net,
    rate: input.vatRate,
    treatment: input.taxTreatment,
  });

  const weights = items.map((item) => item.amount);
  const dppParts = allocateByWeights(split.dpp, weights);

  const revenueLines: DraftLine[] = items.map((item, index) => ({
    accountId: item.accountId,
    projectId: item.projectId,
    contactId: input.customerId,
    taxCodeId: null,
    debit: 0n,
    credit: dppParts[index] ?? 0n,
    description: item.description,
  })).filter((line) => line.credit > 0n);

  const dppByProject = new Map<string, Money>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const dpp = dppParts[i] ?? 0n;
    if (!item || dpp === 0n) continue;
    const key = item.projectId ?? "";
    dppByProject.set(key, (dppByProject.get(key) ?? 0n) + dpp);
  }

  const arLines: DraftLine[] = [];
  for (const [key, amount] of dppByProject) {
    arLines.push({
      accountId: input.piutangAccountId,
      projectId: key === "" ? null : key,
      contactId: input.customerId,
      taxCodeId: null,
      debit: amount,
      credit: 0n,
      description: "Piutang usaha",
    });
  }
  if (split.vat > 0n) {
    arLines.push({
      accountId: input.piutangAccountId,
      projectId: null,
      contactId: input.customerId,
      taxCodeId: input.taxCodeId,
      debit: split.vat,
      credit: 0n,
      description: "Piutang PPN",
    });
  }

  const retention = input.retentionAmount ?? 0n;
  if (retention < 0n) {
    throw new AccountingError("Nilai retensi tidak boleh negatif.");
  }
  if (retention > split.dpp) {
    throw new AccountingError(
      "Retensi tidak boleh melebihi DPP invoice. Kurangi nilai retensi.",
    );
  }

  const retentionLines: DraftLine[] = [];
  if (retention > 0n) {
    if (!input.piutangRetensiAccountId) {
      throw new AccountingError(
        "Akun Piutang Retensi belum dipetakan. Lengkapi Chart of Account dulu.",
      );
    }
    const projectBuckets = [...dppByProject.entries()].filter(
      ([, amount]) => amount > 0n,
    );
    const weights = projectBuckets.map(([, amount]) => amount);
    const parts = allocateByWeights(retention, weights);
    for (let i = 0; i < projectBuckets.length; i++) {
      const bucket = projectBuckets[i];
      const part = parts[i] ?? 0n;
      if (!bucket || part === 0n) continue;
      const [key] = bucket;
      const ar = arLines.find(
        (line) =>
          line.accountId === input.piutangAccountId &&
          line.projectId === (key === "" ? null : key) &&
          line.description === "Piutang usaha",
      );
      if (!ar || ar.debit < part) {
        throw new AccountingError(
          "Retensi tidak bisa dialokasikan ke baris piutang. Periksa nilai item.",
        );
      }
      ar.debit -= part;
      retentionLines.push({
        accountId: input.piutangRetensiAccountId,
        projectId: key === "" ? null : key,
        contactId: input.customerId,
        taxCodeId: null,
        debit: part,
        credit: 0n,
        description: "Piutang retensi",
      });
    }
    // Hapus baris piutang usaha yang jadi nol setelah retensi.
    for (let i = arLines.length - 1; i >= 0; i--) {
      const line = arLines[i];
      if (line && line.description === "Piutang usaha" && line.debit === 0n) {
        arLines.splice(i, 1);
      }
    }
  }

  const vatLine: DraftLine[] =
    split.vat > 0n
      ? [
          {
            accountId: input.ppnKeluaranAccountId,
            projectId: null,
            contactId: input.customerId,
            taxCodeId: input.taxCodeId,
            debit: 0n,
            credit: split.vat,
            description: "Utang PPN Keluaran",
          },
        ]
      : [];

  return {
    draft: {
      entryDate: input.entryDate,
      source: "INVOICE_PENJUALAN",
      memo: input.memo?.trim() || null,
      lines: [...arLines, ...retentionLines, ...revenueLines, ...vatLine],
    },
    dpp: split.dpp,
    vat: split.vat,
    total: split.total,
    subtotal,
    retention,
  };
}
