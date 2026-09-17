import { describe, expect, it } from "vitest";
import { fromRupiah } from "@/lib/accounting/money";
import { buildGeneralEntry } from "@/lib/accounting/posting/build-general";
import { buildReversalEntry } from "@/lib/accounting/posting/build-reversal";
import { formatEntryNo } from "@/lib/accounting/posting/types";

describe("buildGeneralEntry", () => {
  it("membuang baris nol dan membentuk jurnal umum", () => {
    const draft = buildGeneralEntry({
      entryDate: "2026-09-18",
      memo: "Setoran modal",
      lines: [
        {
          accountId: "kas",
          debit: fromRupiah("1.000.000"),
          credit: 0n,
        },
        {
          accountId: "modal",
          debit: 0n,
          credit: fromRupiah("1.000.000"),
        },
        { accountId: "kosong", debit: 0n, credit: 0n },
      ],
    });
    expect(draft.source).toBe("JURNAL_UMUM");
    expect(draft.lines).toHaveLength(2);
  });
});

describe("buildReversalEntry", () => {
  it("membalik debit dan kredit setiap baris", () => {
    const reversal = buildReversalEntry({
      entryDate: "2026-09-19",
      memo: "Pembalikan JU-2026-0001",
      lines: [
        {
          accountId: "kas",
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: 100n,
          credit: 0n,
          description: "kas",
        },
        {
          accountId: "modal",
          projectId: null,
          contactId: null,
          taxCodeId: null,
          debit: 0n,
          credit: 100n,
          description: "modal",
        },
      ],
    });
    expect(reversal.source).toBe("JURNAL_PEMBALIK");
    expect(reversal.lines[0]?.debit).toBe(0n);
    expect(reversal.lines[0]?.credit).toBe(100n);
    expect(reversal.lines[1]?.debit).toBe(100n);
    expect(reversal.lines[1]?.credit).toBe(0n);
  });
});

describe("formatEntryNo", () => {
  it("memakai format PREFIX-YYYY-####", () => {
    expect(formatEntryNo("JU", 2026, 1)).toBe("JU-2026-0001");
    expect(formatEntryNo("KM", 2026, 42)).toBe("KM-2026-0042");
  });
});
