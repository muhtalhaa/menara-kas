"use server";

import { z } from "zod";
import { defineAction } from "@/lib/server/action";
import { DomainError } from "@/lib/server/errors";
import { parseMoneyField } from "@/lib/accounting/money";
import {
  postSalesInvoice,
  receiveInvoicePayment,
} from "@/lib/repositories/invoices";

export const postInvoiceAction = defineAction({
  input: z.object({
    invoiceDate: z.string().min(1, "Tanggal invoice wajib diisi."),
    dueDate: z.string().min(1, "Tanggal jatuh tempo wajib diisi."),
    customerId: z.string().min(1, "Pilih pelanggan."),
    projectId: z.string().optional(),
    taxTreatment: z.enum([
      "TERMASUK_PPN",
      "BELUM_TERMASUK_PPN",
      "NON_PPN",
    ]),
    taxCodeId: z.string().optional(),
    notes: z.string().optional(),
    retentionAmount: z.string().optional(),
    termId: z.string().optional(),
    quotationId: z.string().optional(),
    items: z.array(
      z.object({
        description: z.string().min(1, "Uraian item wajib diisi."),
        projectId: z.string().optional(),
        accountId: z.string().min(1, "Pilih akun pendapatan."),
        amount: z.string().min(1, "Nominal item wajib diisi."),
      }),
    ),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => {
    const items = input.items.map((item, index) => {
      let amount = 0n;
      try {
        amount = parseMoneyField(item.amount);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Nilai uang tidak bisa dibaca.";
        throw new DomainError(`Item ${index + 1}: ${message}`);
      }
      return {
        description: item.description,
        projectId: item.projectId || input.projectId || null,
        accountId: item.accountId,
        quantity: "1",
        unitPrice: amount,
        amount,
      };
    });
    return postSalesInvoice(ctx, {
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      customerId: input.customerId,
      projectId: input.projectId || null,
      taxTreatment: input.taxTreatment,
      taxCodeId: input.taxCodeId || null,
      notes: input.notes,
      retentionAmount: (() => {
        if (!input.retentionAmount?.trim()) return 0n;
        try {
          return parseMoneyField(input.retentionAmount);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Nilai retensi tidak bisa dibaca.";
          throw new DomainError(message);
        }
      })(),
      termId: input.termId || null,
      quotationId: input.quotationId || null,
      items,
    });
  },
});

export const receivePaymentAction = defineAction({
  input: z.object({
    paymentDate: z.string().min(1, "Tanggal pembayaran wajib diisi."),
    invoiceId: z.string().min(1),
    cashAccountId: z.string().min(1, "Pilih kas/bank."),
    allocated: z.string().min(1, "Nilai pelunasan wajib diisi."),
    notes: z.string().optional(),
    withholdingAmount: z.string().optional(),
    withholdingTaxCodeId: z.string().optional(),
    withholdingProjectId: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => {
    let allocated = 0n;
    try {
      allocated = parseMoneyField(input.allocated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nilai tidak bisa dibaca.";
      throw new DomainError(message, { allocated: message });
    }
    let withholdingAmount = 0n;
    if (input.withholdingAmount?.trim()) {
      try {
        withholdingAmount = parseMoneyField(input.withholdingAmount);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Nilai PPh tidak bisa dibaca.";
        throw new DomainError(message);
      }
    }
    return receiveInvoicePayment(ctx, {
      paymentDate: input.paymentDate,
      invoiceId: input.invoiceId,
      cashAccountId: input.cashAccountId,
      allocated,
      notes: input.notes,
      withholding:
        withholdingAmount > 0n && input.withholdingTaxCodeId
          ? {
              taxCodeId: input.withholdingTaxCodeId,
              amount: withholdingAmount,
              projectId: input.withholdingProjectId || null,
            }
          : null,
    });
  },
});
