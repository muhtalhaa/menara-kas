import type { Money } from "../money";
import type { DraftEntry, DraftLine, EntrySource } from "./types";

export type GeneralJournalLineInput = {
  accountId: string;
  projectId?: string | null;
  contactId?: string | null;
  taxCodeId?: string | null;
  debit: Money;
  credit: Money;
  description?: string | null;
};

export type GeneralJournalInput = {
  entryDate: string;
  memo?: string | null;
  source?: Extract<EntrySource, "JURNAL_UMUM" | "JURNAL_PENYESUAIAN">;
  lines: GeneralJournalLineInput[];
};

function toDraftLine(line: GeneralJournalLineInput): DraftLine {
  return {
    accountId: line.accountId,
    projectId: line.projectId ?? null,
    contactId: line.contactId ?? null,
    taxCodeId: line.taxCodeId ?? null,
    debit: line.debit,
    credit: line.credit,
    description: line.description?.trim() || null,
  };
}

export function buildGeneralEntry(input: GeneralJournalInput): DraftEntry {
  const lines = input.lines
    .filter((line) => line.debit > 0n || line.credit > 0n)
    .map(toDraftLine);

  return {
    entryDate: input.entryDate,
    source: input.source ?? "JURNAL_UMUM",
    memo: input.memo?.trim() || null,
    lines,
  };
}
