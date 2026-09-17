import { withOrg, type OrgContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/server/errors";
import { recordAudit } from "@/lib/server/audit";
import { fromDbNumeric, toDbNumeric, type Money } from "@/lib/accounting/money";
import { postgresCode } from "@/lib/server/pg-error";
import { toDomainError } from "@/lib/repositories/numbering";

const PIPELINE = [
  "QUOTATION",
  "BERJALAN",
  "SERAH_TERIMA",
  "INVOICING",
  "SELESAI",
  "DIBATALKAN",
] as const;

export type ProjectDetail = {
  id: string;
  code: string;
  name: string;
  status: string;
  contractValue: Money;
  customerId: string | null;
  customerName: string | null;
  startDate: string | null;
  targetEndDate: string | null;
  picName: string | null;
  notes: string | null;
  billed: Money;
  received: Money;
  retentionHeld: Money;
  termsPlanned: Money;
};

export async function getProjectDetail(
  ctx: OrgContext,
  projectId: string,
): Promise<ProjectDetail | null> {
  return withOrg(ctx, async (client) => {
    const project = await client.query<{
      id: string;
      code: string;
      name: string;
      status: string;
      contract_value: string;
      customer_id: string | null;
      customer_name: string | null;
      start_date: string | null;
      target_end_date: string | null;
      pic_name: string | null;
      notes: string | null;
    }>(
      `SELECT p.id, p.code, p.name, p.status, p.contract_value::text,
              p.customer_id, c.name AS customer_name,
              p.start_date::text, p.target_end_date::text, p.pic_name, p.notes
       FROM projects p
       LEFT JOIN contacts c ON c.id = p.customer_id
       WHERE p.org_id = $1 AND p.id = $2`,
      [ctx.orgId, projectId],
    );
    const row = project.rows[0];
    if (!row) return null;

    const billed = await client.query<{ amount: string }>(
      `SELECT COALESCE(SUM(i.total), 0)::text AS amount
       FROM sales_invoices i
       WHERE i.org_id = $1 AND i.project_id = $2`,
      [ctx.orgId, projectId],
    );
    const received = await client.query<{ amount: string }>(
      `SELECT COALESCE(SUM(a.amount), 0)::text AS amount
       FROM payment_allocations a
       JOIN sales_invoices i ON i.id = a.invoice_id
       WHERE i.org_id = $1 AND i.project_id = $2`,
      [ctx.orgId, projectId],
    );
    const retention = await client.query<{ amount: string }>(
      `SELECT COALESCE(SUM(i.retention_amount), 0)::text AS amount
       FROM sales_invoices i
       WHERE i.org_id = $1 AND i.project_id = $2`,
      [ctx.orgId, projectId],
    );
    const terms = await client.query<{ amount: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS amount
       FROM project_terms
       WHERE org_id = $1 AND project_id = $2`,
      [ctx.orgId, projectId],
    );

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
      contractValue: fromDbNumeric(row.contract_value),
      customerId: row.customer_id,
      customerName: row.customer_name,
      startDate: row.start_date,
      targetEndDate: row.target_end_date,
      picName: row.pic_name,
      notes: row.notes,
      billed: fromDbNumeric(billed.rows[0]?.amount ?? "0"),
      received: fromDbNumeric(received.rows[0]?.amount ?? "0"),
      retentionHeld: fromDbNumeric(retention.rows[0]?.amount ?? "0"),
      termsPlanned: fromDbNumeric(terms.rows[0]?.amount ?? "0"),
    };
  });
}

export async function updateProjectStatus(
  ctx: OrgContext,
  projectId: string,
  status: string,
): Promise<{ id: string; status: string }> {
  if (!PIPELINE.includes(status as (typeof PIPELINE)[number])) {
    throw new DomainError("Status pipeline tidak dikenali.");
  }
  try {
    return await withOrg(ctx, async (client) => {
      const before = await client.query<{ status: string; code: string }>(
        `SELECT status, code FROM projects WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, projectId],
      );
      const row = before.rows[0];
      if (!row) throw new DomainError("Project tidak ditemukan.");

      await client.query(
        `UPDATE projects SET status = $3::project_status
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, projectId, status],
      );
      await recordAudit(
        ctx,
        "PROJECT_STATUS_CHANGED",
        "project",
        projectId,
        { status: row.status },
        { status, code: row.code },
        client,
      );
      return { id: projectId, status };
    });
  } catch (error) {
    toDomainError(error);
  }
}

export type TermRow = {
  id: string;
  term_no: number;
  name: string;
  percent: string | null;
  amount: string;
  planned_date: string | null;
  status: string;
  invoice_id: string | null;
  invoice_no: string | null;
};

export async function listProjectTerms(
  ctx: OrgContext,
  projectId: string,
): Promise<TermRow[]> {
  return withOrg(ctx, async (client) => {
    const result = await client.query<TermRow>(
      `SELECT t.id, t.term_no, t.name, t.percent::text, t.amount::text,
              t.planned_date::text, t.status, t.invoice_id,
              i.document_no AS invoice_no
       FROM project_terms t
       LEFT JOIN sales_invoices i ON i.id = t.invoice_id
       WHERE t.org_id = $1 AND t.project_id = $2
       ORDER BY t.term_no`,
      [ctx.orgId, projectId],
    );
    return result.rows;
  });
}

export async function createProjectTerm(
  ctx: OrgContext,
  input: {
    projectId: string;
    termNo: number;
    name: string;
    percent?: number | null;
    amount: Money;
    plannedDate?: string | null;
  },
): Promise<{ id: string }> {
  if (input.termNo < 1) {
    throw new DomainError("Nomor termin harus mulai dari 1.");
  }
  if (input.amount < 0n) {
    throw new DomainError("Nilai termin tidak boleh negatif.");
  }
  if (input.percent != null && input.percent > 100) {
    throw new DomainError("Persen termin tidak boleh lebih dari 100.");
  }

  try {
    return await withOrg(ctx, async (client) => {
      if (input.percent != null) {
        const sum = await client.query<{ total: string }>(
          `SELECT COALESCE(SUM(percent), 0)::text AS total
           FROM project_terms
           WHERE org_id = $1 AND project_id = $2`,
          [ctx.orgId, input.projectId],
        );
        const existing = Number(sum.rows[0]?.total ?? "0");
        if (existing + input.percent > 100) {
          throw new DomainError(
            `Total persen termin tidak boleh melebihi 100%. Saat ini ${existing}%, ditambah ${input.percent}% menjadi ${existing + input.percent}%.`,
          );
        }
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO project_terms
           (org_id, project_id, term_no, name, percent, amount, planned_date)
         VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7::date)
         RETURNING id`,
        [
          ctx.orgId,
          input.projectId,
          input.termNo,
          input.name.trim(),
          input.percent ?? null,
          toDbNumeric(input.amount),
          input.plannedDate ?? null,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new DomainError("Gagal menyimpan termin.");
      await recordAudit(
        ctx,
        "PROJECT_TERM_CREATED",
        "project_term",
        id,
        null,
        {
          projectId: input.projectId,
          termNo: input.termNo,
          amount: toDbNumeric(input.amount),
        },
        client,
      );
      return { id };
    });
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new DomainError("Nomor termin sudah dipakai di project ini.");
    }
    toDomainError(error);
  }
}

export type BondRow = {
  id: string;
  kind: string;
  bond_no: string;
  issuer: string;
  amount: string;
  issued_on: string;
  expires_on: string;
  status: string;
  days_to_expiry: number;
};

export async function listProjectBonds(
  ctx: OrgContext,
  projectId: string,
): Promise<BondRow[]> {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{
      id: string;
      kind: string;
      bond_no: string;
      issuer: string;
      amount: string;
      issued_on: string;
      expires_on: string;
      status: string;
      days_to_expiry: number;
    }>(
      `SELECT id, kind, bond_no, issuer, amount::text,
              issued_on::text, expires_on::text, status,
              (expires_on - CURRENT_DATE)::int AS days_to_expiry
       FROM performance_bonds
       WHERE org_id = $1 AND project_id = $2
       ORDER BY expires_on`,
      [ctx.orgId, projectId],
    );
    return result.rows;
  });
}

export async function listExpiringBonds(
  ctx: OrgContext,
  withinDays = 30,
): Promise<
  Array<BondRow & { project_code: string; project_name: string }>
> {
  return withOrg(ctx, async (client) => {
    const result = await client.query<
      BondRow & { project_code: string; project_name: string }
    >(
      `SELECT b.id, b.kind, b.bond_no, b.issuer, b.amount::text,
              b.issued_on::text, b.expires_on::text, b.status,
              (b.expires_on - CURRENT_DATE)::int AS days_to_expiry,
              p.code AS project_code, p.name AS project_name
       FROM performance_bonds b
       JOIN projects p ON p.id = b.project_id
       WHERE b.org_id = $1
         AND b.status = 'AKTIF'
         AND b.expires_on <= CURRENT_DATE + ($2::int || ' days')::interval
       ORDER BY b.expires_on
       LIMIT 20`,
      [ctx.orgId, withinDays],
    );
    return result.rows;
  });
}

export async function createPerformanceBond(
  ctx: OrgContext,
  input: {
    projectId: string;
    kind: "PELAKSANAAN" | "UANG_MUKA" | "PEMELIHARAAN";
    bondNo: string;
    issuer: string;
    amount: Money;
    issuedOn: string;
    expiresOn: string;
    notes?: string | null;
  },
): Promise<{ id: string }> {
  if (input.amount <= 0n) {
    throw new DomainError("Nilai jaminan harus lebih dari nol.");
  }
  if (input.expiresOn < input.issuedOn) {
    throw new DomainError(
      "Tanggal jatuh tempo jaminan tidak boleh sebelum tanggal terbit.",
    );
  }
  try {
    return await withOrg(ctx, async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO performance_bonds
           (org_id, project_id, kind, bond_no, issuer, amount, issued_on, expires_on, notes)
         VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::date, $8::date, $9)
         RETURNING id`,
        [
          ctx.orgId,
          input.projectId,
          input.kind,
          input.bondNo.trim(),
          input.issuer.trim(),
          toDbNumeric(input.amount),
          input.issuedOn,
          input.expiresOn,
          input.notes ?? null,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new DomainError("Gagal menyimpan jaminan.");
      await recordAudit(
        ctx,
        "BOND_CREATED",
        "performance_bond",
        id,
        null,
        { bondNo: input.bondNo, projectId: input.projectId },
        client,
      );
      return { id };
    });
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new DomainError("Nomor jaminan sudah dipakai.");
    }
    toDomainError(error);
  }
}

export async function linkTermToInvoice(
  ctx: OrgContext,
  termId: string,
  invoiceId: string,
): Promise<void> {
  try {
    await withOrg(ctx, async (client) => {
      const term = await client.query<{
        id: string;
        invoice_id: string | null;
        project_id: string;
      }>(
        `SELECT id, invoice_id, project_id
         FROM project_terms
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, termId],
      );
      const row = term.rows[0];
      if (!row) throw new DomainError("Termin tidak ditemukan.");
      if (row.invoice_id) {
        throw new DomainError(
          "Termin ini sudah tertaut ke invoice lain. Batalkan invoice lama dulu, atau pilih termin lain.",
        );
      }

      await client.query(
        `UPDATE sales_invoices
         SET term_id = $3, project_id = COALESCE(project_id, $4)
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, invoiceId, termId, row.project_id],
      );
      await client.query(
        `UPDATE project_terms
         SET invoice_id = $3, status = 'SUDAH_DIFAKTURKAN'
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, termId, invoiceId],
      );
    });
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new DomainError(
        "Termin ini sudah punya invoice aktif. Satu termin hanya boleh satu invoice.",
      );
    }
    toDomainError(error);
  }
}
