"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { reverseJournalAction } from "@/app/(app)/transaksi/actions";

type PostedEntryActionsProps = {
  entryId: string;
  entryNo: string;
  defaultDate: string;
};

export function PostedEntryActions({
  entryId,
  entryNo,
  defaultDate,
}: PostedEntryActionsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reversalDate, setReversalDate] = useState(defaultDate);

  return (
    <div className="space-y-3 rounded-xl border border-mist-300 p-4">
      {message ? <Notice message={message} tone="error" /> : null}
      {success ? <Notice message={success} tone="success" /> : null}
      <p className="text-sm text-ink-muted">
        Jurnal terposting tidak bisa diubah. Koreksi memakai jurnal balik.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">
            Tanggal jurnal balik
          </span>
          <input
            type="date"
            value={reversalDate}
            onChange={(event) => setReversalDate(event.target.value)}
            className="h-[38px] rounded-lg border border-mist-300 bg-white px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          />
        </label>
        <Button
          variant="danger"
          emojiChar={emoji.balik}
          disabled={pending}
          onClick={() => {
            setMessage(null);
            setSuccess(null);
            start(async () => {
              const result = await reverseJournalAction({
                entryId,
                reversalDate,
              });
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              setSuccess(
                `Jurnal ${entryNo} dibatalkan. Jurnal balik ${result.data.entryNo} sudah diposting.`,
              );
              router.push(`/transaksi/${result.data.id}`);
              router.refresh();
            });
          }}
        >
          {pending ? "Membatalkan..." : "Batalkan dengan Jurnal Balik"}
        </Button>
      </div>
    </div>
  );
}
