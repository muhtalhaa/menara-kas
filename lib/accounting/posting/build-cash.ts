import type { Money } from "../money";
import { AccountingError } from "../errors";
import type { DraftEntry, DraftLine } from "./types";

export type CashLineInput = {
  accountId: string;
  projectId?: string | null;
  contactId?: string | null;
  amount: Money;
  description?: string | null;
};

export type CashEntryInput = {
  entryDate: string;
  memo?: string | null;
  cashAccountId: string;
  contactId?: string | null;
  lines: CashLineInput[];
};

function detailLines(
  input: CashEntryInput,
  side: "debit" | "credit",
): { details: DraftLine[]; total: Money } {
  const details: DraftLine[] = [];
  let total = 0n;
  for (const line of input.lines) {
    if (line.amount <= 0n) continue;
    if (!line.accountId) {
      throw new AccountingError("Setiap baris kas wajib punya akun.");
    }
    total += line.amount;
    details.push({
      accountId: line.accountId,
      projectId: line.projectId ?? null,
      contactId: line.contactId ?? input.contactId ?? null,
      taxCodeId: null,
      debit: side === "debit" ? line.amount : 0n,
      credit: side === "credit" ? line.amount : 0n,
      description: line.description?.trim() || null,
    });
  }
  if (details.length === 0) {
    throw new AccountingError(
      "Isi minimal satu baris bernilai. Tambah akun dan nominal dulu.",
    );
  }
  return { details, total };
}

function cashLine(
  input: CashEntryInput,
  total: Money,
  side: "debit" | "credit",
): DraftLine {
  if (!input.cashAccountId) {
    throw new AccountingError("Pilih akun kas atau bank.");
  }
  return {
    accountId: input.cashAccountId,
    projectId: null,
    contactId: input.contactId ?? null,
    taxCodeId: null,
    debit: side === "debit" ? total : 0n,
    credit: side === "credit" ? total : 0n,
    description: input.memo?.trim() || null,
  };
}

export function buildCashOutEntry(input: CashEntryInput): DraftEntry {
  const { details, total } = detailLines(input, "debit");
  return {
    entryDate: input.entryDate,
    source: "KAS_KELUAR",
    memo: input.memo?.trim() || null,
    lines: [...details, cashLine(input, total, "credit")],
  };
}

export function buildCashInEntry(input: CashEntryInput): DraftEntry {
  const { details, total } = detailLines(input, "credit");
  return {
    entryDate: input.entryDate,
    source: "KAS_MASUK",
    memo: input.memo?.trim() || null,
    lines: [cashLine(input, total, "debit"), ...details],
  };
}

export function buildCashTransferEntry(input: {
  entryDate: string;
  memo?: string | null;
  sourceCashAccountId: string;
  destCashAccountId: string;
  amount: Money;
}): DraftEntry {
  if (!input.sourceCashAccountId || !input.destCashAccountId) {
    throw new AccountingError("Pilih kas/bank sumber dan tujuan.");
  }
  if (input.sourceCashAccountId === input.destCashAccountId) {
    throw new AccountingError(
      "Sumber dan tujuan transfer tidak boleh akun yang sama. Pilih rekening lain.",
    );
  }
  if (input.amount <= 0n) {
    throw new AccountingError("Nilai transfer harus lebih dari nol.");
  }
  return {
    entryDate: input.entryDate,
    source: "TRANSFER_KAS",
    memo: input.memo?.trim() || null,
    lines: [
      {
        accountId: input.destCashAccountId,
        projectId: null,
        contactId: null,
        taxCodeId: null,
        debit: input.amount,
        credit: 0n,
        description: input.memo?.trim() || null,
      },
      {
        accountId: input.sourceCashAccountId,
        projectId: null,
        contactId: null,
        taxCodeId: null,
        debit: 0n,
        credit: input.amount,
        description: input.memo?.trim() || null,
      },
    ],
  };
}
