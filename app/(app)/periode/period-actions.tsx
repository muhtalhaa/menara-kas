"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import {
  lockPeriodAction,
  unlockPeriodAction,
} from "@/app/(app)/periode/actions";

type PeriodActionsProps = {
  periodId: string;
  status: "TERBUKA" | "TERKUNCI" | "DITUTUP";
  canLock: boolean;
  canUnlock: boolean;
  draftCount: number;
};

export function PeriodActions({
  periodId,
  status,
  canLock,
  canUnlock,
  draftCount,
}: PeriodActionsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (status === "DITUTUP") {
    return <span className="text-sm text-ink-muted">Ditutup</span>;
  }

  return (
    <div className="space-y-2">
      {message ? <Notice message={message} tone="error" /> : null}
      {status === "TERBUKA" && canLock ? (
        <Button
          variant="outline"
          emojiChar={emoji.kunci}
          disabled={pending || draftCount > 0}
          title={
            draftCount > 0
              ? "Masih ada transaksi draft. Posting atau hapus draft dulu."
              : undefined
          }
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await lockPeriodAction({ periodId });
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending ? "Mengunci..." : "Kunci Periode"}
        </Button>
      ) : null}
      {status === "TERKUNCI" && canUnlock ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-ink">Alasan buka</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-[38px] rounded-lg border border-mist-300 px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
              placeholder="Contoh: koreksi invoice"
            />
          </label>
          <Button
            variant="outline"
            emojiChar={emoji.buka}
            disabled={pending}
            onClick={() => {
              setMessage(null);
              start(async () => {
                const result = await unlockPeriodAction({ periodId, reason });
                if (!result.ok) {
                  setMessage(result.message);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {pending ? "Membuka..." : "Buka Periode"}
          </Button>
        </div>
      ) : null}
      {status === "TERKUNCI" && !canUnlock ? (
        <p className="text-xs text-ink-muted">
          Hanya Owner yang bisa membuka periode terkunci.
        </p>
      ) : null}
    </div>
  );
}
