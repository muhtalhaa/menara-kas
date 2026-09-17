import Link from "next/link";
import { notFound } from "next/navigation";
import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { formatDateId, formatMoneyDisplay } from "@/lib/ui/format";
import { toDbNumeric } from "@/lib/accounting/money";
import { requireSession } from "@/lib/server/auth";
import { getEntry } from "@/lib/repositories/entries";
import { listAccounts, listProjects } from "@/lib/repositories/masters";
import { JournalForm } from "../journal-form";
import { PostedEntryActions } from "./posted-entry-actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  TERPOSTING: "Terposting",
  DIBATALKAN: "Dibatalkan",
};

export default async function TransaksiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const entry = await getEntry(ctx, id);
  if (!entry) notFound();

  const canPost =
    session.role === "OWNER" || session.role === "ADMIN_KEUANGAN";
  const [accounts, projects] = await Promise.all([
    listAccounts(ctx),
    listProjects(ctx),
  ]);

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Detail transaksi
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">
          <Emoji>{emoji.transaksi}</Emoji>
          {entry.entryNo}
        </h1>
        <Link href="/transaksi" className="text-sm text-teal-600 hover:underline">
          Kembali ke daftar
        </Link>
      </div>
      <p className="text-sm text-ink-muted">
        {formatDateId(entry.entryDate)} · {STATUS_LABEL[entry.status]} ·{" "}
        {entry.memo ?? "Tanpa keterangan"}
      </p>

      {entry.status === "DRAFT" ? (
        <JournalForm
          accounts={accounts}
          projects={projects}
          canPost={canPost}
          entryId={entry.id}
          initialDate={entry.entryDate}
          initialMemo={entry.memo ?? ""}
          initialLines={entry.lines.map((line) => ({
            accountId: line.accountId,
            projectId: line.projectId ?? "",
            debit: line.debit === 0n ? "" : toDbNumeric(line.debit),
            credit: line.credit === 0n ? "" : toDbNumeric(line.credit),
            description: line.description ?? "",
          }))}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-mist-300">
            <table className="w-full text-sm">
              <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Akun</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Uraian</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={line.lineNo} className="border-t border-mist-300">
                    <td className="px-3 py-2">
                      {line.accountNo} {line.accountName}
                    </td>
                    <td className="px-3 py-2">{line.projectCode ?? "-"}</td>
                    <td className="px-3 py-2">{line.description ?? "-"}</td>
                    <td className="num px-3 py-2">
                      {formatMoneyDisplay(line.debit)}
                    </td>
                    <td className="num px-3 py-2">
                      {formatMoneyDisplay(line.credit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-mist-400 bg-mist-50 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="num px-3 py-2">
                    {formatMoneyDisplay(entry.totalAmount)}
                  </td>
                  <td className="num px-3 py-2">
                    {formatMoneyDisplay(entry.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {entry.status === "TERPOSTING" && canPost ? (
            <PostedEntryActions
              entryId={entry.id}
              entryNo={entry.entryNo}
              defaultDate={entry.entryDate}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
