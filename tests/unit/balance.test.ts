import { describe, expect, it } from "vitest";
import { fromRupiah } from "@/lib/accounting/money";
import {
  isBalanced,
  lineSignedAmount,
  normalBalanceForGroup,
  sumCredit,
  sumDebit,
} from "@/lib/accounting/balance";

describe("balance", () => {
  it("menandai golongan aset bersaldo normal debit dan pendapatan kredit", () => {
    expect(normalBalanceForGroup("ASET")).toBe("DEBIT");
    expect(normalBalanceForGroup("PENDAPATAN")).toBe("KREDIT");
    expect(normalBalanceForGroup("BEBAN_POKOK_PROJECT")).toBe("DEBIT");
  });

  it("menghitung saldo bertanda sesuai saldo normal", () => {
    expect(lineSignedAmount("DEBIT", fromRupiah("80.000.000"), 0n)).toBe(
      fromRupiah("80.000.000"),
    );
    expect(lineSignedAmount("KREDIT", 0n, fromRupiah("200.000.000"))).toBe(
      fromRupiah("200.000.000"),
    );
  });

  it("mengenali jurnal seimbang", () => {
    const lines = [
      { debit: 100n, credit: 0n },
      { debit: 0n, credit: 100n },
    ];
    expect(sumDebit(lines)).toBe(100n);
    expect(sumCredit(lines)).toBe(100n);
    expect(isBalanced(lines)).toBe(true);
  });
});
