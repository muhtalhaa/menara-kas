"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { createKwitansiAction } from "@/app/(app)/dokumen/actions";

type Option = { id: string; label: string };

export function KwitansiForm({
  contacts,
  projects,
}: {
  contacts: Option[];
  projects: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [kwDate, setKwDate] = useState(todayIso());
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Transfer");

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
            value={kwDate}
            onChange={(e) => setKwDate(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Diterima dari</span>
          <select
            className={field}
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">Pilih kontak</option>
            {contacts.map((row) => (
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
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Metode</span>
          <input
            className={field}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-semibold">Untuk pembayaran</span>
          <input
            className={field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Jumlah</span>
          <input
            className={`${field} num`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="10.000.000"
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
              const result = await createKwitansiAction({
                kwDate,
                contactId,
                projectId: projectId || undefined,
                description,
                amount,
                paymentMethod: paymentMethod || undefined,
              });
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              router.push(`/dokumen/kwitansi/${result.data.id}/cetak`);
              router.refresh();
            });
          }}
        >
          {pending ? "Menyimpan..." : "Simpan Kwitansi"}
        </Button>
      </div>
    </form>
  );
}
