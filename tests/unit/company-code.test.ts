import { describe, expect, it } from "vitest";
import { COMPANY_CODE_PATTERN } from "@/lib/server/types";

describe("company_code", () => {
  it("menerima kode 2–6 huruf kapital atau angka", () => {
    expect(COMPANY_CODE_PATTERN.test("MMS")).toBe(true);
    expect(COMPANY_CODE_PATTERN.test("KRY01")).toBe(true);
  });

  it("menolak kode tidak valid", () => {
    expect(COMPANY_CODE_PATTERN.test("m")).toBe(false);
    expect(COMPANY_CODE_PATTERN.test("too-long")).toBe(false);
    expect(COMPANY_CODE_PATTERN.test("abc")).toBe(false);
  });
});
