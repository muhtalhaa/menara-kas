"use server";

import { z } from "zod";
import { defineAction } from "@/lib/server/action";
import { DomainError } from "@/lib/server/errors";
import { parseMoneyField } from "@/lib/accounting/money";
import {
  createBeritaAcara,
  createKwitansi,
  createQuotation,
} from "@/lib/repositories/documents";

export const createQuotationAction = defineAction({
  input: z.object({
    quoteDate: z.string().min(1),
    validUntil: z.string().optional(),
    projectId: z.string().optional(),
    customerId: z.string().min(1, "Pilih pelanggan."),
    notes: z.string().optional(),
    description: z.string().min(1),
    amount: z.string().min(1),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT"],
  handler: async (input, ctx) => {
    let amount = 0n;
    try {
      amount = parseMoneyField(input.amount);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nilai tidak bisa dibaca.";
      throw new DomainError(message);
    }
    return createQuotation(ctx, {
      quoteDate: input.quoteDate,
      validUntil: input.validUntil || null,
      projectId: input.projectId || null,
      customerId: input.customerId,
      notes: input.notes,
      items: [
        {
          description: input.description,
          quantity: "1",
          unitPrice: amount,
          amount,
        },
      ],
    });
  },
});

export const createBaAction = defineAction({
  input: z.object({
    baDate: z.string().min(1),
    projectId: z.string().min(1),
    customerId: z.string().min(1),
    description: z.string().min(1),
    acknowledgedValue: z.string().optional(),
    signatoryClient: z.string().optional(),
    signatoryOurs: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT"],
  handler: async (input, ctx) => {
    let acknowledgedValue: bigint | null = null;
    if (input.acknowledgedValue?.trim()) {
      try {
        acknowledgedValue = parseMoneyField(input.acknowledgedValue);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Nilai tidak bisa dibaca.";
        throw new DomainError(message);
      }
    }
    return createBeritaAcara(ctx, {
      baDate: input.baDate,
      projectId: input.projectId,
      customerId: input.customerId,
      description: input.description,
      acknowledgedValue,
      signatoryClient: input.signatoryClient,
      signatoryOurs: input.signatoryOurs,
    });
  },
});

export const createKwitansiAction = defineAction({
  input: z.object({
    kwDate: z.string().min(1),
    contactId: z.string().min(1, "Pilih kontak."),
    projectId: z.string().optional(),
    description: z.string().min(1),
    amount: z.string().min(1),
    paymentMethod: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT"],
  handler: async (input, ctx) => {
    let amount = 0n;
    try {
      amount = parseMoneyField(input.amount);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nilai tidak bisa dibaca.";
      throw new DomainError(message);
    }
    return createKwitansi(ctx, {
      kwDate: input.kwDate,
      contactId: input.contactId,
      projectId: input.projectId || null,
      description: input.description,
      amount,
      paymentMethod: input.paymentMethod,
    });
  },
});
