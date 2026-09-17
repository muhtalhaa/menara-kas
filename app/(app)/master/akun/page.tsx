import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { requireSession } from "@/lib/server/auth";
import { listAccounts } from "@/lib/repositories/masters";

export default async function AkunPage() {
  const session = await requireSession();
  const accounts = await listAccounts({
    orgId: session.orgId,
    userId: session.userId,
  });

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Chart of Account
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.coa}</Emoji>
        Daftar Akun
      </h1>
      {accounts.length === 0 ? (
        <div className="rounded-xl border border-mist-300 bg-mint p-8 text-center">
          <p className="font-hand text-[22px] text-ink-muted">
            Belum ada akun di sini
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Pilih template COA saat onboarding, atau tambah akun nanti.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-mist-300">
          <table className="w-full text-sm">
            <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">No. Akun</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Golongan</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-mist-300">
                  <td className="num px-3 py-2">{account.account_no}</td>
                  <td className="px-3 py-2">{account.name}</td>
                  <td className="px-3 py-2">{account.group}</td>
                  <td className="px-3 py-2">
                    {account.is_active ? "Aktif" : "Nonaktif"}
                    {!account.is_postable ? " · Induk" : ""}
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
