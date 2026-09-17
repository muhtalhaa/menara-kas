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
import { buildPurchaseBillEntry } from "@/lib/accounting/posting/build-bill";
import { buildPayBillEntry } from "@/lib/accounting/posting/build-payment";
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
      "Tarif pajak tidak ditemukan untuk tanggal tagihan. Periksa kode pajak.",
    );
  }
  return rateFromNumeric(raw);
}

export async function postPurchaseBill(
  ctx: OrgContext,
  input: {
    billDate: string;
    dueDate: string;
    vendorId: string;
    projectId?: string | null;
    taxTreatment: TaxTreatment;
    taxCodeId?: string | null;
    notes?: string | null;
    discount?: Money;
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
  if (!input.vendorId) {
    throw new DomainError(
      "Tagihan wajib punya vendor. Pilih kontak vendor dulu.",
    );
  }
  try {
    const utang = await withOrg(ctx, (c) =>
      accountRole(c, ctx.orgId, "UTANG_USAHA"),
    );
    const ppn = await withOrg(ctx, (c) =>
      accountRole(c, ctx.orgId, "PPN_MASUKAN"),
    );
    const code = await withOrg(ctx, (c) => companyCode(c, ctx.orgId));
    const rate = await withOrg(ctx, (c) =>
      vatRateOnDate(c, ctx.orgId, input.taxCodeId ?? null, input.billDate),
    );

    const built = buildPurchaseBillEntry({
      entryDate: input.billDate,
      memo: input.notes ?? null,
      vendorId: input.vendorId,
      utangAccountId: utang,
      ppnMasukanAccountId: ppn,
      taxCodeId: input.taxCodeId ?? null,
      taxTreatment: input.taxTreatment,
      vatRate: rate,
      discount: input.discount ?? 0n,
      items: input.items.map((item) => ({
        accountId: item.accountId,
        projectId: item.projectId ?? input.projectId ?? null,
        amount: item.amount,
        description: item.description,
      })),
    });

    const posted = await postEntry(ctx, built.draft);

    return withOrg(ctx, async (client) => {
      const year = Number(input.billDate.slice(0, 4));
      const month = Number(input.billDate.slice(5, 7));
      const seq = await nextNumber(client, ctx.orgId, "BILL", year);
      const documentNo = formatDocumentNo({
        seq,
        prefix: "BILL",
        companyCode: code,
        month,
        year,
      });

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO purchase_bills
           (org_id, document_no, seq_year, seq_no, bill_date, due_date,
            project_id, vendor_id, tax_treatment, tax_code_id, subtotal,
            discount, tax_amount, total, notes, entry_id)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9::tax_treatment,
                 $10, $11::numeric, $12::numeric, $13::numeric, $14::numeric, $15, $16)
         RETURNING id`,
        [
          ctx.orgId,
          documentNo,
          year,
          seq,
          input.billDate,
          input.dueDate,
          input.projectId ?? null,
          input.vendorId,
          input.taxTreatment,
          input.taxCodeId ?? null,
          toDbNumeric(built.subtotal),
          toDbNumeric(input.discount ?? 0n),
          toDbNumeric(built.vat),
          toDbNumeric(built.total),
          input.notes ?? null,
          posted.id,
        ],
      );
      const billId = inserted.rows[0]?.id;
      if (!billId) {
        throw new DomainError("Gagal menyimpan tagihan. Coba lagi.");
      }
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        if (!item) continue;
        await client.query(
          `INSERT INTO purchase_bill_items
             (bill_id, line_no, description, project_id, account_id,
              quantity, unit_price, amount)
           VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric)`,
          [
            billId,
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
        "BILL_POSTED",
        "purchase_bill",
        billId,
        null,
        { documentNo, entryNo: posted.entryNo, total: toDbNumeric(built.total) },
        client,
      );
      return { id: billId, documentNo, entryNo: posted.entryNo };
    });
  } catch (error) {
    toDomainError(error);
  }
}

async function billApBuckets(
  client: PoolClient,
  ctx: OrgContext,
  billId: string,
  utangAccountId: string,
): Promise<{
  buckets: Array<{ projectId: string | null; amount: Money }>;
  remaining: Money;
  vendorId: string;
}> {
  const bill = await client.query<{
    vendor_id: string;
    entry_id: string | null;
  }>(
    `SELECT vendor_id, entry_id
     FROM purchase_bills
     WHERE org_id = $1 AND id = $2`,
    [ctx.orgId, billId],
  );
  const row = bill.rows[0];
  if (!row?.entry_id) {
    throw new DomainError("Tagihan tidak ditemukan atau belum terposting.");
  }

  const original = await client.query<{
    project_id: string | null;
    amount: string;
  }>(
    `SELECT project_id, SUM(credit - debit)::text AS amount
     FROM journal_lines
     WHERE org_id = $1 AND entry_id = $2 AND account_id = $3
     GROUP BY project_id`,
    [ctx.orgId, row.entry_id, utangAccountId],
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
     WHERE p.org_id = $1 AND a.bill_id = $2`,
    [ctx.orgId, billId],
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
    vendorId: row.vendor_id,
  };
}

export async function payPurchaseBill(
  ctx: OrgContext,
  input: {
    paymentDate: string;
    billId: string;
    cashAccountId: string;
    allocated: Money;
    notes?: string | null;
    withholding?: { taxCodeId: string; amount: Money } | null;
  },
): Promise<{ id: string; paymentNo: string; entryNo: string }> {
  try {
    const utang = await withOrg(ctx, (c) =>
      accountRole(c, ctx.orgId, "UTANG_USAHA"),
    );
    const snapshot = await withOrg(ctx, (c) =>
      billApBuckets(c, ctx, input.billId, utang),
    );
    if (input.allocated > snapshot.remaining) {
      throw new DomainError(
        "Pembayaran melebihi sisa utang. Kurangi nilai pembayaran atau pilih tagihan lain.",
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

    if (input.withholding && input.withholding.amount > 0n) {
      throw new DomainError(
        "Pemotongan PPh saat bayar tagihan belum tersedia di fase ini. Catat tanpa potongan, atau gunakan Jurnal Umum.",
      );
    }

    const draft = buildPayBillEntry({
      entryDate: input.paymentDate,
      memo: input.notes ?? null,
      vendorId: snapshot.vendorId,
      cashAccountId: cashCoa.account_id,
      utangAccountId: utang,
      withholdingPayableAccountId: null,
      allocated: input.allocated,
      apBuckets: snapshot.buckets,
      withholding: null,
    });

    const posted = await postEntry(ctx, draft);

    return withOrg(ctx, async (client) => {
      const year = Number(input.paymentDate.slice(0, 4));
      const seq = await nextNumber(client, ctx.orgId, "BT", year);
      const paymentNo = `BT-${year}-${String(seq).padStart(4, "0")}`;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO payments
           (org_id, payment_no, payment_date, direction, cash_account_id,
            contact_id, gross_amount, cash_amount, notes, entry_id)
         VALUES ($1, $2, $3::date, 'KELUAR', $4, $5, $6::numeric, $7::numeric, $8, $9)
         RETURNING id`,
        [
          ctx.orgId,
          paymentNo,
          input.paymentDate,
          cashCoa.cash_id,
          snapshot.vendorId,
          toDbNumeric(input.allocated),
          toDbNumeric(input.allocated),
          input.notes ?? null,
          posted.id,
        ],
      );
      const paymentId = inserted.rows[0]?.id;
      if (!paymentId) {
        throw new DomainError("Gagal menyimpan pembayaran tagihan. Coba lagi.");
      }
      await client.query(
        `INSERT INTO payment_allocations (payment_id, bill_id, amount)
         VALUES ($1, $2, $3::numeric)`,
        [paymentId, input.billId, toDbNumeric(input.allocated)],
      );
      await recordAudit(
        ctx,
        "BILL_PAYMENT_POSTED",
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

export type BillListRow = {
  id: string;
  document_no: string;
  bill_date: string;
  due_date: string;
  vendor_name: string;
  total: string;
  paid: string;
  status: string;
};

export async function listPurchaseBills(
  ctx: OrgContext,
): Promise<BillListRow[]> {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{
      id: string;
      document_no: string;
      bill_date: string;
      due_date: string;
      vendor_name: string;
      total: string;
      paid: string;
    }>(
      `SELECT b.id, b.document_no, b.bill_date::text, b.due_date::text,
              c.name AS vendor_name, b.total::text,
              COALESCE(SUM(a.amount), 0)::text AS paid
       FROM purchase_bills b
       JOIN contacts c ON c.id = b.vendor_id
       LEFT JOIN payment_allocations a ON a.bill_id = b.id
       WHERE b.org_id = $1
       GROUP BY b.id, c.name
       ORDER BY b.bill_date DESC, b.document_no DESC`,
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
