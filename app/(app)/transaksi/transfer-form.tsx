"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import {
  postTransferAction,
  saveTransferDraftAction,
} from "@/app/(app)/transaksi/actions";

type CashAccountOption = {
  id: string;
  account_no: string;
  name: string;
  label: string;
};

type TransferFormProps = {
  cashAccounts: CashAccountOption[];
  canPost: boolean;
  initialDate: string;
};

export function TransferForm({
  cashAccounts,
  canPost,
  initialDate,
}: TransferFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(initialDate);
  const [memo, setMemo] = useState("");
  const [sourceCashAccountId, setSource] = useState(cashAccounts[0]?.id ?? "");
  const [destCashAccountId, setDest] = useState(cashAccounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");

  const selectClass =
    "h-[38px] w-full rounded-lg border border-mist-300 bg-white px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400";

  function payload() {
    return {
      entryDate,
      memo,
      sourceCashAccountId,
      destCashAccountId,
      amount,
    };
  }

  return (
    <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
      {message ? <Notice message={message} tone="error" /> : null}
      {cashAccounts.length < 2 ? (
        <Notice
          tone="attention"
          message="Transfer membutuhkan minimal dua akun kas/bank. Tambah rekening di Chart of Account dulu."
        />
      ) : null}

      <div className="grid gap-3 rounded-xl border border-mist-300 p-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Tanggal</span>
          <input
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            className="h-[38px] w-full rounded-lg border border-mist-300 px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Keterangan</span>
          <input
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            className="h-[38px] w-full rounded-lg border border-mist-300 px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Dari</span>
          <select
            value={sourceCashAccountId}
            onChange={(event) => setSource(event.target.value)}
            className={selectClass}
          >
            <option value="">Pilih sumber</option>
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_no} {account.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Ke</span>
          <select
            value={destCashAccountId}
            onChange={(event) => setDest(event.target.value)}
            className={selectClass}
          >
            <option value="">Pilih tujuan</option>
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_no} {account.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-semibold text-ink">Nominal</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="num h-[38px] w-full max-w-sm rounded-lg border border-mist-300 px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
            inputMode="decimal"
            placeholder="1.000.000"
          />
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          emojiChar={emoji.simpan}
          disabled={pending}
          onClick={() => {
            setMessage(null);
            const data = payload();
            start(async () => {
              const result = await saveTransferDraftAction(data);
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              router.push(`/transaksi/${result.data.id}`);
              router.refresh();
            });
          }}
        >
          {pending ? "Menyimpan..." : "Simpan Draft"}
        </Button>
        {canPost ? (
          <Button
            variant="primary"
            emojiChar={emoji.posting}
            disabled={pending}
            onClick={() => {
              setMessage(null);
              const data = payload();
              start(async () => {
                const result = await postTransferAction(data);
                if (!result.ok) {
                  setMessage(result.message);
                  return;
                }
                router.push(`/transaksi/${result.data.id}`);
                router.refresh();
              });
            }}
          >
            {pending ? "Memposting..." : "Posting Transfer"}
          </Button>
        ) : (
          <p className="text-sm text-ink-muted">
            Peran Anda hanya boleh menyimpan draft.
          </p>
        )}
      </div>
    </form>
  );
}
