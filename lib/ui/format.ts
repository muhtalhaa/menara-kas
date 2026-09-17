import type { Money } from "@/lib/accounting/money";
import { formatRupiah } from "@/lib/accounting/money";

export function formatDateId(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return `${day} ${months[month - 1]} ${year}`;
}

export function formatMoneyDisplay(
  value: Money,
  opts?: { decimals?: 0 | 2 },
): string {
  return formatRupiah(value, opts);
}

export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;
