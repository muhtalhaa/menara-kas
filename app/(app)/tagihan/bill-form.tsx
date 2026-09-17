"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import { postBillAction } from "@/app/(app)/tagihan/actions";

type Option = { id: string; label: string };

type BillFormProps = {
  vendors: Option[];
  projects: Option[];
  expenseAccounts: Option[];
  taxCodes: Option[];
};

export function BillForm({
  vendors,
  projects,
  expenseAccounts,
  taxCodes,
}: BillFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [billDate, setBillDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(todayIso());
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [taxTreatment, setTaxTreatment] = useState<
    "BELUM_TERMASUK_PPN" | "TERMASUK_PPN" | "NON_PPN"
  >("NON_PPN");
  const [taxCodeId, setTaxCodeId] = useState(taxCodes[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("Pembelian material");
  const [accountId, setAccountId] = useState(expenseAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");

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
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Jatuh tempo</span>
          <input
            className={field}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Vendor</span>
          <select
            className={field}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">Pilih vendor</option>
            {vendors.map((row) => (
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
          <span className="text-sm font-semibold">Perlakuan PPN</span>
          <select
            className={field}
            value={taxTreatment}
            onChange={(e) =>
              setTaxTreatment(e.target.value as typeof taxTreatment)
            }
          >
            <option value="NON_PPN">Non PPN</option>
            <option value="BELUM_TERMASUK_PPN">Belum termasuk PPN</option>
            <option value="TERMASUK_PPN">Termasuk PPN</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Kode pajak</span>
          <select
            className={field}
            value={taxCodeId}
            onChange={(e) => setTaxCodeId(e.target.value)}
          >
            <option value="">Tanpa kode</option>
            {taxCodes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-semibold">Catatan</span>
          <input
            className={field}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-3 rounded-xl border border-mist-300 p-4 md:grid-cols-3">
        <label className="block space-y-1.5 md:col-span-3">
          <span className="text-sm font-semibold">Uraian</span>
          <input
            className={field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Akun</span>
          <select
            className={field}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {expenseAccounts.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-semibold">Nominal</span>
          <input
            className={`${field} num`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="80.000.000"
          />
        </label>
      </div>
      <div className="flex justify-end">
        <Button
          variant="primary"
          emojiChar={emoji.posting}
          disabled={pending}
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await postBillAction({
                billDate,
                dueDate,
                vendorId,
                projectId: projectId || undefined,
                taxTreatment,
                taxCodeId: taxCodeId || undefined,
                notes,
                items: [
                  {
                    description,
                    projectId: projectId || undefined,
                    accountId,
                    amount,
                  },
                ],
              });
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              router.push("/tagihan");
              router.refresh();
            });
          }}
        >
          {pending ? "Memposting..." : "Posting Tagihan"}
        </Button>
      </div>
    </form>
  );
}
