import { describe, expect, it } from "vitest";
import {
  formatRupiah,
  fromDbNumeric,
  fromRupiah,
  parseMoneyField,
  toDbNumeric,
} from "@/lib/accounting/money";

describe("money", () => {
  it("mengonversi rupiah ke sen tanpa float", () => {
    expect(fromRupiah("1.250.000")).toBe(125000000n);
    expect(fromRupiah("1.250.000,50")).toBe(125000050n);
    expect(toDbNumeric(125000050n)).toBe("1250000.50");
    expect(fromDbNumeric("1250000.50")).toBe(125000050n);
  });

  it("memformat nol dan negatif sesuai design system", () => {
    expect(formatRupiah(0n)).toBe("-");
    expect(formatRupiah(-125000000n)).toBe("(1.250.000)");
  });

  it("menolak nilai uang yang tidak bisa dibaca", () => {
    expect(() => fromRupiah("abc")).toThrow(/tidak bisa dibaca/);
  });

  it("membaca medan kosong sebagai nol", () => {
    expect(parseMoneyField("")).toBe(0n);
    expect(parseMoneyField("-")).toBe(0n);
  });
});
