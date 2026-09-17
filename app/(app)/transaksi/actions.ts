"use server";

import { z } from "zod";
import { defineAction } from "@/lib/server/action";
import { DomainError } from "@/lib/server/errors";
import { parseMoneyField } from "@/lib/accounting/money";
import { buildGeneralEntry } from "@/lib/accounting/posting/build-general";
import {
  buildCashInEntry,
  buildCashOutEntry,
  buildCashTransferEntry,
} from "@/lib/accounting/posting/build-cash";
import {
  deleteDraft,
  postDraft,
  postEntry,
  reverseEntry,
  saveDraft,
  updateDraft,
} from "@/lib/repositories/entries";

const lineInput = z.object({
  accountId: z.string(),
  projectId: z.string().optional(),
  debit: z.string(),
  credit: z.string(),
  description: z.string().optional(),
});

const journalInput = z.object({
  entryDate: z.string().min(1, "Tanggal wajib diisi."),
  memo: z.string().optional(),
  source: z.enum(["JURNAL_UMUM", "JURNAL_PENYESUAIAN"]).optional(),
  lines: z.array(lineInput),
});

function parseJournalInput(input: z.infer<typeof journalInput>) {
  return buildGeneralEntry({
    entryDate: input.entryDate,
    memo: input.memo,
    source: input.source,
    lines: input.lines.map((line, index) => {
      let debit = 0n;
      let credit = 0n;
      try {
        debit = parseMoneyField(line.debit);
        credit = parseMoneyField(line.credit);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Nilai uang tidak bisa dibaca.";
        throw new DomainError(`Baris ${index + 1}: ${message}`);
      }
      return {
        accountId: line.accountId.trim(),
        projectId: line.projectId?.trim() || null,
        debit,
        credit,
        description: line.description,
      };
    }),
  });
}

export const saveJournalDraftAction = defineAction({
  input: journalInput,
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT", "MANAJER_PROJECT"],
  handler: async (input, ctx) => saveDraft(ctx, parseJournalInput(input)),
});

export const postJournalAction = defineAction({
  input: journalInput.extend({
    entryId: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => {
    const draft = parseJournalInput(input);
    if (input.entryId) {
      await updateDraft(ctx, input.entryId, draft);
      return postDraft(ctx, input.entryId);
    }
    return postEntry(ctx, draft);
  },
});

export const updateJournalDraftAction = defineAction({
  input: journalInput.extend({
    entryId: z.string().min(1, "Jurnal tidak ditemukan."),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT", "MANAJER_PROJECT"],
  handler: async (input, ctx) =>
    updateDraft(ctx, input.entryId, parseJournalInput(input)),
});

export const deleteJournalDraftAction = defineAction({
  input: z.object({ entryId: z.string().min(1) }),
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT", "MANAJER_PROJECT"],
  handler: async (input, ctx) => deleteDraft(ctx, input.entryId),
});

export const reverseJournalAction = defineAction({
  input: z.object({
    entryId: z.string().min(1),
    reversalDate: z.string().min(1, "Tanggal jurnal balik wajib diisi."),
    memo: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => reverseEntry(ctx, input),
});

const cashLineInput = z.object({
  accountId: z.string(),
  projectId: z.string().optional(),
  amount: z.string(),
  description: z.string().optional(),
});

const cashInput = z.object({
  entryDate: z.string().min(1, "Tanggal wajib diisi."),
  memo: z.string().optional(),
  cashAccountId: z.string().min(1, "Pilih akun kas atau bank."),
  contactId: z.string().optional(),
  lines: z.array(cashLineInput),
});

function parseCashInput(input: z.infer<typeof cashInput>) {
  return {
    entryDate: input.entryDate,
    memo: input.memo,
    cashAccountId: input.cashAccountId,
    contactId: input.contactId?.trim() || null,
    lines: input.lines.map((line, index) => {
      let amount = 0n;
      try {
        amount = parseMoneyField(line.amount);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Nilai uang tidak bisa dibaca.";
        throw new DomainError(`Baris ${index + 1}: ${message}`);
      }
      return {
        accountId: line.accountId.trim(),
        projectId: line.projectId?.trim() || null,
        amount,
        description: line.description,
      };
    }),
  };
}

export const saveCashOutDraftAction = defineAction({
  input: cashInput,
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT", "MANAJER_PROJECT"],
  handler: async (input, ctx) =>
    saveDraft(ctx, buildCashOutEntry(parseCashInput(input))),
});

export const postCashOutAction = defineAction({
  input: cashInput,
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) =>
    postEntry(ctx, buildCashOutEntry(parseCashInput(input))),
});

export const saveCashInDraftAction = defineAction({
  input: cashInput,
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT", "MANAJER_PROJECT"],
  handler: async (input, ctx) =>
    saveDraft(ctx, buildCashInEntry(parseCashInput(input))),
});

export const postCashInAction = defineAction({
  input: cashInput,
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) =>
    postEntry(ctx, buildCashInEntry(parseCashInput(input))),
});

const transferInput = z.object({
  entryDate: z.string().min(1, "Tanggal wajib diisi."),
  memo: z.string().optional(),
  sourceCashAccountId: z.string().min(1, "Pilih kas/bank sumber."),
  destCashAccountId: z.string().min(1, "Pilih kas/bank tujuan."),
  amount: z.string().min(1, "Nilai transfer wajib diisi."),
});

function parseTransfer(input: z.infer<typeof transferInput>) {
  let amount = 0n;
  try {
    amount = parseMoneyField(input.amount);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nilai uang tidak bisa dibaca.";
    throw new DomainError(message, { amount: message });
  }
  return buildCashTransferEntry({
    entryDate: input.entryDate,
    memo: input.memo,
    sourceCashAccountId: input.sourceCashAccountId,
    destCashAccountId: input.destCashAccountId,
    amount,
  });
}

export const saveTransferDraftAction = defineAction({
  input: transferInput,
  roles: ["OWNER", "ADMIN_KEUANGAN", "STAF_INPUT", "MANAJER_PROJECT"],
  handler: async (input, ctx) => saveDraft(ctx, parseTransfer(input)),
});

export const postTransferAction = defineAction({
  input: transferInput,
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => postEntry(ctx, parseTransfer(input)),
});

