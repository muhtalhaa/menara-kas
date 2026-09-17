import { notFound } from "next/navigation";
import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { formatDateId, formatMoneyDisplay } from "@/lib/ui/format";
import { fromDbNumeric } from "@/lib/accounting/money";
import { requireSession } from "@/lib/server/auth";
import { listPurchaseBills } from "@/lib/repositories/bills";
import { listCashAccounts } from "@/lib/repositories/masters";
import { PayBillForm } from "./pay-bill-form";

export default async function TagihanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const bills = await listPurchaseBills(ctx);
  const bill = bills.find((row) => row.id === id);
  if (!bill) notFound();

  const cashAccounts = await listCashAccounts(ctx);
  const canPost =
    session.role === "OWNER" || session.role === "ADMIN_KEUANGAN";

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Detail tagihan
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.kasKeluar}</Emoji>
        {bill.document_no}
      </h1>
      <p className="text-sm text-ink-muted">
        {formatDateId(bill.bill_date)} · {bill.vendor_name} · {bill.status}
      </p>
      <p className="num text-2xl font-bold">
        {formatMoneyDisplay(fromDbNumeric(bill.total))}
      </p>
      {bill.status !== "LUNAS" && canPost ? (
        <PayBillForm
          billId={bill.id}
          cashAccounts={cashAccounts.map((row) => ({
            id: row.id,
            label: `${row.account_no} ${row.label}`,
          }))}
        />
      ) : null}
    </div>
  );
}
