import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { requireSession } from "@/lib/server/auth";
import {
  listAccounts,
  listContacts,
  listProjects,
  listTaxCodes,
} from "@/lib/repositories/masters";
import { BillForm } from "../bill-form";

export default async function TagihanBaruPage() {
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const [accounts, contacts, projects, taxCodes] = await Promise.all([
    listAccounts(ctx),
    listContacts(ctx),
    listProjects(ctx),
    listTaxCodes(ctx),
  ]);

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Tagihan baru
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.kasKeluar}</Emoji>
        Buat Tagihan Pembelian
      </h1>
      <BillForm
        vendors={contacts
          .filter((row) => row.is_vendor)
          .map((row) => ({ id: row.id, label: row.name }))}
        projects={projects.map((row) => ({
          id: row.id,
          label: `${row.code} ${row.name}`,
        }))}
        expenseAccounts={accounts
          .filter(
            (row) =>
              row.is_postable &&
              (row.group === "BEBAN_POKOK_PROJECT" ||
                row.group === "BEBAN_OPERASIONAL" ||
                row.group === "ASET"),
          )
          .map((row) => ({
            id: row.id,
            label: `${row.account_no} ${row.name}`,
          }))}
        taxCodes={taxCodes
          .filter((row) => row.kind === "PPN_MASUKAN")
          .map((row) => ({ id: row.id, label: `${row.code} ${row.name}` }))}
      />
    </div>
  );
}
