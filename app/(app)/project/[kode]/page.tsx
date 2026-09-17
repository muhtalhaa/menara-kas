import Link from "next/link";
import { notFound } from "next/navigation";
import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { formatMoneyDisplay } from "@/lib/ui/format";
import { fromDbNumeric } from "@/lib/accounting/money";
import { requireSession } from "@/lib/server/auth";
import { listAccounts, listTaxCodes } from "@/lib/repositories/masters";
import {
  getProjectDetail,
  listProjectBonds,
  listProjectTerms,
} from "@/lib/repositories/project-ops";
import { withOrg } from "@/lib/db/tenant";
import { ProjectOpsForms } from "./project-ops-forms";

async function findProjectIdByCode(orgId: string, userId: string, kode: string) {
  return withOrg({ orgId, userId }, async (client) => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM projects WHERE org_id = $1 AND code = $2`,
      [orgId, kode.toUpperCase()],
    );
    return result.rows[0]?.id ?? null;
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ kode: string }>;
}) {
  const { kode } = await params;
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const projectId = await findProjectIdByCode(
    session.orgId,
    session.userId,
    kode,
  );
  if (!projectId) notFound();

  const [detail, terms, bonds, accounts, taxCodes] = await Promise.all([
    getProjectDetail(ctx, projectId),
    listProjectTerms(ctx, projectId),
    listProjectBonds(ctx, projectId),
    listAccounts(ctx),
    listTaxCodes(ctx),
  ]);
  if (!detail) notFound();

  const canEditMaster =
    session.role === "OWNER" || session.role === "ADMIN_KEUANGAN";
  const canChangeStatus =
    canEditMaster || session.role === "MANAJER_PROJECT";

  return (
    <div className="space-y-6">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Detail project
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">
          <Emoji>{emoji.project}</Emoji>
          {detail.code} {detail.name}
        </h1>
        <Link href="/project" className="text-sm text-teal-600 hover:underline">
          Kembali ke daftar
        </Link>
      </div>
      <p className="text-sm text-ink-muted">
        Status: {detail.status}
        {detail.customerName ? ` · ${detail.customerName}` : ""}
      </p>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Nilai kontrak", value: detail.contractValue },
          { label: "Rencana termin", value: detail.termsPlanned },
          { label: "Sudah difakturkan", value: detail.billed },
          { label: "Retensi tertahan", value: detail.retentionHeld },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-mist-300 p-4"
          >
            <p className="font-hand text-[18px] text-ink-muted">{card.label}</p>
            <p className="num mt-1 text-xl font-bold">
              {formatMoneyDisplay(card.value)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        Sudah diterima: {formatMoneyDisplay(detail.received)}
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Termin</h2>
        {terms.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada termin.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-mist-300">
            <table className="w-full text-sm">
              <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2 text-right">Nilai</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id} className="border-t border-mist-300">
                    <td className="px-3 py-2">{term.term_no}</td>
                    <td className="px-3 py-2">{term.name}</td>
                    <td className="px-3 py-2">{term.percent ?? "-"}</td>
                    <td className="num px-3 py-2">
                      {formatMoneyDisplay(fromDbNumeric(term.amount))}
                    </td>
                    <td className="px-3 py-2">{term.status}</td>
                    <td className="px-3 py-2">{term.invoice_no ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Jaminan</h2>
        {bonds.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada jaminan.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-mist-300">
            <table className="w-full text-sm">
              <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Jenis</th>
                  <th className="px-3 py-2">Nomor</th>
                  <th className="px-3 py-2">Penerbit</th>
                  <th className="px-3 py-2 text-right">Nilai</th>
                  <th className="px-3 py-2">Jatuh tempo</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {bonds.map((bond) => (
                  <tr key={bond.id} className="border-t border-mist-300">
                    <td className="px-3 py-2">{bond.kind}</td>
                    <td className="px-3 py-2">{bond.bond_no}</td>
                    <td className="px-3 py-2">{bond.issuer}</td>
                    <td className="num px-3 py-2">
                      {formatMoneyDisplay(fromDbNumeric(bond.amount))}
                    </td>
                    <td className="px-3 py-2">
                      {bond.expires_on}
                      {bond.status === "AKTIF" && bond.days_to_expiry <= 30
                        ? " · segera jatuh tempo"
                        : ""}
                    </td>
                    <td className="px-3 py-2">{bond.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProjectOpsForms
        projectId={detail.id}
        status={detail.status}
        customerId={detail.customerId}
        canEditMaster={canEditMaster}
        canChangeStatus={canChangeStatus}
        revenueAccounts={accounts
          .filter((row) => row.is_postable && row.group === "PENDAPATAN")
          .map((row) => ({
            id: row.id,
            label: `${row.account_no} ${row.name}`,
          }))}
        taxCodes={taxCodes
          .filter((row) => row.kind === "PPN_KELUARAN")
          .map((row) => ({ id: row.id, label: `${row.code} ${row.name}` }))}
        terms={terms}
      />
    </div>
  );
}
