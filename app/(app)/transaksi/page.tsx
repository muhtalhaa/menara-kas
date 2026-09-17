import Link from "next/link";
import { Emoji } from "@/components/ui/emoji";
import { Button } from "@/components/ui/button";
import { emoji } from "@/lib/ui/emoji";
import { formatDateId, formatMoneyDisplay } from "@/lib/ui/format";
import { fromDbNumeric } from "@/lib/accounting/money";
import { requireSession } from "@/lib/server/auth";
import { listEntries } from "@/lib/repositories/entries";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  TERPOSTING: "Terposting",
  DIBATALKAN: "Dibatalkan",
};

const SOURCE_LABEL: Record<string, string> = {
  JURNAL_UMUM: "Jurnal Umum",
  JURNAL_PENYESUAIAN: "Jurnal Penyesuaian",
  KAS_MASUK: "Kas Masuk",
  KAS_KELUAR: "Kas Keluar",
  TRANSFER_KAS: "Transfer Kas",
  INVOICE_PENJUALAN: "Invoice Penjualan",
  TAGIHAN_PEMBELIAN: "Tagihan Pembelian",
  TERIMA_PEMBAYARAN: "Terima Pembayaran",
  BAYAR_TAGIHAN: "Bayar Tagihan",
  DEPRESIASI: "Depresiasi",
  SALDO_AWAL: "Saldo Awal",
  JURNAL_PENUTUP: "Jurnal Penutup",
  JURNAL_PEMBALIK: "Jurnal Balik",
};

export default async function TransaksiPage() {
  const session = await requireSession();
  const entries = await listEntries({
    orgId: session.orgId,
    userId: session.userId,
  });

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Daftar transaksi
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">
          <Emoji>{emoji.transaksi}</Emoji>
          Transaksi
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/transaksi/kas-masuk">
            <Button variant="outline" emojiChar={emoji.kasMasuk}>
              Kas Masuk
            </Button>
          </Link>
          <Link href="/transaksi/kas-keluar">
            <Button variant="primary" emojiChar={emoji.kasKeluar}>
              Kas Keluar
            </Button>
          </Link>
          <Link href="/transaksi/transfer-kas">
            <Button variant="outline" emojiChar={emoji.kasBank}>
              Transfer Kas
            </Button>
          </Link>
          <Link href="/transaksi/jurnal-umum">
            <Button variant="outline" emojiChar={emoji.tambah}>
              Jurnal Umum
            </Button>
          </Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-mist-300 bg-mint p-8 text-center">
          <p className="font-hand text-[22px] text-ink-muted">
            Belum ada transaksi di sini
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Buat Jurnal Umum untuk mencatat transaksi double-entry pertama.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-mist-300">
          <table className="w-full text-sm">
            <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Nomor</th>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Jenis</th>
                <th className="px-3 py-2">Keterangan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-mist-300">
                  <td className="px-3 py-2 font-semibold">
                    <Link
                      href={`/transaksi/${entry.id}`}
                      className="text-teal-600 hover:underline"
                    >
                      {entry.entry_no}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {formatDateId(entry.entry_date)}
                  </td>
                  <td className="px-3 py-2">
                    {SOURCE_LABEL[entry.source] ?? entry.source}
                  </td>
                  <td className="px-3 py-2">{entry.memo ?? "-"}</td>
                  <td className="px-3 py-2">
                    {STATUS_LABEL[entry.status] ?? entry.status}
                  </td>
                  <td className="num px-3 py-2">
                    {formatMoneyDisplay(fromDbNumeric(entry.total_amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
