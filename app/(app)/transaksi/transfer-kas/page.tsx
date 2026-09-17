import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { requireSession } from "@/lib/server/auth";
import { listCashAccounts } from "@/lib/repositories/masters";
import { TransferForm } from "../transfer-form";

export default async function TransferKasPage() {
  const session = await requireSession();
  const cashAccounts = await listCashAccounts({
    orgId: session.orgId,
    userId: session.userId,
  });

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Transaksi baru
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.kasBank}</Emoji>
        Transfer Kas & Bank
      </h1>
      <TransferForm
        cashAccounts={cashAccounts}
        canPost={
          session.role === "OWNER" || session.role === "ADMIN_KEUANGAN"
        }
        initialDate={todayIso()}
      />
    </div>
  );
}
