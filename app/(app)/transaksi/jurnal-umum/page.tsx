import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { requireSession } from "@/lib/server/auth";
import { listAccounts, listProjects } from "@/lib/repositories/masters";
import { JournalForm } from "../journal-form";

export default async function JurnalUmumBaruPage() {
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const [accounts, projects] = await Promise.all([
    listAccounts(ctx),
    listProjects(ctx),
  ]);

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Transaksi baru
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.transaksi}</Emoji>
        Jurnal Umum
      </h1>
      <JournalForm
        accounts={accounts}
        projects={projects}
        canPost={
          session.role === "OWNER" || session.role === "ADMIN_KEUANGAN"
        }
        initialDate={todayIso()}
      />
    </div>
  );
}
