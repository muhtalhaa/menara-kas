import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { requireSession } from "@/lib/server/auth";
import {
  listAccounts,
  listCashAccounts,
  listContacts,
  listProjects,
} from "@/lib/repositories/masters";
import { CashForm } from "../cash-form";
import {
  postCashOutAction,
  saveCashOutDraftAction,
} from "../actions";

export default async function KasKeluarPage() {
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const [accounts, cashAccounts, projects, contacts] = await Promise.all([
    listAccounts(ctx),
    listCashAccounts(ctx),
    listProjects(ctx),
    listContacts(ctx),
  ]);

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Transaksi baru
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.kasKeluar}</Emoji>
        Kas Keluar
      </h1>
      <CashForm
        direction="keluar"
        accounts={accounts}
        cashAccounts={cashAccounts}
        projects={projects}
        contacts={contacts}
        canPost={
          session.role === "OWNER" || session.role === "ADMIN_KEUANGAN"
        }
        initialDate={todayIso()}
        saveDraft={saveCashOutDraftAction}
        postEntry={postCashOutAction}
      />
    </div>
  );
}
