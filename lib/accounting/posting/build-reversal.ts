import type { DraftEntry, DraftLine } from "./types";

export function buildReversalEntry(input: {
  entryDate: string;
  memo?: string | null;
  lines: DraftLine[];
}): DraftEntry {
  return {
    entryDate: input.entryDate,
    source: "JURNAL_PEMBALIK",
    memo: input.memo?.trim() || null,
    lines: input.lines.map((line) => ({
      accountId: line.accountId,
      projectId: line.projectId,
      contactId: line.contactId,
      taxCodeId: line.taxCodeId,
      debit: line.credit,
      credit: line.debit,
      description: line.description,
    })),
  };
}
