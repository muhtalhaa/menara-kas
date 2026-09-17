"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { createBaAction } from "@/app/(app)/dokumen/actions";

type Option = { id: string; label: string };

export function BaForm({
  customers,
  projects,
}: {
  customers: Option[];
  projects: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [baDate, setBaDate] = useState(todayIso());
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [acknowledgedValue, setAcknowledgedValue] = useState("");
  const [signatoryClient, setSignatoryClient] = useState("");
  const [signatoryOurs, setSignatoryOurs] = useState("");

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
            value={baDate}
            onChange={(e) => setBaDate(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Project</span>
          <select
            className={field}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Pilih project</option>
            {projects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
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
          <span className="text-sm font-semibold">Nilai diakui</span>
          <input
            className={`${field} num`}
            value={acknowledgedValue}
            onChange={(e) => setAcknowledgedValue(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-semibold">Uraian</span>
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-mist-300 bg-white px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Penandatangan pemberi kerja</span>
          <input
            className={field}
            value={signatoryClient}
            onChange={(e) => setSignatoryClient(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Penandatangan pelaksana</span>
          <input
            className={field}
            value={signatoryOurs}
            onChange={(e) => setSignatoryOurs(e.target.value)}
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
              const result = await createBaAction({
                baDate,
                projectId,
                customerId,
                description,
                acknowledgedValue: acknowledgedValue || undefined,
                signatoryClient: signatoryClient || undefined,
                signatoryOurs: signatoryOurs || undefined,
              });
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              router.push(`/dokumen/ba/${result.data.id}/cetak`);
              router.refresh();
            });
          }}
        >
          {pending ? "Menyimpan..." : "Simpan Berita Acara"}
        </Button>
      </div>
    </form>
  );
}
