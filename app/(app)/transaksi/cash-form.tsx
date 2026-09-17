"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { formatMoneyDisplay } from "@/lib/ui/format";
import { parseMoneyField } from "@/lib/accounting/money";
import type { JournalAccountOption, JournalProjectOption } from "./journal-form";

type CashAccountOption = {
  id: string;
  account_no: string;
  name: string;
  label: string;
};

type ContactOption = {
  id: string;
  name: string;
};

type LineState = {
  accountId: string;
  projectId: string;
  amount: string;
  description: string;
};

type MutateResult =
  | { ok: true; data: { id: string; entryNo: string; status: string } }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

type CashFormProps = {
  direction: "masuk" | "keluar";
  accounts: JournalAccountOption[];
  cashAccounts: CashAccountOption[];
  projects: JournalProjectOption[];
  contacts: ContactOption[];
  canPost: boolean;
  initialDate: string;
  saveDraft: (input: unknown) => Promise<MutateResult>;
  postEntry: (input: unknown) => Promise<MutateResult>;
};

function emptyLine(): LineState {
  return { accountId: "", projectId: "", amount: "", description: "" };
}

function moneyOrZero(raw: string): bigint {
  try {
    return parseMoneyField(raw);
  } catch {
    return 0n;
  }
}

export function CashForm({
  direction,
  accounts,
  cashAccounts,
  projects,
  contacts,
  canPost,
  initialDate,
  saveDraft,
  postEntry,
}: CashFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(initialDate);
  const [memo, setMemo] = useState("");
  const [cashAccountId, setCashAccountId] = useState(
    cashAccounts[0]?.id ?? "",
  );
  const [contactId, setContactId] = useState("");
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + moneyOrZero(line.amount), 0n),
    [lines],
  );

  function payload() {
    return {
      entryDate,
      memo,
      cashAccountId,
      contactId: contactId || undefined,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        projectId: line.projectId || undefined,
        amount: line.amount,
        description: line.description,
      })),
    };
  }

  function splitLine(index: number) {
    setLines((current) => {
      const source = current[index];
      if (!source) return current;
      const copy = { ...source, projectId: "", amount: "" };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  return (
    <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
      {message ? <Notice message={message} tone="error" /> : null}

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
          <span className="text-sm font-semibold text-ink">
            {direction === "keluar" ? "Bayar dari" : "Terima di"}
          </span>
          <select
            value={cashAccountId}
            onChange={(event) => setCashAccountId(event.target.value)}
            className="h-[38px] w-full rounded-lg border border-mist-300 bg-white px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          >
            <option value="">Pilih kas/bank</option>
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_no} {account.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Kontak</span>
          <select
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className="h-[38px] w-full rounded-lg border border-mist-300 bg-white px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          >
            <option value="">Tanpa kontak</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Keterangan</span>
          <input
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            className="h-[38px] w-full rounded-lg border border-mist-300 px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
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
              <th className="px-3 py-2 text-right">Nominal</th>
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
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, accountId: event.target.value }
                            : row,
                        ),
                      )
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
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, projectId: event.target.value }
                            : row,
                        ),
                      )
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
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, description: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="h-[38px] w-full rounded-lg border border-mist-300 px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={line.amount}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, amount: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="num h-[38px] w-full rounded-lg border border-mist-300 px-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      emojiChar={emoji.pecah}
                      onClick={() => splitLine(index)}
                    >
                      Pecah
                    </Button>
                    <Button
                      variant="ghost"
                      emojiChar={emoji.hapus}
                      disabled={lines.length <= 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      aria-label="Hapus baris"
                    >
                      Hapus
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-mist-400 bg-mist-50 font-semibold">
              <td className="px-3 py-2" colSpan={3}>
                Total
              </td>
              <td className="num px-3 py-2">{formatMoneyDisplay(total)}</td>
              <td />
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
          <Button
            variant="outline"
            emojiChar={emoji.simpan}
            disabled={pending}
            onClick={() => {
              setMessage(null);
              const data = payload();
              start(async () => {
                const result = await saveDraft(data);
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
                  const result = await postEntry(data);
                  if (!result.ok) {
                    setMessage(result.message);
                    return;
                  }
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
