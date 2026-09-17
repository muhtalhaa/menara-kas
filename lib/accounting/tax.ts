import type { Money } from "./money";
import { AccountingError } from "./errors";

export type TaxTreatment = "TERMASUK_PPN" | "BELUM_TERMASUK_PPN" | "NON_PPN";

/** Tarif persen dikali 1000. 11% = 11000n, 2,5% = 2500n. */
export type RateScaled = bigint;

const RATE_SCALE = 1000n;
const PERCENT = 100n;

export function rateFromNumeric(raw: string): RateScaled {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    throw new AccountingError(
      `Tarif pajak "${raw}" tidak bisa dibaca. Gunakan angka seperti 11 atau 2,5.`,
    );
  }
  const [whole, frac = ""] = trimmed.split(".");
  const millis = (frac + "000").slice(0, 3);
  return BigInt(whole) * RATE_SCALE + BigInt(millis);
}

function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new AccountingError("Pembagi tarif pajak tidak valid.");
  }
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const q = abs / denominator;
  const r = abs % denominator;
  const rounded = r * 2n >= denominator ? q + 1n : q;
  return negative ? -rounded : rounded;
}

export function splitVat(input: {
  amount: Money;
  rate: RateScaled;
  treatment: TaxTreatment;
}): { dpp: Money; vat: Money; total: Money } {
  if (input.amount < 0n) {
    throw new AccountingError("Nilai dasar pajak tidak boleh negatif.");
  }
  if (input.rate < 0n) {
    throw new AccountingError("Tarif pajak tidak boleh negatif.");
  }

  if (input.treatment === "NON_PPN" || input.rate === 0n) {
    return { dpp: input.amount, vat: 0n, total: input.amount };
  }

  if (input.treatment === "BELUM_TERMASUK_PPN") {
    const vat = divRound(input.amount * input.rate, PERCENT * RATE_SCALE);
    return { dpp: input.amount, vat, total: input.amount + vat };
  }

  const dpp = divRound(
    input.amount * PERCENT * RATE_SCALE,
    PERCENT * RATE_SCALE + input.rate,
  );
  const vat = input.amount - dpp;
  return { dpp, vat, total: input.amount };
}

export function computeWithholding(input: {
  base: Money;
  rate: RateScaled;
}): Money {
  if (input.base < 0n) {
    throw new AccountingError("Dasar pemotongan PPh tidak boleh negatif.");
  }
  if (input.rate < 0n) {
    throw new AccountingError("Tarif PPh tidak boleh negatif.");
  }
  return divRound(input.base * input.rate, PERCENT * RATE_SCALE);
}
