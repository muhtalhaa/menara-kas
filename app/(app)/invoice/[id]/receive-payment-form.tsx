"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { receivePaymentAction } from "@/app/(app)/invoice/actions";

type Option = { id: string; label: string };

type ReceivePaymentFormProps = {
  invoiceId: string;
  cashAccounts: Option[];
  taxCodes: Option[];
  projectId?: string;
};

export function ReceivePaymentForm({
  invoiceId,
  cashAccounts,
  taxCodes,
  projectId,
}: ReceivePaymentFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [allocated, setAllocated] = useState("");
  const [withholdingAmount, setWithholdingAmount] = useState("");
  const [withholdingTaxCodeId, setWithholdingTaxCodeId] = useState(
    taxCodes[0]?.id ?? "",
  );

  const field =
    "h-[38px] w-full rounded-lg border border-mist-300 bg-white px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400";

  return (
    <form className="space-y-3 rounded-xl border border-mist-300 p-4" onSubmit={(e) => e.preventDefault()}>
      {message ? <Notice message={message} tone="error" /> : null}
      <p className="font-semibold text-ink">Terima Pembayaran</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Tanggal</span>
          <input className={field} type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Kas/Bank</span>
          <select className={field} value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
            {cashAccounts.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Nilai dilunasi</span>
          <input className={`${field} num`} value={allocated} onChange={(e) => setAllocated(e.target.value)} placeholder="222.000.000" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">PPh dipotong</span>
          <input className={`${field} num`} value={withholdingAmount} onChange={(e) => setWithholdingAmount(e.target.value)} placeholder="4.000.000" />
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-semibold">Kode PPh</span>
          <select className={field} value={withholdingTaxCodeId} onChange={(e) => setWithholdingTaxCodeId(e.target.value)}>
            <option value="">Tanpa pemotongan</option>
            {taxCodes.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
        </label>
      </div>
      <Button
        variant="primary"
        emojiChar={emoji.kasMasuk}
        disabled={pending}
        onClick={() => {
          setMessage(null);
          start(async () => {
            const result = await receivePaymentAction({
              paymentDate,
              invoiceId,
              cashAccountId,
              allocated,
              withholdingAmount: withholdingAmount || undefined,
              withholdingTaxCodeId: withholdingTaxCodeId || undefined,
              withholdingProjectId: projectId,
            });
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Memposting..." : "Posting Terima Pembayaran"}
      </Button>
    </form>
  );
}
