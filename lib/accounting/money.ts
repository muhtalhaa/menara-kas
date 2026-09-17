/** Rupiah dalam satuan sen. 1 rupiah = 100n. */
export type Money = bigint;

function parseDecimalToCents(raw: string): Money {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Nilai uang kosong.");
  }

  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;

  // Input UI Indonesia dengan desimal: 1.250.000,50
  if (abs.includes(",")) {
    const normalized = abs.replace(/\./g, "");
    const [whole, frac = ""] = normalized.split(",");
    if (!/^\d+$/.test(whole) || (frac && !/^\d{1,2}$/.test(frac))) {
      throw new Error(
        `Nilai uang "${raw}" tidak bisa dibaca. Gunakan format seperti 1.250.000,50.`,
      );
    }
    const cents = (frac + "00").slice(0, 2);
    const result = BigInt(whole) * 100n + BigInt(cents);
    return negative ? -result : result;
  }

  // Input UI Indonesia tanpa desimal: 1.250.000
  if (/^\d{1,3}(\.\d{3})+$/.test(abs)) {
    const whole = abs.replace(/\./g, "");
    const result = BigInt(whole) * 100n;
    return negative ? -result : result;
  }

  // Input DB / plain: 1250000.50 atau 1250000
  if (!/^\d+(\.\d{1,2})?$/.test(abs)) {
    throw new Error(
      `Nilai uang "${raw}" tidak bisa dibaca. Gunakan format seperti 1250000 atau 1.250.000,50.`,
    );
  }

  const [whole, frac = ""] = abs.split(".");
  const cents = (frac + "00").slice(0, 2);
  const result = BigInt(whole) * 100n + BigInt(cents);
  return negative ? -result : result;
}

export function fromRupiah(value: string | number): Money {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Nilai uang tidak valid.");
    }
    return BigInt(Math.round(value * 100));
  }
  return parseDecimalToCents(value);
}

export function toDbNumeric(value: Money): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 100n;
  const cents = abs % 100n;
  const body = `${whole.toString()}.${cents.toString().padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

export function fromDbNumeric(value: string): Money {
  return parseDecimalToCents(value);
}

export function formatRupiah(
  value: Money,
  opts?: { decimals?: 0 | 2 },
): string {
  if (value === 0n) return "-";

  const negative = value < 0n;
  const abs = negative ? -value : value;
  const decimals = opts?.decimals ?? 0;

  const whole = abs / 100n;
  const cents = abs % 100n;
  const wholeFormatted = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  let body = wholeFormatted;
  if (decimals === 2) {
    body = `${wholeFormatted},${cents.toString().padStart(2, "0")}`;
  }

  return negative ? `(${body})` : body;
}
