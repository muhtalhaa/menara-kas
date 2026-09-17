"use server";

import { z } from "zod";
import { defineAction } from "@/lib/server/action";
import { DomainError } from "@/lib/server/errors";
import { parseMoneyField } from "@/lib/accounting/money";
import {
  createPerformanceBond,
  createProjectTerm,
  updateProjectStatus,
} from "@/lib/repositories/project-ops";
import { postSalesInvoice } from "@/lib/repositories/invoices";

export const updateProjectStatusAction = defineAction({
  input: z.object({
    projectId: z.string().min(1),
    status: z.enum([
      "QUOTATION",
      "BERJALAN",
      "SERAH_TERIMA",
      "INVOICING",
      "SELESAI",
      "DIBATALKAN",
    ]),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN", "MANAJER_PROJECT"],
  handler: async (input, ctx) =>
    updateProjectStatus(ctx, input.projectId, input.status),
});

export const createTermAction = defineAction({
  input: z.object({
    projectId: z.string().min(1),
    termNo: z.number().int().min(1),
    name: z.string().min(1, "Nama termin wajib diisi."),
    percent: z.number().optional(),
    amount: z.string().min(1, "Nilai termin wajib diisi."),
    plannedDate: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => {
    let amount = 0n;
    try {
      amount = parseMoneyField(input.amount);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nilai tidak bisa dibaca.";
      throw new DomainError(message);
    }
    return createProjectTerm(ctx, {
      projectId: input.projectId,
      termNo: input.termNo,
      name: input.name,
      percent: input.percent,
      amount,
      plannedDate: input.plannedDate || null,
    });
  },
});

export const createBondAction = defineAction({
  input: z.object({
    projectId: z.string().min(1),
    kind: z.enum(["PELAKSANAAN", "UANG_MUKA", "PEMELIHARAAN"]),
    bondNo: z.string().min(1, "Nomor jaminan wajib diisi."),
    issuer: z.string().min(1, "Penerbit jaminan wajib diisi."),
    amount: z.string().min(1),
    issuedOn: z.string().min(1),
    expiresOn: z.string().min(1),
    notes: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => {
    let amount = 0n;
    try {
      amount = parseMoneyField(input.amount);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nilai tidak bisa dibaca.";
      throw new DomainError(message);
    }
    return createPerformanceBond(ctx, {
      projectId: input.projectId,
      kind: input.kind,
      bondNo: input.bondNo,
      issuer: input.issuer,
      amount,
      issuedOn: input.issuedOn,
      expiresOn: input.expiresOn,
      notes: input.notes,
    });
  },
});

export const invoiceFromTermAction = defineAction({
  input: z.object({
    projectId: z.string().min(1),
    termId: z.string().min(1),
    customerId: z.string().min(1, "Project harus punya pelanggan untuk invoice."),
    accountId: z.string().min(1),
    invoiceDate: z.string().min(1),
    dueDate: z.string().min(1),
    amount: z.string().min(1),
    termName: z.string().min(1),
    taxTreatment: z.enum([
      "TERMASUK_PPN",
      "BELUM_TERMASUK_PPN",
      "NON_PPN",
    ]),
    taxCodeId: z.string().optional(),
    retentionAmount: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => {
    let amount = 0n;
    try {
      amount = parseMoneyField(input.amount);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nilai tidak bisa dibaca.";
      throw new DomainError(message);
    }
    let retentionAmount = 0n;
    if (input.retentionAmount?.trim()) {
      retentionAmount = parseMoneyField(input.retentionAmount);
    }
    return postSalesInvoice(ctx, {
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      customerId: input.customerId,
      projectId: input.projectId,
      taxTreatment: input.taxTreatment,
      taxCodeId: input.taxCodeId || null,
      notes: input.termName,
      retentionAmount,
      termId: input.termId,
      items: [
        {
          description: input.termName,
          projectId: input.projectId,
          accountId: input.accountId,
          quantity: "1",
          unitPrice: amount,
          amount,
        },
      ],
    });
  },
});
