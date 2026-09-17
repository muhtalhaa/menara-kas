import type { Money } from "../money";
import { AccountingError } from "../errors";
import { allocateByWeights } from "../allocate";
import type { DraftEntry, DraftLine } from "./types";

export type ArBucket = {
  projectId: string | null;
  amount: Money;
};

export type ReceivePaymentInput = {
  entryDate: string;
  memo?: string | null;
  customerId: string | null;
  cashAccountId: string;
  piutangAccountId: string;
  prepaidTaxAccountId: string;
  allocated: Money;
  arBuckets: ArBucket[];
  withholding: {
    amount: Money;
    projectId: string | null;
    taxCodeId: string | null;
  } | null;
};

export function buildReceivePaymentEntry(
  input: ReceivePaymentInput,
): DraftEntry {
  if (input.allocated <= 0n) {
    throw new AccountingError("Nilai pelunasan harus lebih dari nol.");
  }
  const arTotal = input.arBuckets.reduce((sum, bucket) => sum + bucket.amount, 0n);
  if (arTotal <= 0n) {
    throw new AccountingError("Tidak ada sisa piutang yang bisa dilunasi.");
  }
  if (input.allocated > arTotal) {
    throw new AccountingError(
      "Pelunasan melebihi sisa piutang. Kurangi nilai pembayaran atau pilih invoice lain.",
    );
  }

  const withholdingAmount = input.withholding?.amount ?? 0n;
  if (withholdingAmount < 0n) {
    throw new AccountingError("Nilai pemotongan PPh tidak boleh negatif.");
  }
  if (withholdingAmount >= input.allocated) {
    throw new AccountingError(
      "Pemotongan PPh tidak boleh sama atau lebih besar dari nilai pelunasan.",
    );
  }

  const cashAmount = input.allocated - withholdingAmount;
  const weights = input.arBuckets.map((bucket) => bucket.amount);
  const credits = allocateByWeights(input.allocated, weights);

  const arLines: DraftLine[] = input.arBuckets.flatMap((bucket, index) => {
    const credit = credits[index] ?? 0n;
    if (credit === 0n) return [];
    return [
      {
        accountId: input.piutangAccountId,
        projectId: bucket.projectId,
        contactId: input.customerId,
        taxCodeId: null,
        debit: 0n,
        credit,
        description: "Pelunasan piutang",
      },
    ];
  });

  const cashLine: DraftLine = {
    accountId: input.cashAccountId,
    projectId: null,
    contactId: input.customerId,
    taxCodeId: null,
    debit: cashAmount,
    credit: 0n,
    description: input.memo?.trim() || "Terima pembayaran",
  };

  const prepaidLines: DraftLine[] =
    withholdingAmount > 0n
      ? [
          {
            accountId: input.prepaidTaxAccountId,
            projectId: input.withholding?.projectId ?? null,
            contactId: input.customerId,
            taxCodeId: input.withholding?.taxCodeId ?? null,
            debit: withholdingAmount,
            credit: 0n,
            description: "PPh dipotong pelanggan",
          },
        ]
      : [];

  return {
    entryDate: input.entryDate,
    source: "TERIMA_PEMBAYARAN",
    memo: input.memo?.trim() || null,
    lines: [cashLine, ...prepaidLines, ...arLines],
  };
}

export type ApBucket = {
  projectId: string | null;
  amount: Money;
};

export function buildPayBillEntry(input: {
  entryDate: string;
  memo?: string | null;
  vendorId: string | null;
  cashAccountId: string;
  utangAccountId: string;
  withholdingPayableAccountId: string | null;
  allocated: Money;
  apBuckets: ApBucket[];
  withholding: { amount: Money; taxCodeId: string | null } | null;
}): DraftEntry {
  if (input.allocated <= 0n) {
    throw new AccountingError("Nilai pembayaran tagihan harus lebih dari nol.");
  }
  const apTotal = input.apBuckets.reduce((sum, bucket) => sum + bucket.amount, 0n);
  if (input.allocated > apTotal) {
    throw new AccountingError(
      "Pembayaran melebihi sisa utang. Kurangi nilai pembayaran atau pilih tagihan lain.",
    );
  }
  const withholdingAmount = input.withholding?.amount ?? 0n;
  if (withholdingAmount >= input.allocated) {
    throw new AccountingError(
      "Pemotongan PPh tidak boleh sama atau lebih besar dari nilai pembayaran.",
    );
  }
  const cashAmount = input.allocated - withholdingAmount;
  const weights = input.apBuckets.map((bucket) => bucket.amount);
  const debits = allocateByWeights(input.allocated, weights);

  const apLines: DraftLine[] = input.apBuckets.flatMap((bucket, index) => {
    const debit = debits[index] ?? 0n;
    if (debit === 0n) return [];
    return [
      {
        accountId: input.utangAccountId,
        projectId: bucket.projectId,
        contactId: input.vendorId,
        taxCodeId: null,
        debit,
        credit: 0n,
        description: "Pelunasan utang",
      },
    ];
  });

  const cashLine: DraftLine = {
    accountId: input.cashAccountId,
    projectId: null,
    contactId: input.vendorId,
    taxCodeId: null,
    debit: 0n,
    credit: cashAmount,
    description: input.memo?.trim() || "Bayar tagihan",
  };

  const withholdingLines: DraftLine[] =
    withholdingAmount > 0n && input.withholdingPayableAccountId
      ? [
          {
            accountId: input.withholdingPayableAccountId,
            projectId: null,
            contactId: input.vendorId,
            taxCodeId: input.withholding?.taxCodeId ?? null,
            debit: 0n,
            credit: withholdingAmount,
            description: "Utang PPh dipotong",
          },
        ]
      : [];

  return {
    entryDate: input.entryDate,
    source: "BAYAR_TAGIHAN",
    memo: input.memo?.trim() || null,
    lines: [...apLines, cashLine, ...withholdingLines],
  };
}
