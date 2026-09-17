import { describe, expect, it } from "vitest";
import { formatDocumentNo } from "@/lib/accounting/posting/document-no";

describe("formatDocumentNo", () => {
  it("membentuk nomor dokumen formal", () => {
    expect(
      formatDocumentNo({
        seq: 1,
        prefix: "QT",
        companyCode: "MMS",
        month: 9,
        year: 2026,
      }),
    ).toBe("001/QT-MMS/09/2026");
    expect(
      formatDocumentNo({
        seq: 42,
        prefix: "INV",
        companyCode: "KRY",
        month: 12,
        year: 2027,
      }),
    ).toBe("042/INV-KRY/12/2027");
  });
});
