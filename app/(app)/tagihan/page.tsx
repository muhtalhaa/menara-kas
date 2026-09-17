import Link from "next/link";
import { Emoji } from "@/components/ui/emoji";
import { Button } from "@/components/ui/button";
import { emoji } from "@/lib/ui/emoji";
import { formatDateId, formatMoneyDisplay } from "@/lib/ui/format";
import { fromDbNumeric } from "@/lib/accounting/money";
import { requireSession } from "@/lib/server/auth";
import { listPurchaseBills } from "@/lib/repositories/bills";

const STATUS: Record<string, string> = {
  BELUM_DIBAYAR: "Belum Dibayar",
  SEBAGIAN: "Dibayar Sebagian",
  LUNAS: "Lunas",
  JATUH_TEMPO: "Jatuh Tempo",
};

export default async function TagihanPage() {
  const session = await requireSession();
  const bills = await listPurchaseBills({
    orgId: session.orgId,
    userId: session.userId,
  });

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Utang usaha
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">
          <Emoji>{emoji.kasKeluar}</Emoji>
          Tagihan Pembelian
        </h1>
        <Link href="/tagihan/baru">
          <Button variant="primary" emojiChar={emoji.tambah}>
            Buat Tagihan
          </Button>
        </Link>
      </div>
      {bills.length === 0 ? (
        <div className="rounded-xl border border-mist-300 bg-mint p-8 text-center">
          <p className="font-hand text-[22px] text-ink-muted">
            Belum ada tagihan di sini
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-mist-300">
          <table className="w-full text-sm">
            <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Nomor</th>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-t border-mist-300">
                  <td className="px-3 py-2 font-semibold">
                    <Link
                      href={`/tagihan/${bill.id}`}
                      className="text-teal-600 hover:underline"
                    >
                      {bill.document_no}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{formatDateId(bill.bill_date)}</td>
                  <td className="px-3 py-2">{bill.vendor_name}</td>
                  <td className="px-3 py-2">
                    {STATUS[bill.status] ?? bill.status}
                  </td>
                  <td className="num px-3 py-2">
                    {formatMoneyDisplay(fromDbNumeric(bill.total))}
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
