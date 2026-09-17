"use server";

import { z } from "zod";
import { defineAction } from "@/lib/server/action";
import { DomainError } from "@/lib/server/errors";
import { parseMoneyField } from "@/lib/accounting/money";
import { payPurchaseBill, postPurchaseBill } from "@/lib/repositories/bills";

export const postBillAction = defineAction({
  input: z.object({
    billDate: z.string().min(1, "Tanggal tagihan wajib diisi."),
    dueDate: z.string().min(1, "Tanggal jatuh tempo wajib diisi."),
    vendorId: z.string().min(1, "Pilih vendor."),
    projectId: z.string().optional(),
    taxTreatment: z.enum([
      "TERMASUK_PPN",
      "BELUM_TERMASUK_PPN",
      "NON_PPN",
    ]),
    taxCodeId: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(
      z.object({
        description: z.string().min(1, "Uraian item wajib diisi."),
        projectId: z.string().optional(),
        accountId: z.string().min(1, "Pilih akun beban atau aset."),
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
    return postPurchaseBill(ctx, {
      billDate: input.billDate,
      dueDate: input.dueDate,
      vendorId: input.vendorId,
      projectId: input.projectId || null,
      taxTreatment: input.taxTreatment,
      taxCodeId: input.taxCodeId || null,
      notes: input.notes,
      items,
    });
  },
});

export const payBillAction = defineAction({
  input: z.object({
    paymentDate: z.string().min(1, "Tanggal pembayaran wajib diisi."),
    billId: z.string().min(1),
    cashAccountId: z.string().min(1, "Pilih kas/bank."),
    allocated: z.string().min(1, "Nilai pembayaran wajib diisi."),
    notes: z.string().optional(),
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
    return payPurchaseBill(ctx, {
      paymentDate: input.paymentDate,
      billId: input.billId,
      cashAccountId: input.cashAccountId,
      allocated,
      notes: input.notes,
    });
  },
});
