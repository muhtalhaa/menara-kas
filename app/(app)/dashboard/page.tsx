import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { requireSession } from "@/lib/server/auth";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <div className="space-y-4">
      <p className="font-hand text-[28px] font-bold text-teal-500">
        Selamat datang, {session.user.name}
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.dashboard}</Emoji>
        Dashboard
      </h1>
      <div className="rounded-xl border border-mist-300 bg-white p-5">
        <p className="font-hand text-[18px] text-ink-muted">
          perusahaan aktif
        </p>
        <p className="mt-1 text-lg font-semibold text-ink">
          {session.orgName} ({session.companyCode})
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Catat transaksi di Jurnal Umum, lalu kunci periode setelah buku bulan
          ini rapi.
        </p>
      </div>
      <div className="rounded-xl border border-mist-300 bg-mint p-5">
        <p className="text-sm font-semibold text-ink">
          <Emoji>{emoji.peringatan}</Emoji>
          Keadaan kosong
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Belum ada transaksi. Tambahkan Chart of Account dan project di fase
          berikutnya.
        </p>
      </div>
    </div>
  );
}
