import { describe, expect, it } from "vitest";
import { fromRupiah } from "@/lib/accounting/money";
import {
  buildCashInEntry,
  buildCashOutEntry,
  buildCashTransferEntry,
} from "@/lib/accounting/posting/build-cash";
import { PRJ_001 } from "@/tests/fixtures/prj-001";

describe("buildCashOutEntry", () => {
  it("membentuk kredit kas dan debit beban, termasuk pecahan project", () => {
    const draft = buildCashOutEntry({
      entryDate: "2026-09-18",
      memo: "Pembelian material",
      cashAccountId: "bank",
      lines: [
        {
          accountId: "mat",
          projectId: "p1",
          amount: fromRupiah("30.000.000"),
        },
        {
          accountId: "mat",
          projectId: "p2",
          amount: fromRupiah("20.000.000"),
        },
      ],
    });
    expect(draft.source).toBe("KAS_KELUAR");
    expect(draft.lines).toHaveLength(3);
    expect(draft.lines[0]?.debit).toBe(fromRupiah("30.000.000"));
    expect(draft.lines[1]?.debit).toBe(fromRupiah("20.000.000"));
    expect(draft.lines[2]?.accountId).toBe("bank");
    expect(draft.lines[2]?.credit).toBe(fromRupiah("50.000.000"));
    expect(draft.lines[2]?.projectId).toBeNull();
  });
});

describe("buildCashInEntry", () => {
  it("membentuk debit kas dan kredit akun lawan", () => {
    const draft = buildCashInEntry({
      entryDate: "2026-09-18",
      cashAccountId: "bank",
      lines: [
        {
          accountId: "pendapatan",
          projectId: "p1",
          amount: PRJ_001.invoiceDpp,
        },
      ],
    });
    expect(draft.source).toBe("KAS_MASUK");
    expect(draft.lines[0]?.debit).toBe(PRJ_001.invoiceDpp);
    expect(draft.lines[1]?.credit).toBe(PRJ_001.invoiceDpp);
  });
});

describe("buildCashTransferEntry", () => {
  it("memindahkan kas dari sumber ke tujuan", () => {
    const draft = buildCashTransferEntry({
      entryDate: "2026-09-18",
      sourceCashAccountId: "kas",
      destCashAccountId: "bank",
      amount: fromRupiah("1.000.000"),
    });
    expect(draft.source).toBe("TRANSFER_KAS");
    expect(draft.lines[0]?.accountId).toBe("bank");
    expect(draft.lines[0]?.debit).toBe(fromRupiah("1.000.000"));
    expect(draft.lines[1]?.accountId).toBe("kas");
    expect(draft.lines[1]?.credit).toBe(fromRupiah("1.000.000"));
  });

  it("menolak sumber dan tujuan yang sama", () => {
    expect(() =>
      buildCashTransferEntry({
        entryDate: "2026-09-18",
        sourceCashAccountId: "kas",
        destCashAccountId: "kas",
        amount: 100n,
      }),
    ).toThrow(/tidak boleh akun yang sama/);
  });
});
