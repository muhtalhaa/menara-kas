"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { createQuotationAction } from "@/app/(app)/dokumen/actions";

type Option = { id: string; label: string };

export function QuotationForm({
  customers,
  projects,
}: {
  customers: Option[];
  projects: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [quoteDate, setQuoteDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState("");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const field =
    "h-[38px] w-full rounded-lg border border-mist-300 bg-white px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400";

  return (
    <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
      {message ? <Notice message={message} tone="error" /> : null}
      <div className="grid gap-3 rounded-xl border border-mist-300 p-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Tanggal</span>
          <input
            className={field}
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Berlaku sampai</span>
          <input
            className={field}
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Pelanggan</span>
          <select
            className={field}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Pilih pelanggan</option>
            {customers.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Project</span>
          <select
            className={field}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Tidak ditandai</option>
            {projects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-semibold">Uraian</span>
          <input
            className={field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Nilai</span>
          <input
            className={`${field} num`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="50.000.000"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Catatan</span>
          <input
            className={field}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
      <div className="flex justify-end">
        <Button
          variant="primary"
          emojiChar={emoji.simpan}
          disabled={pending}
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await createQuotationAction({
                quoteDate,
                validUntil: validUntil || undefined,
                customerId,
                projectId: projectId || undefined,
                description,
                amount,
                notes: notes || undefined,
              });
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              router.push(`/dokumen/quotation/${result.data.id}/cetak`);
              router.refresh();
            });
          }}
        >
          {pending ? "Menyimpan..." : "Simpan Quotation"}
        </Button>
      </div>
    </form>
  );
}
