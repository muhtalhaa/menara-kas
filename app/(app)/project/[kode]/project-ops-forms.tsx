"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { todayIso } from "@/lib/ui/format";
import {
  createBondAction,
  createTermAction,
  invoiceFromTermAction,
  updateProjectStatusAction,
} from "@/app/(app)/project/actions";

const PIPELINE = [
  { value: "QUOTATION", label: "Quotation" },
  { value: "BERJALAN", label: "Berjalan" },
  { value: "SERAH_TERIMA", label: "Serah Terima" },
  { value: "INVOICING", label: "Invoicing" },
  { value: "SELESAI", label: "Selesai" },
  { value: "DIBATALKAN", label: "Dibatalkan" },
] as const;

type ProjectOpsFormsProps = {
  projectId: string;
  status: string;
  customerId: string | null;
  canEditMaster: boolean;
  canChangeStatus: boolean;
  revenueAccounts: Array<{ id: string; label: string }>;
  taxCodes: Array<{ id: string; label: string }>;
  terms: Array<{
    id: string;
    term_no: number;
    name: string;
    amount: string;
    invoice_id: string | null;
  }>;
};

export function ProjectOpsForms({
  projectId,
  status,
  customerId,
  canEditMaster,
  canChangeStatus,
  revenueAccounts,
  taxCodes,
  terms,
}: ProjectOpsFormsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState(status);

  const [termNo, setTermNo] = useState(String(terms.length + 1));
  const [termName, setTermName] = useState("");
  const [termPercent, setTermPercent] = useState("");
  const [termAmount, setTermAmount] = useState("");

  const [bondNo, setBondNo] = useState("");
  const [issuer, setIssuer] = useState("");
  const [bondAmount, setBondAmount] = useState("");
  const [issuedOn, setIssuedOn] = useState(todayIso());
  const [expiresOn, setExpiresOn] = useState(todayIso());
  const [bondKind, setBondKind] = useState<
    "PELAKSANAAN" | "UANG_MUKA" | "PEMELIHARAAN"
  >("PELAKSANAAN");

  const field =
    "h-[38px] w-full rounded-lg border border-mist-300 bg-white px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400";

  return (
    <div className="space-y-6">
      {message ? <Notice message={message} tone="error" /> : null}

      {canChangeStatus ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-mist-300 p-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Status pipeline</span>
            <select
              className={field}
              value={pipelineStatus}
              onChange={(e) => setPipelineStatus(e.target.value)}
            >
              {PIPELINE.map((row) => (
                <option key={row.value} value={row.value}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            emojiChar={emoji.ubah}
            disabled={pending}
            onClick={() => {
              setMessage(null);
              start(async () => {
                const result = await updateProjectStatusAction({
                  projectId,
                  status: pipelineStatus as (typeof PIPELINE)[number]["value"],
                });
                if (!result.ok) {
                  setMessage(result.message);
                  return;
                }
                router.refresh();
              });
            }}
          >
            Simpan Status
          </Button>
        </div>
      ) : null}

      {canEditMaster ? (
        <>
          <div className="space-y-3 rounded-xl border border-mist-300 p-4">
            <p className="font-semibold">Tambah Termin</p>
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className={field}
                value={termNo}
                onChange={(e) => setTermNo(e.target.value)}
                placeholder="No"
              />
              <input
                className={field}
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                placeholder="Nama termin"
              />
              <input
                className={field}
                value={termPercent}
                onChange={(e) => setTermPercent(e.target.value)}
                placeholder="% (opsional)"
              />
              <input
                className={`${field} num`}
                value={termAmount}
                onChange={(e) => setTermAmount(e.target.value)}
                placeholder="Nilai"
              />
            </div>
            <Button
              variant="outline"
              emojiChar={emoji.tambah}
              disabled={pending}
              onClick={() => {
                setMessage(null);
                start(async () => {
                  const result = await createTermAction({
                    projectId,
                    termNo: Number(termNo),
                    name: termName,
                    percent: termPercent ? Number(termPercent) : undefined,
                    amount: termAmount,
                  });
                  if (!result.ok) {
                    setMessage(result.message);
                    return;
                  }
                  setTermName("");
                  setTermAmount("");
                  setTermPercent("");
                  setTermNo(String(Number(termNo) + 1));
                  router.refresh();
                });
              }}
            >
              Simpan Termin
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-mist-300 p-4">
            <p className="font-semibold">Tambah Jaminan</p>
            <div className="grid gap-3 md:grid-cols-3">
              <select
                className={field}
                value={bondKind}
                onChange={(e) =>
                  setBondKind(e.target.value as typeof bondKind)
                }
              >
                <option value="PELAKSANAAN">Pelaksanaan</option>
                <option value="UANG_MUKA">Uang Muka</option>
                <option value="PEMELIHARAAN">Pemeliharaan</option>
              </select>
              <input
                className={field}
                value={bondNo}
                onChange={(e) => setBondNo(e.target.value)}
                placeholder="Nomor jaminan"
              />
              <input
                className={field}
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="Bank/asuransi"
              />
              <input
                className={`${field} num`}
                value={bondAmount}
                onChange={(e) => setBondAmount(e.target.value)}
                placeholder="Nilai"
              />
              <input
                className={field}
                type="date"
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
              />
              <input
                className={field}
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              emojiChar={emoji.tambah}
              disabled={pending}
              onClick={() => {
                setMessage(null);
                start(async () => {
                  const result = await createBondAction({
                    projectId,
                    kind: bondKind,
                    bondNo,
                    issuer,
                    amount: bondAmount,
                    issuedOn,
                    expiresOn,
                  });
                  if (!result.ok) {
                    setMessage(result.message);
                    return;
                  }
                  setBondNo("");
                  setIssuer("");
                  setBondAmount("");
                  router.refresh();
                });
              }}
            >
              Simpan Jaminan
            </Button>
          </div>

          {terms.filter((t) => !t.invoice_id).length > 0 && customerId ? (
            <div className="space-y-3 rounded-xl border border-mist-300 p-4">
              <p className="font-semibold">Buat Invoice dari Termin</p>
              {terms
                .filter((t) => !t.invoice_id)
                .map((term) => (
                  <div
                    key={term.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-mist-300 py-2"
                  >
                    <span className="text-sm">
                      {term.term_no}. {term.name}
                    </span>
                    <Button
                      variant="primary"
                      emojiChar={emoji.transaksi}
                      disabled={pending || !revenueAccounts[0]}
                      onClick={() => {
                        setMessage(null);
                        start(async () => {
                          const result = await invoiceFromTermAction({
                            projectId,
                            termId: term.id,
                            customerId,
                            accountId: revenueAccounts[0]!.id,
                            invoiceDate: todayIso(),
                            dueDate: todayIso(),
                            amount: term.amount,
                            termName: term.name,
                            taxTreatment: "BELUM_TERMASUK_PPN",
                            taxCodeId: taxCodes[0]?.id,
                          });
                          if (!result.ok) {
                            setMessage(result.message);
                            return;
                          }
                          router.refresh();
                        });
                      }}
                    >
                      Buat Invoice
                    </Button>
                  </div>
                ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
