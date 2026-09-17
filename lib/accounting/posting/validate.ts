import { formatRupiah } from "../money";
import { AccountingError } from "../errors";
import { sumCredit, sumDebit } from "../balance";
import type { AccountSnapshot, DraftEntry, PostingRules } from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateDraftEntry(draft: DraftEntry): void {
  if (!DATE_PATTERN.test(draft.entryDate)) {
    throw new AccountingError(
      "Tanggal jurnal tidak valid. Gunakan format tahun-bulan-tanggal.",
      { entryDate: "Tanggal tidak valid." },
    );
  }

  if (draft.lines.length < 2) {
    throw new AccountingError(
      "Jurnal minimal punya dua baris bernilai. Tambah baris debit dan kredit.",
    );
  }

  draft.lines.forEach((line, index) => {
    const n = index + 1;
    if (!line.accountId) {
      throw new AccountingError(`Baris ${n}: pilih akun.`, {
        [`lines.${index}.accountId`]: "Pilih akun.",
      });
    }
    if (line.debit < 0n || line.credit < 0n) {
      throw new AccountingError(`Baris ${n}: nilai tidak boleh negatif.`);
    }
    if (line.debit > 0n && line.credit > 0n) {
      throw new AccountingError(
        `Baris ${n}: satu baris hanya boleh debit atau kredit, tidak keduanya.`,
      );
    }
    if (line.debit === 0n && line.credit === 0n) {
      throw new AccountingError(`Baris ${n}: isi debit atau kredit.`);
    }
  });

  const debit = sumDebit(draft.lines);
  const credit = sumCredit(draft.lines);
  if (debit !== credit) {
    const diff = debit > credit ? debit - credit : credit - debit;
    const side = debit > credit ? "debit" : "kredit";
    throw new AccountingError(
      `Jurnal belum seimbang. Selisih ${formatRupiah(diff)} di sisi ${side}.`,
    );
  }
}

export function assertAccountsPostable(
  draft: DraftEntry,
  accounts: Map<string, AccountSnapshot>,
): void {
  draft.lines.forEach((line, index) => {
    const n = index + 1;
    const account = accounts.get(line.accountId);
    if (!account) {
      throw new AccountingError(
        `Baris ${n}: akun tidak ditemukan di Chart of Account perusahaan ini.`,
      );
    }
    if (!account.isPostable) {
      throw new AccountingError(
        `Baris ${n}: akun ${account.accountNo} ${account.name} adalah akun induk dan tidak bisa dipilih di jurnal. Pilih akun tingkat terakhir.`,
      );
    }
    if (!account.isActive) {
      throw new AccountingError(
        `Baris ${n}: akun ${account.accountNo} ${account.name} tidak aktif. Pilih akun lain yang masih dipakai.`,
      );
    }
  });
}

export function assertRequiredProjects(
  draft: DraftEntry,
  accounts: Map<string, AccountSnapshot>,
  rules: PostingRules,
): void {
  draft.lines.forEach((line, index) => {
    const account = accounts.get(line.accountId);
    if (!account) return;
    if (!rules.requireProjectGroups.includes(account.group)) return;
    if (line.projectId) return;
    const n = index + 1;
    throw new AccountingError(
      `Baris ${n}: akun ${account.accountNo} ${account.name} wajib punya project.`,
    );
  });
}

export function assertCashSource(
  draft: DraftEntry,
  accounts: Map<string, AccountSnapshot>,
): void {
  if (
    draft.source !== "KAS_MASUK" &&
    draft.source !== "KAS_KELUAR" &&
    draft.source !== "TRANSFER_KAS"
  ) {
    return;
  }

  const cashCount = draft.lines.filter(
    (line) => accounts.get(line.accountId)?.isCash,
  ).length;

  if (draft.source === "TRANSFER_KAS") {
    if (cashCount !== 2) {
      throw new AccountingError(
        "Transfer kas hanya boleh antara dua akun kas atau bank. Pilih rekening sumber dan tujuan yang bertanda kas.",
      );
    }
    return;
  }

  if (cashCount < 1) {
    throw new AccountingError(
      "Pilih akun kas atau bank. Akun itu yang mencatat uang yang benar-benar bergerak.",
    );
  }
}
