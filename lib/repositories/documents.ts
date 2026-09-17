import type { PoolClient } from "pg";
import { withOrg, type OrgContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/server/errors";
import { recordAudit } from "@/lib/server/audit";
import { toDbNumeric, type Money } from "@/lib/accounting/money";
import { formatDocumentNo } from "@/lib/accounting/posting/document-no";
import { nextNumber, toDomainError } from "@/lib/repositories/numbering";
import { postgresCode } from "@/lib/server/pg-error";

async function companyProfile(client: PoolClient, orgId: string) {
  const result = await client.query<{
    name: string;
    company_code: string;
    address: string | null;
    npwp: string | null;
    phone: string | null;
    email: string | null;
    bank_account_label: string | null;
  }>(
    `SELECT name, company_code, address, npwp, phone, email, bank_account_label
     FROM organizations WHERE id = $1`,
    [orgId],
  );
  const row = result.rows[0];
  if (!row) throw new DomainError("Perusahaan tidak ditemukan.");
  return row;
}

export async function createQuotation(
  ctx: OrgContext,
  input: {
    quoteDate: string;
    validUntil?: string | null;
    projectId?: string | null;
    customerId: string;
    notes?: string | null;
    discount?: Money;
    taxAmount?: Money;
    items: Array<{
      description: string;
      quantity: string;
      unitPrice: Money;
      amount: Money;
    }>;
  },
): Promise<{ id: string; documentNo: string }> {
  if (!input.customerId) {
    throw new DomainError("Quotation wajib punya pelanggan.");
  }
  if (input.items.length === 0) {
    throw new DomainError("Quotation wajib punya minimal satu item.");
  }
  try {
    return await withOrg(ctx, async (client) => {
      const org = await companyProfile(client, ctx.orgId);
      const year = Number(input.quoteDate.slice(0, 4));
      const month = Number(input.quoteDate.slice(5, 7));
      const seq = await nextNumber(client, ctx.orgId, "QT", year);
      const documentNo = formatDocumentNo({
        seq,
        prefix: "QT",
        companyCode: org.company_code,
        month,
        year,
      });
      const subtotal = input.items.reduce((sum, item) => sum + item.amount, 0n);
      const discount = input.discount ?? 0n;
      const taxAmount = input.taxAmount ?? 0n;
      const total = subtotal - discount + taxAmount;

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO quotations
           (org_id, document_no, seq_year, seq_no, quote_date, valid_until,
            project_id, customer_id, status, subtotal, discount, tax_amount, total, notes)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, 'DRAFT',
                 $9::numeric, $10::numeric, $11::numeric, $12::numeric, $13)
         RETURNING id`,
        [
          ctx.orgId,
          documentNo,
          year,
          seq,
          input.quoteDate,
          input.validUntil ?? null,
          input.projectId ?? null,
          input.customerId,
          toDbNumeric(subtotal),
          toDbNumeric(discount),
          toDbNumeric(taxAmount),
          toDbNumeric(total),
          input.notes ?? null,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new DomainError("Gagal menyimpan quotation.");
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i]!;
        await client.query(
          `INSERT INTO quotation_items
             (quotation_id, line_no, description, quantity, unit_price, amount)
           VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::numeric)`,
          [
            id,
            i + 1,
            item.description,
            item.quantity,
            toDbNumeric(item.unitPrice),
            toDbNumeric(item.amount),
          ],
        );
      }
      await recordAudit(
        ctx,
        "QUOTATION_CREATED",
        "quotation",
        id,
        null,
        { documentNo },
        client,
      );
      return { id, documentNo };
    });
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new DomainError("Nomor quotation bentrok. Coba simpan lagi.");
    }
    toDomainError(error);
  }
}

export async function createBeritaAcara(
  ctx: OrgContext,
  input: {
    baDate: string;
    projectId: string;
    customerId: string;
    description: string;
    acknowledgedValue?: Money | null;
    invoiceId?: string | null;
    signatoryClient?: string | null;
    signatoryOurs?: string | null;
    notes?: string | null;
  },
): Promise<{ id: string; documentNo: string }> {
  if (!input.projectId || !input.customerId) {
    throw new DomainError("Berita Acara wajib punya project dan pelanggan.");
  }
  if (!input.description.trim()) {
    throw new DomainError("Uraian Berita Acara wajib diisi.");
  }
  try {
    return await withOrg(ctx, async (client) => {
      const org = await companyProfile(client, ctx.orgId);
      const year = Number(input.baDate.slice(0, 4));
      const month = Number(input.baDate.slice(5, 7));
      const seq = await nextNumber(client, ctx.orgId, "BA", year);
      const documentNo = formatDocumentNo({
        seq,
        prefix: "BA",
        companyCode: org.company_code,
        month,
        year,
      });
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO berita_acara
           (org_id, document_no, seq_year, seq_no, ba_date, project_id, customer_id,
            invoice_id, description, acknowledged_value, signatory_client,
            signatory_ours, status, notes)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10::numeric, $11, $12, 'DITERBITKAN', $13)
         RETURNING id`,
        [
          ctx.orgId,
          documentNo,
          year,
          seq,
          input.baDate,
          input.projectId,
          input.customerId,
          input.invoiceId ?? null,
          input.description.trim(),
          input.acknowledgedValue != null
            ? toDbNumeric(input.acknowledgedValue)
            : null,
          input.signatoryClient ?? null,
          input.signatoryOurs ?? null,
          input.notes ?? null,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new DomainError("Gagal menyimpan Berita Acara.");
      await recordAudit(
        ctx,
        "BA_CREATED",
        "berita_acara",
        id,
        null,
        { documentNo },
        client,
      );
      return { id, documentNo };
    });
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new DomainError("Nomor Berita Acara bentrok. Coba simpan lagi.");
    }
    toDomainError(error);
  }
}

export async function createKwitansi(
  ctx: OrgContext,
  input: {
    kwDate: string;
    contactId: string;
    projectId?: string | null;
    paymentId?: string | null;
    description: string;
    amount: Money;
    paymentMethod?: string | null;
  },
): Promise<{ id: string; documentNo: string }> {
  if (!input.contactId) {
    throw new DomainError("Kwitansi wajib punya kontak pembayar.");
  }
  if (input.amount <= 0n) {
    throw new DomainError(
      "Nilai kwitansi harus lebih dari nol. Masukkan jumlah yang diterima.",
    );
  }
  if (!input.description.trim()) {
    throw new DomainError("Uraian kwitansi wajib diisi.");
  }
  try {
    return await withOrg(ctx, async (client) => {
      const org = await companyProfile(client, ctx.orgId);
      const year = Number(input.kwDate.slice(0, 4));
      const month = Number(input.kwDate.slice(5, 7));
      const seq = await nextNumber(client, ctx.orgId, "KW", year);
      const documentNo = formatDocumentNo({
        seq,
        prefix: "KW",
        companyCode: org.company_code,
        month,
        year,
      });
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO kwitansi
           (org_id, document_no, seq_year, seq_no, kw_date, project_id, contact_id,
            payment_id, description, amount, payment_method)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10::numeric, $11)
         RETURNING id`,
        [
          ctx.orgId,
          documentNo,
          year,
          seq,
          input.kwDate,
          input.projectId ?? null,
          input.contactId,
          input.paymentId ?? null,
          input.description.trim(),
          toDbNumeric(input.amount),
          input.paymentMethod ?? null,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new DomainError("Gagal menyimpan kwitansi.");
      await recordAudit(
        ctx,
        "KWITANSI_CREATED",
        "kwitansi",
        id,
        null,
        { documentNo, amount: toDbNumeric(input.amount) },
        client,
      );
      return { id, documentNo };
    });
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new DomainError("Nomor kwitansi bentrok. Coba simpan lagi.");
    }
    toDomainError(error);
  }
}

export async function listQuotations(ctx: OrgContext) {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{
      id: string;
      document_no: string;
      quote_date: string;
      customer_name: string;
      total: string;
      status: string;
    }>(
      `SELECT q.id, q.document_no, q.quote_date::text, c.name AS customer_name,
              q.total::text, q.status
       FROM quotations q
       JOIN contacts c ON c.id = q.customer_id
       WHERE q.org_id = $1
       ORDER BY q.quote_date DESC, q.document_no DESC`,
      [ctx.orgId],
    );
    return result.rows;
  });
}

export async function listBeritaAcara(ctx: OrgContext) {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{
      id: string;
      document_no: string;
      ba_date: string;
      project_code: string;
      customer_name: string;
      status: string;
    }>(
      `SELECT b.id, b.document_no, b.ba_date::text, p.code AS project_code,
              c.name AS customer_name, b.status
       FROM berita_acara b
       JOIN projects p ON p.id = b.project_id
       JOIN contacts c ON c.id = b.customer_id
       WHERE b.org_id = $1
       ORDER BY b.ba_date DESC, b.document_no DESC`,
      [ctx.orgId],
    );
    return result.rows;
  });
}

export async function listKwitansi(ctx: OrgContext) {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{
      id: string;
      document_no: string;
      kw_date: string;
      contact_name: string;
      amount: string;
    }>(
      `SELECT k.id, k.document_no, k.kw_date::text, c.name AS contact_name,
              k.amount::text
       FROM kwitansi k
       JOIN contacts c ON c.id = k.contact_id
       WHERE k.org_id = $1
       ORDER BY k.kw_date DESC, k.document_no DESC`,
      [ctx.orgId],
    );
    return result.rows;
  });
}

export type DocCompany = {
  name: string;
  companyCode: string;
  address: string | null;
  npwp: string | null;
  phone: string | null;
  email: string | null;
  bankAccountLabel: string | null;
};

export async function getQuotationPrint(
  ctx: OrgContext,
  id: string,
): Promise<{
  company: DocCompany;
  documentNo: string;
  quoteDate: string;
  validUntil: string | null;
  customerName: string;
  customerAddress: string | null;
  notes: string | null;
  subtotal: string;
  discount: string;
  taxAmount: string;
  total: string;
  items: Array<{
    lineNo: number;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
} | null> {
  return withOrg(ctx, async (client) => {
    const org = await companyProfile(client, ctx.orgId);
    const header = await client.query<{
      document_no: string;
      quote_date: string;
      valid_until: string | null;
      customer_name: string;
      customer_address: string | null;
      notes: string | null;
      subtotal: string;
      discount: string;
      tax_amount: string;
      total: string;
    }>(
      `SELECT q.document_no, q.quote_date::text, q.valid_until::text,
              c.name AS customer_name, c.address AS customer_address,
              q.notes, q.subtotal::text, q.discount::text,
              q.tax_amount::text, q.total::text
       FROM quotations q
       JOIN contacts c ON c.id = q.customer_id
       WHERE q.org_id = $1 AND q.id = $2`,
      [ctx.orgId, id],
    );
    const row = header.rows[0];
    if (!row) return null;
    const items = await client.query<{
      line_no: number;
      description: string;
      quantity: string;
      unit_price: string;
      amount: string;
    }>(
      `SELECT line_no, description, quantity::text, unit_price::text, amount::text
       FROM quotation_items WHERE quotation_id = $1 ORDER BY line_no`,
      [id],
    );
    return {
      company: {
        name: org.name,
        companyCode: org.company_code,
        address: org.address,
        npwp: org.npwp,
        phone: org.phone,
        email: org.email,
        bankAccountLabel: org.bank_account_label,
      },
      documentNo: row.document_no,
      quoteDate: row.quote_date,
      validUntil: row.valid_until,
      customerName: row.customer_name,
      customerAddress: row.customer_address,
      notes: row.notes,
      subtotal: row.subtotal,
      discount: row.discount,
      taxAmount: row.tax_amount,
      total: row.total,
      items: items.rows.map((item) => ({
        lineNo: item.line_no,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        amount: item.amount,
      })),
    };
  });
}

export async function getInvoicePrint(ctx: OrgContext, id: string) {
  return withOrg(ctx, async (client) => {
    const org = await companyProfile(client, ctx.orgId);
    const header = await client.query<{
      document_no: string;
      invoice_date: string;
      due_date: string;
      customer_name: string;
      customer_address: string | null;
      notes: string | null;
      subtotal: string;
      discount: string;
      tax_amount: string;
      retention_amount: string;
      total: string;
    }>(
      `SELECT i.document_no, i.invoice_date::text, i.due_date::text,
              c.name AS customer_name, c.address AS customer_address,
              i.notes, i.subtotal::text, i.discount::text,
              i.tax_amount::text, i.retention_amount::text, i.total::text
       FROM sales_invoices i
       JOIN contacts c ON c.id = i.customer_id
       WHERE i.org_id = $1 AND i.id = $2`,
      [ctx.orgId, id],
    );
    const row = header.rows[0];
    if (!row) return null;
    const items = await client.query<{
      line_no: number;
      description: string;
      quantity: string;
      unit_price: string;
      amount: string;
    }>(
      `SELECT line_no, description, quantity::text, unit_price::text, amount::text
       FROM sales_invoice_items WHERE invoice_id = $1 ORDER BY line_no`,
      [id],
    );
    return {
      company: {
        name: org.name,
        companyCode: org.company_code,
        address: org.address,
        npwp: org.npwp,
        phone: org.phone,
        email: org.email,
        bankAccountLabel: org.bank_account_label,
      },
      documentNo: row.document_no,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      customerName: row.customer_name,
      customerAddress: row.customer_address,
      notes: row.notes,
      subtotal: row.subtotal,
      discount: row.discount,
      taxAmount: row.tax_amount,
      retentionAmount: row.retention_amount,
      total: row.total,
      items: items.rows.map((item) => ({
        lineNo: item.line_no,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        amount: item.amount,
      })),
    };
  });
}

export async function getBaPrint(ctx: OrgContext, id: string) {
  return withOrg(ctx, async (client) => {
    const org = await companyProfile(client, ctx.orgId);
    const row = await client.query<{
      document_no: string;
      ba_date: string;
      project_code: string;
      project_name: string;
      customer_name: string;
      description: string;
      acknowledged_value: string | null;
      signatory_client: string | null;
      signatory_ours: string | null;
      notes: string | null;
    }>(
      `SELECT b.document_no, b.ba_date::text, p.code AS project_code, p.name AS project_name,
              c.name AS customer_name, b.description, b.acknowledged_value::text,
              b.signatory_client, b.signatory_ours, b.notes
       FROM berita_acara b
       JOIN projects p ON p.id = b.project_id
       JOIN contacts c ON c.id = b.customer_id
       WHERE b.org_id = $1 AND b.id = $2`,
      [ctx.orgId, id],
    );
    const data = row.rows[0];
    if (!data) return null;
    return {
      company: {
        name: org.name,
        companyCode: org.company_code,
        address: org.address,
        npwp: org.npwp,
        phone: org.phone,
        email: org.email,
        bankAccountLabel: org.bank_account_label,
      },
      ...data,
      acknowledgedValue: data.acknowledged_value,
    };
  });
}

export async function getKwitansiPrint(ctx: OrgContext, id: string) {
  return withOrg(ctx, async (client) => {
    const org = await companyProfile(client, ctx.orgId);
    const row = await client.query<{
      document_no: string;
      kw_date: string;
      contact_name: string;
      description: string;
      amount: string;
      payment_method: string | null;
      project_code: string | null;
    }>(
      `SELECT k.document_no, k.kw_date::text, c.name AS contact_name,
              k.description, k.amount::text, k.payment_method,
              p.code AS project_code
       FROM kwitansi k
       JOIN contacts c ON c.id = k.contact_id
       LEFT JOIN projects p ON p.id = k.project_id
       WHERE k.org_id = $1 AND k.id = $2`,
      [ctx.orgId, id],
    );
    const data = row.rows[0];
    if (!data) return null;
    return {
      company: {
        name: org.name,
        companyCode: org.company_code,
        address: org.address,
        npwp: org.npwp,
        phone: org.phone,
        email: org.email,
        bankAccountLabel: org.bank_account_label,
      },
      documentNo: data.document_no,
      kwDate: data.kw_date,
      contactName: data.contact_name,
      description: data.description,
      amount: data.amount,
      paymentMethod: data.payment_method,
      projectCode: data.project_code,
    };
  });
}

export async function getQuotationItemsForInvoice(
  ctx: OrgContext,
  quotationId: string,
) {
  return withOrg(ctx, async (client) => {
    const header = await client.query<{
      customer_id: string;
      project_id: string | null;
    }>(
      `SELECT customer_id, project_id FROM quotations
       WHERE org_id = $1 AND id = $2`,
      [ctx.orgId, quotationId],
    );
    const row = header.rows[0];
    if (!row) return null;
    const items = await client.query<{
      description: string;
      quantity: string;
      unit_price: string;
      amount: string;
    }>(
      `SELECT description, quantity::text, unit_price::text, amount::text
       FROM quotation_items WHERE quotation_id = $1 ORDER BY line_no`,
      [quotationId],
    );
    return {
      customerId: row.customer_id,
      projectId: row.project_id,
      items: items.rows,
    };
  });
}
