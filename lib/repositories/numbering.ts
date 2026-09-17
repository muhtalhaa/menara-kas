import type { PoolClient } from "pg";
import { AccountingError } from "@/lib/accounting/errors";
import { DomainError } from "@/lib/server/errors";
import { postgresCode, postgresMessage } from "@/lib/server/pg-error";

export function toDomainError(error: unknown): never {
  if (error instanceof AccountingError) {
    throw new DomainError(error.message, error.fieldErrors);
  }
  if (error instanceof DomainError) {
    throw error;
  }

  const code = postgresCode(error);
  const message = postgresMessage(error);

  if (message.includes("tidak seimbang")) {
    throw new DomainError(
      "Jurnal belum seimbang. Periksa total debit dan kredit, lalu simpan lagi.",
    );
  }
  if (message.includes("minimal 2 baris")) {
    throw new DomainError(
      "Jurnal minimal punya dua baris bernilai. Tambah baris debit dan kredit.",
    );
  }
  if (message.includes("tidak menerima perubahan transaksi")) {
    throw new DomainError(
      `${message}. Minta Owner membuka periode lebih dulu, atau catat transaksi ini di periode yang masih terbuka.`,
    );
  }
  if (message.includes("jurnal balik") || message.includes("sudah dibatalkan")) {
    throw new DomainError(message);
  }
  if (message.includes("akun induk") || message.includes("tidak aktif")) {
    throw new DomainError(message);
  }
  if (code === "23514") {
    throw new DomainError(
      "Satu baris jurnal hanya boleh debit atau kredit, dan nilainya harus lebih dari nol.",
    );
  }

  throw error;
}

export async function nextNumber(
  client: PoolClient,
  orgId: string,
  prefix: string,
  year: number,
): Promise<number> {
  const result = await client.query<{ last_value: number }>(
    `INSERT INTO numbering_sequences (org_id, prefix, year, last_value)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (org_id, prefix, year)
     DO UPDATE SET last_value = numbering_sequences.last_value + 1
     RETURNING last_value`,
    [orgId, prefix, year],
  );
  const row = result.rows[0];
  if (!row) {
    throw new DomainError("Gagal mengambil nomor transaksi. Coba simpan lagi.");
  }
  return row.last_value;
}
