import type { Money } from "../money";
import type { AccountGroup } from "../balance";

export type EntrySource =
  | "JURNAL_UMUM"
  | "JURNAL_PENYESUAIAN"
  | "KAS_MASUK"
  | "KAS_KELUAR"
  | "TRANSFER_KAS"
  | "INVOICE_PENJUALAN"
  | "TAGIHAN_PEMBELIAN"
  | "TERIMA_PEMBAYARAN"
  | "BAYAR_TAGIHAN"
  | "DEPRESIASI"
  | "SALDO_AWAL"
  | "JURNAL_PENUTUP"
  | "JURNAL_PEMBALIK";

export type EntryStatus = "DRAFT" | "TERPOSTING" | "DIBATALKAN";

export type DraftLine = {
  accountId: string;
  projectId: string | null;
  contactId: string | null;
  taxCodeId: string | null;
  debit: Money;
  credit: Money;
  description: string | null;
};

export type DraftEntry = {
  entryDate: string;
  source: EntrySource;
  memo: string | null;
  lines: DraftLine[];
};

export type AccountSnapshot = {
  id: string;
  accountNo: string;
  name: string;
  group: AccountGroup;
  isPostable: boolean;
  isActive: boolean;
  isCash: boolean;
};

export type PostingRules = {
  requireProjectGroups: AccountGroup[];
};

export const ENTRY_PREFIX: Record<EntrySource, string> = {
  JURNAL_UMUM: "JU",
  JURNAL_PENYESUAIAN: "JA",
  KAS_MASUK: "KM",
  KAS_KELUAR: "KK",
  TRANSFER_KAS: "TR",
  INVOICE_PENJUALAN: "IJ",
  TAGIHAN_PEMBELIAN: "TB",
  TERIMA_PEMBAYARAN: "TP",
  BAYAR_TAGIHAN: "BT",
  DEPRESIASI: "DP",
  SALDO_AWAL: "SA",
  JURNAL_PENUTUP: "TN",
  JURNAL_PEMBALIK: "JB",
};

export function formatEntryNo(
  prefix: string,
  year: number,
  seq: number,
): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}
