"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { payBillAction } from "@/app/(app)/tagihan/actions";

type Option = { id: string; label: string };

type PayBillFormProps = {
  billId: string;
  cashAccounts: Option[];
};

export function PayBillForm({ billId, cashAccounts }: PayBillFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [allocated, setAllocated] = useState("");

  const field =
    "h-[38px] w-full rounded-lg border border-mist-300 bg-white px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400";

  return (
    <form
      className="space-y-3 rounded-xl border border-mist-300 p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      {message ? <Notice message={message} tone="error" /> : null}
      <p className="font-semibold text-ink">Bayar Tagihan</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Tanggal</span>
          <input
            className={field}
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Kas/Bank</span>
          <select
            className={field}
            value={cashAccountId}
            onChange={(e) => setCashAccountId(e.target.value)}
          >
            {cashAccounts.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-semibold">Nilai dibayar</span>
          <input
            className={`${field} num`}
            value={allocated}
            onChange={(e) => setAllocated(e.target.value)}
            placeholder="80.000.000"
          />
        </label>
      </div>
      <Button
        variant="primary"
        emojiChar={emoji.kasKeluar}
        disabled={pending}
        onClick={() => {
          setMessage(null);
          start(async () => {
            const result = await payBillAction({
              paymentDate,
              billId,
              cashAccountId,
              allocated,
            });
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Memposting..." : "Posting Bayar Tagihan"}
      </Button>
    </form>
  );
}
