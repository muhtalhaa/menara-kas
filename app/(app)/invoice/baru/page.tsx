import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { requireSession } from "@/lib/server/auth";
import {
  listAccounts,
  listContacts,
  listProjects,
  listTaxCodes,
} from "@/lib/repositories/masters";
import {
  getQuotationItemsForInvoice,
  listQuotations,
} from "@/lib/repositories/documents";
import { fromDbNumeric } from "@/lib/accounting/money";
import { formatMoneyDisplay } from "@/lib/ui/format";
import { InvoiceForm } from "../invoice-form";

export default async function InvoiceBaruPage() {
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const [accounts, contacts, projects, taxCodes, quotations] = await Promise.all([
    listAccounts(ctx),
    listContacts(ctx),
    listProjects(ctx),
    listTaxCodes(ctx),
    listQuotations(ctx),
  ]);

  const quotationOptions = [];
  for (const row of quotations) {
    const detail = await getQuotationItemsForInvoice(ctx, row.id);
    if (!detail || detail.items.length === 0) continue;
    const first = detail.items[0]!;
    quotationOptions.push({
      id: row.id,
      label: `${row.document_no} · ${row.customer_name}`,
      customerId: detail.customerId,
      projectId: detail.projectId,
      description: first.description,
      amount: formatMoneyDisplay(fromDbNumeric(first.amount)),
    });
  }

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Invoice baru
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.transaksi}</Emoji>
        Buat Invoice
      </h1>
      <InvoiceForm
        customers={contacts
          .filter((row) => row.is_customer)
          .map((row) => ({ id: row.id, label: row.name }))}
        projects={projects.map((row) => ({
          id: row.id,
          label: `${row.code} ${row.name}`,
        }))}
        revenueAccounts={accounts
          .filter((row) => row.is_postable && row.group === "PENDAPATAN")
          .map((row) => ({
            id: row.id,
            label: `${row.account_no} ${row.name}`,
          }))}
        taxCodes={taxCodes
          .filter((row) => row.kind === "PPN_KELUARAN")
          .map((row) => ({ id: row.id, label: `${row.code} ${row.name}` }))}
        quotations={quotationOptions}
      />
    </div>
  );
}
