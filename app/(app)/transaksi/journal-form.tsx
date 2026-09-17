"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { formatMoneyDisplay } from "@/lib/ui/format";
import { parseMoneyField } from "@/lib/accounting/money";
import {
  deleteJournalDraftAction,
  postJournalAction,
  saveJournalDraftAction,
  updateJournalDraftAction,
} from "@/app/(app)/transaksi/actions";

export type JournalAccountOption = {
  id: string;
  account_no: string;
  name: string;
  is_postable: boolean;
  is_active: boolean;
};

export type JournalProjectOption = {
  id: string;
  code: string;
  name: string;
};

type LineState = {
  accountId: string;
  projectId: string;
  debit: string;
  credit: string;
  description: string;
};

type JournalFormProps = {
  accounts: JournalAccountOption[];
  projects: JournalProjectOption[];
  canPost: boolean;
  entryId?: string;
  initialDate: string;
  initialMemo?: string;
  initialLines?: LineState[];
};

function emptyLine(): LineState {
  return {
    accountId: "",
    projectId: "",
    debit: "",
    credit: "",
    description: "",
  };
}

function moneyOrZero(raw: string): bigint {
  try {
    return parseMoneyField(raw);
  } catch {
    return 0n;
  }
}

export function JournalForm({
  accounts,
  projects,
  canPost,
  entryId,
  initialDate,
  initialMemo = "",
  initialLines,
}: JournalFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(initialDate);
  const [memo, setMemo] = useState(initialMemo);
  const [lines, setLines] = useState<LineState[]>(
    initialLines && initialLines.length >= 2
      ? initialLines
      : [emptyLine(), emptyLine()],
  );

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + moneyOrZero(line.debit), 0n);
    const credit = lines.reduce(
      (sum, line) => sum + moneyOrZero(line.credit),
      0n,
    );
    const diff = debit > credit ? debit - credit : credit - debit;
    const side = debit === credit ? null : debit > credit ? "debit" : "kredit";
    return { debit, credit, diff, side };
  }, [lines]);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function payload() {
    return {
      entryDate,
      memo,
      source: "JURNAL_UMUM" as const,
      entryId,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        projectId: line.projectId || undefined,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
    };
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => event.preventDefault()}
    >
      {message ? <Notice message={message} tone="error" /> : null}
      {success ? <Notice message={success} tone="success" /> : null}

      <div className="grid gap-3 rounded-xl border border-mist-300 p-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Tanggal</span>
          <input
            name="entryDate"
            type="date"
            required
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            className="h-[38px] w-full rounded-lg border border-mist-300 bg-white px-3 text-sm text-ink outline-none focus:border-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Keterangan</span>
          <input
            name="memo"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            className="h-[38px] w-full rounded-lg border border-mist-300 bg-white px-3 text-sm text-ink outline-none focus:border-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-mist-300">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2">Akun</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Uraian</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Kredit</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-mist-300">
                <td className="px-2 py-2">
                  <select
                    value={line.accountId}
                    onChange={(event) =>
                      updateLine(index, { accountId: event.target.value })
                    }
                    className="h-[38px] w-full rounded-lg border border-mist-300 bg-white px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                  >
                    <option value="">Pilih akun</option>
                    {accounts.map((account) => (
                      <option
                        key={account.id}
                        value={account.id}
                        disabled={!account.is_postable || !account.is_active}
                      >
                        {account.account_no} {account.name}
                        {!account.is_postable ? " (induk)" : ""}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select
                    value={line.projectId}
                    onChange={(event) =>
                      updateLine(index, { projectId: event.target.value })
                    }
                    className="h-[38px] w-full rounded-lg border border-mist-300 bg-white px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                  >
                    <option value="">Tidak ditandai</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.code} {project.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    value={line.description}
                    onChange={(event) =>
                      updateLine(index, { description: event.target.value })
                    }
                    className="h-[38px] w-full rounded-lg border border-mist-300 px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={line.debit}
                    onChange={(event) =>
                      updateLine(index, { debit: event.target.value, credit: "" })
                    }
                    className="num h-[38px] w-full rounded-lg border border-mist-300 px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={line.credit}
                    onChange={(event) =>
                      updateLine(index, { credit: event.target.value, debit: "" })
                    }
                    className="num h-[38px] w-full rounded-lg border border-mist-300 px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-2">
                  <Button
                    variant="ghost"
                    emojiChar={emoji.hapus}
                    disabled={lines.length <= 2}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    aria-label="Hapus baris"
                  >
                    Hapus
                  </Button>
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
                {formatMoneyDisplay(totals.debit)}
              </td>
              <td className="num px-3 py-2">
                {formatMoneyDisplay(totals.credit)}
              </td>
              <td className="px-3 py-2 text-xs font-normal text-ink-muted">
                {totals.side
                  ? `Selisih ${formatMoneyDisplay(totals.diff)} di sisi ${totals.side}`
                  : "Seimbang"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          emojiChar={emoji.tambah}
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          Tambah Baris
        </Button>
        <div className="flex flex-wrap gap-2">
          {entryId ? (
            <Button
              variant="ghost"
              emojiChar={emoji.hapus}
              disabled={pending}
              onClick={() => {
                setMessage(null);
                start(async () => {
                  const result = await deleteJournalDraftAction({ entryId });
                  if (!result.ok) {
                    setMessage(result.message);
                    return;
                  }
                  router.push("/transaksi");
                  router.refresh();
                });
              }}
            >
              Hapus Draft
            </Button>
          ) : null}
          <Button
            variant="outline"
            emojiChar={emoji.simpan}
            disabled={pending}
            onClick={() => {
              setMessage(null);
              setSuccess(null);
              const data = payload();
              start(async () => {
                const result = entryId
                  ? await updateJournalDraftAction({ ...data, entryId })
                  : await saveJournalDraftAction(data);
                if (!result.ok) {
                  setMessage(result.message);
                  return;
                }
                setSuccess(`Transaksi ${result.data.entryNo} sudah disimpan sebagai draft.`);
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
                setSuccess(null);
                const data = payload();
                start(async () => {
                  const result = await postJournalAction(data);
                  if (!result.ok) {
                    setMessage(result.message);
                    return;
                  }
                  setSuccess(`Transaksi ${result.data.entryNo} sudah diposting.`);
                  router.push(`/transaksi/${result.data.id}`);
                  router.refresh();
                });
              }}
            >
              {pending ? "Memposting..." : "Posting Jurnal"}
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">
              Peran Anda hanya boleh menyimpan draft. Minta Admin Keuangan untuk
              memposting.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
