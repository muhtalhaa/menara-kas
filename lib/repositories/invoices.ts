import type { PoolClient } from "pg";
import { withOrg, type OrgContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/server/errors";
import { recordAudit } from "@/lib/server/audit";
import {
  fromDbNumeric,
  toDbNumeric,
  type Money,
} from "@/lib/accounting/money";
import { rateFromNumeric, type TaxTreatment } from "@/lib/accounting/tax";
import { allocateByWeights } from "@/lib/accounting/allocate";
import { formatDocumentNo } from "@/lib/accounting/posting/document-no";
import { buildSalesInvoiceEntry } from "@/lib/accounting/posting/build-invoice";
import { buildReceivePaymentEntry } from "@/lib/accounting/posting/build-payment";
import { postEntry } from "@/lib/repositories/entries";
import { nextNumber, toDomainError } from "@/lib/repositories/numbering";

async function accountRole(
  client: PoolClient,
  orgId: string,
  role: string,
): Promise<string> {
  const result = await client.query<{ account_id: string }>(
    `SELECT account_id FROM account_roles WHERE org_id = $1 AND role = $2`,
    [orgId, role],
  );
  const id = result.rows[0]?.account_id;
  if (!id) {
    throw new DomainError(
      `Akun sistem ${role} belum dipetakan. Lengkapi Chart of Account dulu.`,
    );
  }
  return id;
}

async function companyCode(client: PoolClient, orgId: string): Promise<string> {
  const result = await client.query<{ company_code: string }>(
    `SELECT company_code FROM organizations WHERE id = $1`,
    [orgId],
  );
  const code = result.rows[0]?.company_code;
  if (!code) throw new DomainError("Perusahaan tidak ditemukan.");
  return code;
}

async function vatRateOnDate(
  client: PoolClient,
  orgId: string,
  taxCodeId: string | null,
  onDate: string,
): Promise<bigint> {
  if (!taxCodeId) return 0n;
  const result = await client.query<{ rate_percent: string }>(
    `SELECT r.rate_percent::text
     FROM tax_rates r
     JOIN tax_codes t ON t.id = r.tax_code_id
     WHERE t.org_id = $1 AND t.id = $2
       AND r.valid_from <= $3::date
       AND (r.valid_to IS NULL OR r.valid_to >= $3::date)
     ORDER BY r.valid_from DESC
     LIMIT 1`,
    [orgId, taxCodeId, onDate],
  );
  const raw = result.rows[0]?.rate_percent;
  if (!raw) {
    throw new DomainError(
      "Tarif pajak tidak ditemukan untuk tanggal invoice. Periksa kode pajak.",
    );
  }
  return rateFromNumeric(raw);
}

export async function postSalesInvoice(
  ctx: OrgContext,
  input: {
    invoiceDate: string;
    dueDate: string;
    customerId: string;
    projectId?: string | null;
    taxTreatment: TaxTreatment;
    taxCodeId?: string | null;
    notes?: string | null;
    discount?: Money;
    retentionAmount?: Money;
    termId?: string | null;
    quotationId?: string | null;
    items: Array<{
      description: string;
      projectId?: string | null;
      accountId: string;
      quantity: string;
      unitPrice: Money;
      amount: Money;
    }>;
  },
): Promise<{ id: string; documentNo: string; entryNo: string }> {
  if (!input.customerId) {
    throw new DomainError("Invoice wajib punya pelanggan. Pilih kontak pelanggan dulu.");
  }
  try {
    const piutang = await withOrg(ctx, (c) =>
      accountRole(c, ctx.orgId, "PIUTANG_USAHA"),
    );
    const ppn = await withOrg(ctx, (c) =>
      accountRole(c, ctx.orgId, "PPN_KELUARAN"),
    );
    const retensi = await withOrg(ctx, (c) =>
      accountRole(c, ctx.orgId, "PIUTANG_RETENSI"),
    );
    const code = await withOrg(ctx, (c) => companyCode(c, ctx.orgId));
    const rate = await withOrg(ctx, (c) =>
      vatRateOnDate(
        c,
        ctx.orgId,
        input.taxCodeId ?? null,
        input.invoiceDate,
      ),
    );

    const built = buildSalesInvoiceEntry({
      entryDate: input.invoiceDate,
      memo: input.notes ?? null,
      customerId: input.customerId,
      piutangAccountId: piutang,
      ppnKeluaranAccountId: ppn,
      piutangRetensiAccountId: retensi,
      taxCodeId: input.taxCodeId ?? null,
      taxTreatment: input.taxTreatment,
      vatRate: rate,
      discount: input.discount ?? 0n,
      retentionAmount: input.retentionAmount ?? 0n,
      items: input.items.map((item) => ({
        accountId: item.accountId,
        projectId: item.projectId ?? input.projectId ?? null,
        amount: item.amount,
        description: item.description,
      })),
    });

    const posted = await postEntry(ctx, built.draft);

    return withOrg(ctx, async (client) => {
      if (input.termId) {
        const term = await client.query<{
          invoice_id: string | null;
          project_id: string;
        }>(
          `SELECT invoice_id, project_id FROM project_terms
           WHERE org_id = $1 AND id = $2`,
          [ctx.orgId, input.termId],
        );
        const termRow = term.rows[0];
        if (!termRow) {
          throw new DomainError("Termin tidak ditemukan.");
        }
        if (termRow.invoice_id) {
          throw new DomainError(
            "Termin ini sudah tertaut ke invoice lain. Satu termin hanya boleh satu invoice aktif.",
          );
        }
      }

      const year = Number(input.invoiceDate.slice(0, 4));
      const month = Number(input.invoiceDate.slice(5, 7));
      const seq = await nextNumber(client, ctx.orgId, "INV", year);
      const documentNo = formatDocumentNo({
        seq,
        prefix: "INV",
        companyCode: code,
        month,
        year,
      });

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO sales_invoices
           (org_id, document_no, seq_year, seq_no, invoice_date, due_date,
            project_id, customer_id, tax_treatment, tax_code_id, subtotal,
            discount, tax_amount, retention_amount, total, notes, entry_id,
            term_id, quotation_id)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9::tax_treatment,
                 $10, $11::numeric, $12::numeric, $13::numeric, $14::numeric,
                 $15::numeric, $16, $17, $18, $19)
         RETURNING id`,
        [
          ctx.orgId,
          documentNo,
          year,
          seq,
          input.invoiceDate,
          input.dueDate,
          input.projectId ?? null,
          input.customerId,
          input.taxTreatment,
          input.taxCodeId ?? null,
          toDbNumeric(built.subtotal),
          toDbNumeric(input.discount ?? 0n),
          toDbNumeric(built.vat),
          toDbNumeric(built.retention),
          toDbNumeric(built.total),
          input.notes ?? null,
          posted.id,
          input.termId ?? null,
          input.quotationId ?? null,
        ],
      );
      const invoiceId = inserted.rows[0]?.id;
      if (!invoiceId) {
        throw new DomainError("Gagal menyimpan invoice. Coba lagi.");
      }
      if (input.termId) {
        await client.query(
          `UPDATE project_terms
           SET invoice_id = $3, status = 'SUDAH_DIFAKTURKAN'
           WHERE org_id = $1 AND id = $2 AND invoice_id IS NULL`,
          [ctx.orgId, input.termId, invoiceId],
        );
      }
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        if (!item) continue;
        await client.query(
          `INSERT INTO sales_invoice_items
             (invoice_id, line_no, description, project_id, account_id,
              quantity, unit_price, amount)
           VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric)`,
          [
            invoiceId,
            i + 1,
            item.description,
            item.projectId ?? input.projectId ?? null,
            item.accountId,
            item.quantity,
            toDbNumeric(item.unitPrice),
            toDbNumeric(item.amount),
          ],
        );
      }
      await recordAudit(
        ctx,
        "INVOICE_POSTED",
        "sales_invoice",
        invoiceId,
        null,
        { documentNo, entryNo: posted.entryNo, total: toDbNumeric(built.total) },
        client,
      );
      return { id: invoiceId, documentNo, entryNo: posted.entryNo };
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      throw new DomainError(
        "Termin ini sudah punya invoice aktif. Satu termin hanya boleh satu invoice.",
      );
    }
    toDomainError(error);
  }
}

async function invoiceArBuckets(
  client: PoolClient,
  ctx: OrgContext,
  invoiceId: string,
  piutangAccountId: string,
): Promise<{ buckets: Array<{ projectId: string | null; amount: Money }>; remaining: Money; customerId: string; entryId: string }> {
  const invoice = await client.query<{
    customer_id: string;
    entry_id: string | null;
    total: string;
  }>(
    `SELECT customer_id, entry_id, total::text
     FROM sales_invoices
     WHERE org_id = $1 AND id = $2`,
    [ctx.orgId, invoiceId],
  );
  const row = invoice.rows[0];
  if (!row?.entry_id) {
    throw new DomainError("Invoice tidak ditemukan atau belum terposting.");
  }

  const original = await client.query<{ project_id: string | null; amount: string }>(
    `SELECT project_id, SUM(debit - credit)::text AS amount
     FROM journal_lines
     WHERE org_id = $1 AND entry_id = $2 AND account_id = $3
     GROUP BY project_id`,
    [ctx.orgId, row.entry_id, piutangAccountId],
  );
  const buckets = original.rows.map((item) => ({
    projectId: item.project_id,
    amount: fromDbNumeric(item.amount),
  }));
  const originalTotal = buckets.reduce((sum, item) => sum + item.amount, 0n);

  const paid = await client.query<{ paid: string }>(
    `SELECT COALESCE(SUM(a.amount), 0)::text AS paid
     FROM payment_allocations a
     JOIN payments p ON p.id = a.payment_id
     WHERE p.org_id = $1 AND a.invoice_id = $2`,
    [ctx.orgId, invoiceId],
  );
  const paidAmount = fromDbNumeric(paid.rows[0]?.paid ?? "0");
  const remaining = originalTotal - paidAmount;
  const paidParts = allocateByWeights(
    paidAmount,
    buckets.map((item) => item.amount),
  );
  const remainingBuckets = buckets
    .map((item, index) => ({
      projectId: item.projectId,
      amount: item.amount - (paidParts[index] ?? 0n),
    }))
    .filter((item) => item.amount > 0n);
  return {
    buckets: remainingBuckets.length > 0 ? remainingBuckets : buckets,
    remaining,
    customerId: row.customer_id,
    entryId: row.entry_id,
  };
}

export async function receiveInvoicePayment(
  ctx: OrgContext,
  input: {
    paymentDate: string;
    invoiceId: string;
    cashAccountId: string;
    allocated: Money;
    notes?: string | null;
    withholding?: {
      taxCodeId: string;
      amount: Money;
      projectId?: string | null;
    } | null;
  },
): Promise<{ id: string; paymentNo: string; entryNo: string }> {
  try {
    const piutang = await withOrg(ctx, (c) =>
      accountRole(c, ctx.orgId, "PIUTANG_USAHA"),
    );
    const prepaid = await withOrg(ctx, (c) =>
      accountRole(c, ctx.orgId, "PAJAK_DIBAYAR_DIMUKA"),
    );

    const snapshot = await withOrg(ctx, (c) =>
      invoiceArBuckets(c, ctx, input.invoiceId, piutang),
    );
    if (input.allocated > snapshot.remaining) {
      throw new DomainError(
        "Pelunasan melebihi sisa piutang. Kurangi nilai pembayaran atau pilih invoice lain.",
      );
    }

    const cashCoa = await withOrg(ctx, async (c) => {
      const found = await c.query<{ account_id: string; cash_id: string }>(
        `SELECT account_id, id AS cash_id FROM cash_accounts
         WHERE org_id = $1 AND account_id = $2`,
        [ctx.orgId, input.cashAccountId],
      );
      const row = found.rows[0];
      if (!row) {
        throw new DomainError(
          "Rekening kas/bank belum terdaftar di Kas & Bank. Pilih rekening yang sudah didaftarkan.",
        );
      }
      return row;
    });

    const draft = buildReceivePaymentEntry({
      entryDate: input.paymentDate,
      memo: input.notes ?? null,
      customerId: snapshot.customerId,
      cashAccountId: cashCoa.account_id,
      piutangAccountId: piutang,
      prepaidTaxAccountId: prepaid,
      allocated: input.allocated,
      arBuckets: snapshot.buckets,
      withholding: input.withholding
        ? {
            amount: input.withholding.amount,
            projectId: input.withholding.projectId ?? null,
            taxCodeId: input.withholding.taxCodeId,
          }
        : null,
    });

    const posted = await postEntry(ctx, draft);
    const withholdingAmount = input.withholding?.amount ?? 0n;
    const cashAmount = input.allocated - withholdingAmount;

    return withOrg(ctx, async (client) => {
      const year = Number(input.paymentDate.slice(0, 4));
      const seq = await nextNumber(client, ctx.orgId, "TP", year);
      const paymentNo = `TP-${year}-${String(seq).padStart(4, "0")}`;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO payments
           (org_id, payment_no, payment_date, direction, cash_account_id,
            contact_id, gross_amount, cash_amount, notes, entry_id)
         VALUES ($1, $2, $3::date, 'MASUK', $4, $5, $6::numeric, $7::numeric, $8, $9)
         RETURNING id`,
        [
          ctx.orgId,
          paymentNo,
          input.paymentDate,
          cashCoa.cash_id,
          snapshot.customerId,
          toDbNumeric(input.allocated),
          toDbNumeric(cashAmount),
          input.notes ?? null,
          posted.id,
        ],
      );
      const paymentId = inserted.rows[0]?.id;
      if (!paymentId) {
        throw new DomainError("Gagal menyimpan pembayaran. Coba lagi.");
      }
      await client.query(
        `INSERT INTO payment_allocations (payment_id, invoice_id, amount)
         VALUES ($1, $2, $3::numeric)`,
        [paymentId, input.invoiceId, toDbNumeric(input.allocated)],
      );
      if (input.withholding) {
        await client.query(
          `INSERT INTO payment_withholdings
             (payment_id, tax_code_id, base_amount, rate_percent, amount)
           VALUES ($1, $2, $3::numeric, 0, $4::numeric)`,
          [
            paymentId,
            input.withholding.taxCodeId,
            toDbNumeric(input.allocated),
            toDbNumeric(input.withholding.amount),
          ],
        );
      }
      await recordAudit(
        ctx,
        "PAYMENT_POSTED",
        "payment",
        paymentId,
        null,
        { paymentNo, entryNo: posted.entryNo },
        client,
      );
      return { id: paymentId, paymentNo, entryNo: posted.entryNo };
    });
  } catch (error) {
    toDomainError(error);
  }
}

export type InvoiceListRow = {
  id: string;
  document_no: string;
  invoice_date: string;
  due_date: string;
  customer_name: string;
  total: string;
  paid: string;
  status: string;
};

export async function listSalesInvoices(
  ctx: OrgContext,
): Promise<InvoiceListRow[]> {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{
      id: string;
      document_no: string;
      invoice_date: string;
      due_date: string;
      customer_name: string;
      total: string;
      paid: string;
    }>(
      `SELECT i.id, i.document_no, i.invoice_date::text, i.due_date::text,
              c.name AS customer_name, i.total::text,
              COALESCE(SUM(a.amount), 0)::text AS paid
       FROM sales_invoices i
       JOIN contacts c ON c.id = i.customer_id
       LEFT JOIN payment_allocations a ON a.invoice_id = i.id
       WHERE i.org_id = $1
       GROUP BY i.id, c.name
       ORDER BY i.invoice_date DESC, i.document_no DESC`,
      [ctx.orgId],
    );
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());
    return result.rows.map((row) => {
      const total = fromDbNumeric(row.total);
      const paid = fromDbNumeric(row.paid);
      let status = "BELUM_DIBAYAR";
      if (paid >= total && total > 0n) status = "LUNAS";
      else if (paid > 0n) status = "SEBAGIAN";
      else if (row.due_date < today) status = "JATUH_TEMPO";
      return { ...row, status };
    });
  });
}
