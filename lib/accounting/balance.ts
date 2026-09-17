import type { Money } from "./money";

export type AccountGroup =
  | "ASET"
  | "LIABILITAS"
  | "EKUITAS"
  | "PENDAPATAN"
  | "BEBAN_POKOK_PROJECT"
  | "BEBAN_OPERASIONAL"
  | "LAIN_LAIN";

export type NormalBalance = "DEBIT" | "KREDIT";

export function normalBalanceForGroup(group: AccountGroup): NormalBalance {
  if (
    group === "ASET" ||
    group === "BEBAN_POKOK_PROJECT" ||
    group === "BEBAN_OPERASIONAL"
  ) {
    return "DEBIT";
  }
  if (
    group === "LIABILITAS" ||
    group === "EKUITAS" ||
    group === "PENDAPATAN"
  ) {
    return "KREDIT";
  }
  return "DEBIT";
}

export function lineSignedAmount(
  normalBalance: NormalBalance,
  debit: Money,
  credit: Money,
): Money {
  if (normalBalance === "DEBIT") return debit - credit;
  return credit - debit;
}

export function sumDebit(lines: Array<{ debit: Money }>): Money {
  return lines.reduce((total, line) => total + line.debit, 0n);
}

export function sumCredit(lines: Array<{ credit: Money }>): Money {
  return lines.reduce((total, line) => total + line.credit, 0n);
}

export function isBalanced(
  lines: Array<{ debit: Money; credit: Money }>,
): boolean {
  return sumDebit(lines) === sumCredit(lines);
}
