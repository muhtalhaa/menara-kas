import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { MONTHS_SHORT } from "@/lib/ui/format";
import { requireSession } from "@/lib/server/auth";
import { listPeriods } from "@/lib/repositories/periods";
import { PeriodActions } from "./period-actions";

export default async function PeriodePage() {
  const session = await requireSession();
  const year = new Date().getFullYear();
  const periods = await listPeriods(
    { orgId: session.orgId, userId: session.userId },
    year,
  );

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Tahun buku {year}
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.periode}</Emoji>
        Periode
      </h1>
      <p className="text-sm text-ink-muted">
        Transaksi hanya bisa disimpan pada periode Terbuka. Mengunci periode
        menolak transaksi baru; Owner bisa membukanya kembali dengan alasan.
      </p>

      {periods.length === 0 ? (
        <div className="rounded-xl border border-mist-300 bg-mint p-8 text-center">
          <p className="font-hand text-[22px] text-ink-muted">
            Belum ada periode di sini
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Periode dibuat otomatis saat onboarding perusahaan.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-mist-300">
          <table className="w-full text-sm">
            <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Periode</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Draft</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id} className="border-t border-mist-300">
                  <td className="px-3 py-2 font-semibold">
                    {MONTHS_SHORT[period.month - 1]} {period.year}
                  </td>
                  <td className="px-3 py-2">{period.status}</td>
                  <td className="num px-3 py-2">
                    {period.draft_count === 0 ? "-" : String(period.draft_count)}
                  </td>
                  <td className="px-3 py-2">
                    <PeriodActions
                      periodId={period.id}
                      status={period.status}
                      draftCount={period.draft_count}
                      canLock={
                        session.role === "OWNER" ||
                        session.role === "ADMIN_KEUANGAN"
                      }
                      canUnlock={session.role === "OWNER"}
                    />
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
