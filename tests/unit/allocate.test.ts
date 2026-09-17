import { describe, expect, it } from "vitest";
import { allocateByWeights } from "@/lib/accounting/allocate";
import { AccountingError } from "@/lib/accounting/errors";

describe("allocateByWeights", () => {
  it("membagi sisa ke indeks dengan sisa terbesar, seri ke indeks lebih kecil", () => {
    // 100 sen, tiga bobot sama: 100/3 = 33 sisa 1, sisa identik jadi +1 ke indeks 0.
    expect(allocateByWeights(100n, [1n, 1n, 1n])).toEqual([34n, 33n, 33n]);
  });

  it("mengembalikan pecahan yang jumlahnya tepat sama dengan total", () => {
    const parts = allocateByWeights(10n, [3n, 3n, 4n]);
    expect(parts).toEqual([3n, 3n, 4n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(10n);
  });

  it("menolak bobot nol seluruhnya", () => {
    expect(() => allocateByWeights(100n, [0n, 0n])).toThrow(AccountingError);
  });
});
