import Link from "next/link";
import { Emoji } from "@/components/ui/emoji";
import { Button } from "@/components/ui/button";
import { emoji } from "@/lib/ui/emoji";
import { formatDateId, formatMoneyDisplay } from "@/lib/ui/format";
import { fromDbNumeric } from "@/lib/accounting/money";
import { requireSession } from "@/lib/server/auth";
import { listSalesInvoices } from "@/lib/repositories/invoices";

const STATUS: Record<string, string> = {
  BELUM_DIBAYAR: "Belum Dibayar",
  SEBAGIAN: "Dibayar Sebagian",
  LUNAS: "Lunas",
  JATUH_TEMPO: "Jatuh Tempo",
};

export default async function InvoicePage() {
  const session = await requireSession();
  const invoices = await listSalesInvoices({
    orgId: session.orgId,
    userId: session.userId,
  });

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Piutang usaha
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">
          <Emoji>{emoji.transaksi}</Emoji>
          Invoice Penjualan
        </h1>
        <Link href="/invoice/baru">
          <Button variant="primary" emojiChar={emoji.tambah}>
            Buat Invoice
          </Button>
        </Link>
      </div>
      {invoices.length === 0 ? (
        <div className="rounded-xl border border-mist-300 bg-mint p-8 text-center">
          <p className="font-hand text-[22px] text-ink-muted">
            Belum ada invoice di sini
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-mist-300">
          <table className="w-full text-sm">
            <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Nomor</th>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Pelanggan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-mist-300">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/invoice/${invoice.id}`} className="text-teal-600 hover:underline">
                      {invoice.document_no}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{formatDateId(invoice.invoice_date)}</td>
                  <td className="px-3 py-2">{invoice.customer_name}</td>
                  <td className="px-3 py-2">{STATUS[invoice.status] ?? invoice.status}</td>
                  <td className="num px-3 py-2">
                    {formatMoneyDisplay(fromDbNumeric(invoice.total))}
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
