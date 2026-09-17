import Link from "next/link";
import { notFound } from "next/navigation";
import { Emoji } from "@/components/ui/emoji";
import { Button } from "@/components/ui/button";
import { emoji } from "@/lib/ui/emoji";
import { formatDateId, formatMoneyDisplay } from "@/lib/ui/format";
import { fromDbNumeric } from "@/lib/accounting/money";
import { requireSession } from "@/lib/server/auth";
import { listSalesInvoices } from "@/lib/repositories/invoices";
import { listCashAccounts, listTaxCodes } from "@/lib/repositories/masters";
import { ReceivePaymentForm } from "./receive-payment-form";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const invoices = await listSalesInvoices(ctx);
  const invoice = invoices.find((row) => row.id === id);
  if (!invoice) notFound();

  const [cashAccounts, taxCodes] = await Promise.all([
    listCashAccounts(ctx),
    listTaxCodes(ctx),
  ]);
  const canPost =
    session.role === "OWNER" || session.role === "ADMIN_KEUANGAN";

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Detail invoice
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.transaksi}</Emoji>
        {invoice.document_no}
      </h1>
      <p className="text-sm text-ink-muted">
        {formatDateId(invoice.invoice_date)} · {invoice.customer_name} ·{" "}
        {invoice.status}
      </p>
      <p className="num text-2xl font-bold">
        {formatMoneyDisplay(fromDbNumeric(invoice.total))}
      </p>
      <Link href={`/invoice/${invoice.id}/cetak`} target="_blank">
        <Button variant="outline" emojiChar={emoji.cetak}>
          Cetak Invoice
        </Button>
      </Link>
      {invoice.status !== "LUNAS" && canPost ? (
        <ReceivePaymentForm
          invoiceId={invoice.id}
          cashAccounts={cashAccounts.map((row) => ({
            id: row.id,
            label: `${row.account_no} ${row.label}`,
          }))}
          taxCodes={taxCodes
            .filter((row) => row.kind.startsWith("PPH"))
            .map((row) => ({ id: row.id, label: `${row.code} ${row.name}` }))}
        />
      ) : null}
    </div>
  );
}
