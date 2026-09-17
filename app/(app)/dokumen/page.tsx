import Link from "next/link";
import { Emoji } from "@/components/ui/emoji";
import { Button } from "@/components/ui/button";
import { emoji } from "@/lib/ui/emoji";
import { formatDateId, formatMoneyDisplay } from "@/lib/ui/format";
import { fromDbNumeric } from "@/lib/accounting/money";
import { requireSession } from "@/lib/server/auth";
import {
  listBeritaAcara,
  listKwitansi,
  listQuotations,
} from "@/lib/repositories/documents";

export default async function DokumenPage() {
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const [quotations, bas, kwitansi] = await Promise.all([
    listQuotations(ctx),
    listBeritaAcara(ctx),
    listKwitansi(ctx),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-hand text-[20px] font-semibold text-teal-600">
          Dokumen cetak
        </p>
        <h1 className="text-2xl font-bold text-ink">
          <Emoji>{emoji.cetak}</Emoji>
          Quotation, BA, Kwitansi
        </h1>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Quotation</h2>
          <Link href="/dokumen/quotation/baru">
            <Button variant="primary" emojiChar={emoji.tambah}>
              Buat Quotation
            </Button>
          </Link>
        </div>
        {quotations.length === 0 ? (
          <div className="rounded-xl border border-mist-300 bg-mint p-6 text-center">
            <p className="font-hand text-[20px] text-ink-muted">
              Belum ada quotation
            </p>
          </div>
        ) : (
          <DocTable
            rows={quotations.map((row) => ({
              id: row.id,
              no: row.document_no,
              date: row.quote_date,
              party: row.customer_name,
              amount: row.total,
              href: `/dokumen/quotation/${row.id}/cetak`,
            }))}
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Berita Acara</h2>
          <Link href="/dokumen/ba/baru">
            <Button variant="outline" emojiChar={emoji.tambah}>
              Buat Berita Acara
            </Button>
          </Link>
        </div>
        {bas.length === 0 ? (
          <div className="rounded-xl border border-mist-300 bg-mint p-6 text-center">
            <p className="font-hand text-[20px] text-ink-muted">
              Belum ada Berita Acara
            </p>
          </div>
        ) : (
          <DocTable
            rows={bas.map((row) => ({
              id: row.id,
              no: row.document_no,
              date: row.ba_date,
              party: `${row.project_code} · ${row.customer_name}`,
              amount: null,
              href: `/dokumen/ba/${row.id}/cetak`,
            }))}
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Kwitansi</h2>
          <Link href="/dokumen/kwitansi/baru">
            <Button variant="outline" emojiChar={emoji.tambah}>
              Buat Kwitansi
            </Button>
          </Link>
        </div>
        {kwitansi.length === 0 ? (
          <div className="rounded-xl border border-mist-300 bg-mint p-6 text-center">
            <p className="font-hand text-[20px] text-ink-muted">
              Belum ada kwitansi
            </p>
          </div>
        ) : (
          <DocTable
            rows={kwitansi.map((row) => ({
              id: row.id,
              no: row.document_no,
              date: row.kw_date,
              party: row.contact_name,
              amount: row.amount,
              href: `/dokumen/kwitansi/${row.id}/cetak`,
            }))}
          />
        )}
      </section>
    </div>
  );
}

function DocTable({
  rows,
}: {
  rows: Array<{
    id: string;
    no: string;
    date: string;
    party: string;
    amount: string | null;
    href: string;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-mist-300">
      <table className="w-full text-sm">
        <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
          <tr>
            <th className="px-3 py-2">Nomor</th>
            <th className="px-3 py-2">Tanggal</th>
            <th className="px-3 py-2">Pihak</th>
            <th className="px-3 py-2 text-right">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-mist-300">
              <td className="px-3 py-2 font-semibold">
                <Link href={row.href} className="text-teal-600 hover:underline">
                  {row.no}
                </Link>
              </td>
              <td className="px-3 py-2">{formatDateId(row.date)}</td>
              <td className="px-3 py-2">{row.party}</td>
              <td className="num px-3 py-2">
                {row.amount
                  ? formatMoneyDisplay(fromDbNumeric(row.amount))
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
