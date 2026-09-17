import { describe, expect, it } from "vitest";
import { fromRupiah } from "@/lib/accounting/money";
import { AccountingError } from "@/lib/accounting/errors";
import type { AccountSnapshot, DraftEntry } from "@/lib/accounting/posting/types";
import {
  assertAccountsPostable,
  assertRequiredProjects,
  validateDraftEntry,
} from "@/lib/accounting/posting/validate";

const kas: AccountSnapshot = {
  id: "kas",
  accountNo: "1-1100",
  name: "Kas",
  group: "ASET",
  isPostable: true,
  isActive: true,
  isCash: true,
};

const material: AccountSnapshot = {
  id: "mat",
  accountNo: "5-1100",
  name: "Biaya Material",
  group: "BEBAN_POKOK_PROJECT",
  isPostable: true,
  isActive: true,
  isCash: false,
};

const induk: AccountSnapshot = {
  id: "induk",
  accountNo: "1-1000",
  name: "Aset Lancar",
  group: "ASET",
  isPostable: false,
  isActive: true,
  isCash: false,
};

function entry(lines: DraftEntry["lines"]): DraftEntry {
  return {
    entryDate: "2026-09-18",
    source: "JURNAL_UMUM",
    memo: "tes",
    lines,
  };
}

describe("validateDraftEntry", () => {
  it("I1 menolak jurnal tidak seimbang dan menyebut selisih", () => {
    expect(() =>
      validateDraftEntry(
        entry([
          {
            accountId: "kas",
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: fromRupiah("500.000"),
            credit: 0n,
            description: null,
          },
          {
            accountId: "mat",
            projectId: "p1",
            contactId: null,
            taxCodeId: null,
            debit: 0n,
            credit: fromRupiah("250.000"),
            description: null,
          },
        ]),
      ),
    ).toThrow(/Selisih 250\.000 di sisi debit/);
  });

  it("I2 menolak baris yang berisi debit dan kredit", () => {
    expect(() =>
      validateDraftEntry(
        entry([
          {
            accountId: "kas",
            projectId: null,
            contactId: null,
            taxCodeId: null,
            debit: 100n,
            credit: 100n,
            description: null,
          },
          {
            accountId: "mat",
            projectId: "p1",
            contactId: null,
            taxCodeId: null,
            debit: 0n,
            credit: 200n,
            description: null,
          },
        ]),
      ),
    ).toThrow(/Baris 1: satu baris hanya boleh debit atau kredit/);
  });

  it("I5 menolak akun induk", () => {
    const draft = entry([
      {
        accountId: "induk",
        projectId: null,
        contactId: null,
        taxCodeId: null,
        debit: 100n,
        credit: 0n,
        description: null,
      },
      {
        accountId: "kas",
        projectId: null,
        contactId: null,
        taxCodeId: null,
        debit: 0n,
        credit: 100n,
        description: null,
      },
    ]);
    expect(() =>
      assertAccountsPostable(draft, new Map([["induk", induk], ["kas", kas]])),
    ).toThrow(/1-1000 Aset Lancar adalah akun induk/);
  });

  it("I6 menolak pendapatan/beban pokok tanpa project", () => {
    const draft = entry([
      {
        accountId: "mat",
        projectId: null,
        contactId: null,
        taxCodeId: null,
        debit: fromRupiah("80.000.000"),
        credit: 0n,
        description: null,
      },
      {
        accountId: "kas",
        projectId: null,
        contactId: null,
        taxCodeId: null,
        debit: 0n,
        credit: fromRupiah("80.000.000"),
        description: null,
      },
    ]);
    expect(() =>
      assertRequiredProjects(
        draft,
        new Map([["mat", material], ["kas", kas]]),
        { requireProjectGroups: ["PENDAPATAN", "BEBAN_POKOK_PROJECT"] },
      ),
    ).toThrow(AccountingError);
    expect(() =>
      assertRequiredProjects(
        draft,
        new Map([["mat", material], ["kas", kas]]),
        { requireProjectGroups: ["PENDAPATAN", "BEBAN_POKOK_PROJECT"] },
      ),
    ).toThrow(/Baris 1: akun 5-1100 Biaya Material wajib punya project/);
  });
});
