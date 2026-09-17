import type { PoolClient } from "pg";
import { withOrg, type OrgContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/server/errors";
import { recordAudit } from "@/lib/server/audit";
import {
  fromDbNumeric,
  toDbNumeric,
  type Money,
} from "@/lib/accounting/money";
import { sumDebit } from "@/lib/accounting/balance";
import type { AccountGroup } from "@/lib/accounting/balance";
import {
  ENTRY_PREFIX,
  formatEntryNo,
  type AccountSnapshot,
  type DraftEntry,
  type DraftLine,
  type EntrySource,
  type EntryStatus,
} from "@/lib/accounting/posting/types";
import {
  assertAccountsPostable,
  assertCashSource,
  assertRequiredProjects,
  validateDraftEntry,
} from "@/lib/accounting/posting/validate";
import { buildReversalEntry } from "@/lib/accounting/posting/build-reversal";
import { nextNumber, toDomainError } from "@/lib/repositories/numbering";
import {
  assertPeriodOpen,
  findPeriodForDate,
} from "@/lib/repositories/periods";

export type SavedEntry = {
  id: string;
  entryNo: string;
  status: EntryStatus;
};

export type EntryListRow = {
  id: string;
  entry_no: string;
  entry_date: string;
  source: EntrySource;
  status: EntryStatus;
  memo: string | null;
  total_amount: string;
};

export type EntryDetail = {
  id: string;
  entryNo: string;
  entryDate: string;
  source: EntrySource;
  status: EntryStatus;
  memo: string | null;
  totalAmount: Money;
  reversalOfId: string | null;
  lines: Array<{
    lineNo: number;
    accountId: string;
    accountNo: string;
    accountName: string;
    projectId: string | null;
    projectCode: string | null;
    debit: Money;
    credit: Money;
    description: string | null;
  }>;
};

async function loadAccounts(
  client: PoolClient,
  orgId: string,
  accountIds: string[],
): Promise<Map<string, AccountSnapshot>> {
  if (accountIds.length === 0) return new Map();
  const result = await client.query<{
    id: string;
    account_no: string;
    name: string;
    group: AccountGroup;
    is_postable: boolean;
    is_active: boolean;
    is_cash: boolean;
  }>(
    `SELECT id, account_no, name, "group", is_postable, is_active, is_cash
     FROM accounts
     WHERE org_id = $1 AND id = ANY($2::uuid[])`,
    [orgId, accountIds],
  );
  const map = new Map<string, AccountSnapshot>();
  for (const row of result.rows) {
    map.set(row.id, {
      id: row.id,
      accountNo: row.account_no,
      name: row.name,
      group: row.group,
      isPostable: row.is_postable,
      isActive: row.is_active,
      isCash: row.is_cash,
    });
  }
  return map;
}

async function loadPostingRules(
  client: PoolClient,
  orgId: string,
): Promise<{ requireProjectGroups: AccountGroup[] }> {
  const result = await client.query<{ require_project_groups: string[] }>(
    `SELECT require_project_groups FROM organizations WHERE id = $1`,
    [orgId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new DomainError("Perusahaan tidak ditemukan.");
  }
  return {
    requireProjectGroups: row.require_project_groups.filter(
      (group): group is AccountGroup =>
        group === "PENDAPATAN" ||
        group === "BEBAN_POKOK_PROJECT" ||
        group === "BEBAN_OPERASIONAL" ||
        group === "LAIN_LAIN",
    ),
  };
}

async function insertLines(
  client: PoolClient,
  entryId: string,
  lines: DraftLine[],
): Promise<void> {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    await client.query(
      `INSERT INTO journal_lines
         (entry_id, line_no, account_id, project_id, contact_id, tax_code_id,
          debit, credit, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9)`,
      [
        entryId,
        i + 1,
        line.accountId,
        line.projectId,
        line.contactId,
        line.taxCodeId,
        toDbNumeric(line.debit),
        toDbNumeric(line.credit),
        line.description,
      ],
    );
  }
}

async function persistEntry(
  ctx: OrgContext,
  draft: DraftEntry,
  mode: "DRAFT" | "TERPOSTING",
): Promise<SavedEntry> {
  validateDraftEntry(draft);

  return withOrg(ctx, async (client) => {
    const period = await findPeriodForDate(client, ctx.orgId, draft.entryDate);
    assertPeriodOpen(period);

    const accountIds = draft.lines.map((line) => line.accountId);
    const accounts = await loadAccounts(client, ctx.orgId, accountIds);
    assertAccountsPostable(draft, accounts);
    assertCashSource(draft, accounts);
    const rules = await loadPostingRules(client, ctx.orgId);
    assertRequiredProjects(draft, accounts, rules);

    const year = Number(draft.entryDate.slice(0, 4));
    const seq = await nextNumber(
      client,
      ctx.orgId,
      ENTRY_PREFIX[draft.source],
      year,
    );
    const entryNo = formatEntryNo(ENTRY_PREFIX[draft.source], year, seq);
    const total = sumDebit(draft.lines);
    const hasCashLine = draft.lines.some((line) => {
      const account = accounts.get(line.accountId);
      return account?.isCash === true;
    });

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO journal_entries
         (org_id, entry_no, entry_date, period_id, source, status, memo,
          has_cash_line, total_amount, created_by)
       VALUES ($1, $2, $3::date, $4, $5::entry_source, 'DRAFT', $6, $7, $8::numeric, $9)
       RETURNING id`,
      [
        ctx.orgId,
        entryNo,
        draft.entryDate,
        period.id,
        draft.source,
        draft.memo,
        hasCashLine,
        toDbNumeric(total),
        ctx.userId,
      ],
    );
    const entryId = inserted.rows[0]?.id;
    if (!entryId) {
      throw new DomainError("Gagal menyimpan jurnal. Coba lagi.");
    }

    await insertLines(client, entryId, draft.lines);

    if (mode === "TERPOSTING") {
      await client.query(
        `UPDATE journal_entries
         SET status = 'TERPOSTING', posted_by = $3, posted_at = now()
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, entryId, ctx.userId],
      );
    }

    await recordAudit(
      ctx,
      mode === "TERPOSTING" ? "ENTRY_POSTED" : "ENTRY_CREATED",
      "journal_entry",
      entryId,
      null,
      { entryNo, status: mode, source: draft.source, total: toDbNumeric(total) },
      client,
    );

    return { id: entryId, entryNo, status: mode };
  });
}

export async function saveDraft(
  ctx: OrgContext,
  draft: DraftEntry,
): Promise<SavedEntry> {
  try {
    return await persistEntry(ctx, draft, "DRAFT");
  } catch (error) {
    toDomainError(error);
  }
}

export async function postEntry(
  ctx: OrgContext,
  draft: DraftEntry,
): Promise<SavedEntry> {
  try {
    return await persistEntry(ctx, draft, "TERPOSTING");
  } catch (error) {
    toDomainError(error);
  }
}

export async function updateDraft(
  ctx: OrgContext,
  entryId: string,
  draft: DraftEntry,
): Promise<SavedEntry> {
  validateDraftEntry(draft);

  try {
    return await withOrg(ctx, async (client) => {
      const existing = await client.query<{
        id: string;
        entry_no: string;
        status: EntryStatus;
      }>(
        `SELECT id, entry_no, status
         FROM journal_entries
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, entryId],
      );
      const entry = existing.rows[0];
      if (!entry) {
        throw new DomainError("Jurnal tidak ditemukan.");
      }
      if (entry.status !== "DRAFT") {
        throw new DomainError(
          `Jurnal ${entry.entry_no} sudah ${entry.status === "TERPOSTING" ? "terposting" : "dibatalkan"} dan tidak bisa diubah. Batalkan dengan jurnal balik bila perlu.`,
        );
      }

      const period = await findPeriodForDate(client, ctx.orgId, draft.entryDate);
      assertPeriodOpen(period);

      const accounts = await loadAccounts(
        client,
        ctx.orgId,
        draft.lines.map((line) => line.accountId),
      );
      assertAccountsPostable(draft, accounts);
      assertCashSource(draft, accounts);
      const rules = await loadPostingRules(client, ctx.orgId);
      assertRequiredProjects(draft, accounts, rules);

      const total = sumDebit(draft.lines);
      const hasCashLine = draft.lines.some((line) => {
        const account = accounts.get(line.accountId);
        return account?.isCash === true;
      });

      await client.query(
        `UPDATE journal_entries
         SET entry_date = $3::date, period_id = $4, memo = $5,
             has_cash_line = $6, total_amount = $7::numeric, source = $8::entry_source
         WHERE org_id = $1 AND id = $2`,
        [
          ctx.orgId,
          entryId,
          draft.entryDate,
          period.id,
          draft.memo,
          hasCashLine,
          toDbNumeric(total),
          draft.source,
        ],
      );
      await client.query(`DELETE FROM journal_lines WHERE entry_id = $1`, [
        entryId,
      ]);
      await insertLines(client, entryId, draft.lines);

      await recordAudit(
        ctx,
        "ENTRY_UPDATED",
        "journal_entry",
        entryId,
        { entryNo: entry.entry_no },
        { entryNo: entry.entry_no, total: toDbNumeric(total) },
        client,
      );

      return { id: entryId, entryNo: entry.entry_no, status: "DRAFT" };
    });
  } catch (error) {
    toDomainError(error);
  }
}

export async function postDraft(
  ctx: OrgContext,
  entryId: string,
): Promise<SavedEntry> {
  try {
    return await withOrg(ctx, async (client) => {
      const existing = await client.query<{
        id: string;
        entry_no: string;
        status: EntryStatus;
        entry_date: string;
      }>(
        `SELECT id, entry_no, status, entry_date::text
         FROM journal_entries
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, entryId],
      );
      const entry = existing.rows[0];
      if (!entry) {
        throw new DomainError("Jurnal tidak ditemukan.");
      }
      if (entry.status !== "DRAFT") {
        throw new DomainError(
          `Jurnal ${entry.entry_no} tidak bisa diposting karena statusnya ${entry.status}.`,
        );
      }

      const period = await findPeriodForDate(
        client,
        ctx.orgId,
        entry.entry_date,
      );
      assertPeriodOpen(period);

      const lineRows = await client.query<{
        account_id: string;
        project_id: string | null;
        contact_id: string | null;
        tax_code_id: string | null;
        debit: string;
        credit: string;
        description: string | null;
      }>(
        `SELECT account_id, project_id, contact_id, tax_code_id,
                debit::text, credit::text, description
         FROM journal_lines
         WHERE entry_id = $1
         ORDER BY line_no`,
        [entryId],
      );

      const draft: DraftEntry = {
        entryDate: entry.entry_date,
        source: "JURNAL_UMUM",
        memo: null,
        lines: lineRows.rows.map((row) => ({
          accountId: row.account_id,
          projectId: row.project_id,
          contactId: row.contact_id,
          taxCodeId: row.tax_code_id,
          debit: fromDbNumeric(row.debit),
          credit: fromDbNumeric(row.credit),
          description: row.description,
        })),
      };

      validateDraftEntry(draft);
      const accounts = await loadAccounts(
        client,
        ctx.orgId,
        draft.lines.map((line) => line.accountId),
      );
      assertAccountsPostable(draft, accounts);
      assertCashSource(draft, accounts);
      const rules = await loadPostingRules(client, ctx.orgId);
      assertRequiredProjects(draft, accounts, rules);

      await client.query(
        `UPDATE journal_entries
         SET status = 'TERPOSTING', posted_by = $3, posted_at = now()
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, entryId, ctx.userId],
      );

      await recordAudit(
        ctx,
        "ENTRY_POSTED",
        "journal_entry",
        entryId,
        { status: "DRAFT", entryNo: entry.entry_no },
        { status: "TERPOSTING", entryNo: entry.entry_no },
        client,
      );

      return { id: entryId, entryNo: entry.entry_no, status: "TERPOSTING" };
    });
  } catch (error) {
    toDomainError(error);
  }
}

export async function deleteDraft(
  ctx: OrgContext,
  entryId: string,
): Promise<{ entryNo: string }> {
  try {
    return await withOrg(ctx, async (client) => {
      const existing = await client.query<{
        id: string;
        entry_no: string;
        status: EntryStatus;
      }>(
        `SELECT id, entry_no, status
         FROM journal_entries
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, entryId],
      );
      const entry = existing.rows[0];
      if (!entry) {
        throw new DomainError("Jurnal tidak ditemukan.");
      }
      if (entry.status !== "DRAFT") {
        throw new DomainError(
          `Jurnal ${entry.entry_no} sudah terposting dan tidak bisa dihapus. Batalkan dengan jurnal balik.`,
        );
      }

      await client.query(
        `DELETE FROM journal_entries WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, entryId],
      );
      await recordAudit(
        ctx,
        "ENTRY_DELETED",
        "journal_entry",
        entryId,
        { entryNo: entry.entry_no, status: "DRAFT" },
        null,
        client,
      );
      return { entryNo: entry.entry_no };
    });
  } catch (error) {
    toDomainError(error);
  }
}

export async function reverseEntry(
  ctx: OrgContext,
  input: { entryId: string; reversalDate: string; memo?: string | null },
): Promise<SavedEntry> {
  try {
    return await withOrg(ctx, async (client) => {
      const existing = await client.query<{
        id: string;
        entry_no: string;
        status: EntryStatus;
        memo: string | null;
      }>(
        `SELECT id, entry_no, status, memo
         FROM journal_entries
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, input.entryId],
      );
      const original = existing.rows[0];
      if (!original) {
        throw new DomainError("Jurnal tidak ditemukan.");
      }
      if (original.status !== "TERPOSTING") {
        throw new DomainError(
          `Jurnal ${original.entry_no} tidak bisa dibalik karena statusnya bukan terposting.`,
        );
      }

      const lineRows = await client.query<{
        account_id: string;
        project_id: string | null;
        contact_id: string | null;
        tax_code_id: string | null;
        debit: string;
        credit: string;
        description: string | null;
      }>(
        `SELECT account_id, project_id, contact_id, tax_code_id,
                debit::text, credit::text, description
         FROM journal_lines
         WHERE entry_id = $1
         ORDER BY line_no`,
        [input.entryId],
      );

      const draft = buildReversalEntry({
        entryDate: input.reversalDate,
        memo:
          input.memo?.trim() ||
          `Pembalikan ${original.entry_no}${original.memo ? ` — ${original.memo}` : ""}`,
        lines: lineRows.rows.map((row) => ({
          accountId: row.account_id,
          projectId: row.project_id,
          contactId: row.contact_id,
          taxCodeId: row.tax_code_id,
          debit: fromDbNumeric(row.debit),
          credit: fromDbNumeric(row.credit),
          description: row.description,
        })),
      });

      validateDraftEntry(draft);
      const period = await findPeriodForDate(client, ctx.orgId, draft.entryDate);
      assertPeriodOpen(period);

      const accounts = await loadAccounts(
        client,
        ctx.orgId,
        draft.lines.map((line) => line.accountId),
      );
      assertAccountsPostable(draft, accounts);

      const year = Number(draft.entryDate.slice(0, 4));
      const seq = await nextNumber(
        client,
        ctx.orgId,
        ENTRY_PREFIX.JURNAL_PEMBALIK,
        year,
      );
      const entryNo = formatEntryNo(ENTRY_PREFIX.JURNAL_PEMBALIK, year, seq);
      const total = sumDebit(draft.lines);
      const hasCashLine = draft.lines.some((line) => {
        const account = accounts.get(line.accountId);
        return account?.isCash === true;
      });

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO journal_entries
           (org_id, entry_no, entry_date, period_id, source, status, memo,
            has_cash_line, total_amount, reversal_of_id, created_by)
         VALUES ($1, $2, $3::date, $4, 'JURNAL_PEMBALIK', 'DRAFT', $5, $6, $7::numeric, $8, $9)
         RETURNING id`,
        [
          ctx.orgId,
          entryNo,
          draft.entryDate,
          period.id,
          draft.memo,
          hasCashLine,
          toDbNumeric(total),
          original.id,
          ctx.userId,
        ],
      );
      const reversalId = inserted.rows[0]?.id;
      if (!reversalId) {
        throw new DomainError("Gagal membuat jurnal balik. Coba lagi.");
      }

      await insertLines(client, reversalId, draft.lines);
      await client.query(
        `UPDATE journal_entries
         SET status = 'TERPOSTING', posted_by = $3, posted_at = now()
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, reversalId, ctx.userId],
      );
      await client.query(
        `UPDATE journal_entries
         SET status = 'DIBATALKAN', posted_at = NULL
         WHERE org_id = $1 AND id = $2`,
        [ctx.orgId, original.id],
      );

      await recordAudit(
        ctx,
        "ENTRY_REVERSED",
        "journal_entry",
        original.id,
        { status: "TERPOSTING", entryNo: original.entry_no },
        { status: "DIBATALKAN", reversalEntryNo: entryNo, reversalId },
        client,
      );

      return { id: reversalId, entryNo, status: "TERPOSTING" };
    });
  } catch (error) {
    toDomainError(error);
  }
}

export async function listEntries(
  ctx: OrgContext,
): Promise<EntryListRow[]> {
  return withOrg(ctx, async (client) => {
    const result = await client.query<EntryListRow>(
      `SELECT id, entry_no, entry_date::text, source, status, memo, total_amount::text
       FROM journal_entries
       WHERE org_id = $1
       ORDER BY entry_date DESC, entry_no DESC`,
      [ctx.orgId],
    );
    return result.rows;
  });
}

export async function getEntry(
  ctx: OrgContext,
  entryId: string,
): Promise<EntryDetail | null> {
  return withOrg(ctx, async (client) => {
    const header = await client.query<{
      id: string;
      entry_no: string;
      entry_date: string;
      source: EntrySource;
      status: EntryStatus;
      memo: string | null;
      total_amount: string;
      reversal_of_id: string | null;
    }>(
      `SELECT id, entry_no, entry_date::text, source, status, memo,
              total_amount::text, reversal_of_id
       FROM journal_entries
       WHERE org_id = $1 AND id = $2`,
      [ctx.orgId, entryId],
    );
    const entry = header.rows[0];
    if (!entry) return null;

    const lines = await client.query<{
      line_no: number;
      account_id: string;
      account_no: string;
      account_name: string;
      project_id: string | null;
      project_code: string | null;
      debit: string;
      credit: string;
      description: string | null;
    }>(
      `SELECT l.line_no, l.account_id, a.account_no, a.name AS account_name,
              l.project_id, p.code AS project_code,
              l.debit::text, l.credit::text, l.description
       FROM journal_lines l
       JOIN accounts a ON a.id = l.account_id
       LEFT JOIN projects p ON p.id = l.project_id
       WHERE l.entry_id = $1 AND l.org_id = $2
       ORDER BY l.line_no`,
      [entryId, ctx.orgId],
    );

    return {
      id: entry.id,
      entryNo: entry.entry_no,
      entryDate: entry.entry_date,
      source: entry.source,
      status: entry.status,
      memo: entry.memo,
      totalAmount: fromDbNumeric(entry.total_amount),
      reversalOfId: entry.reversal_of_id,
      lines: lines.rows.map((row) => ({
        lineNo: row.line_no,
        accountId: row.account_id,
        accountNo: row.account_no,
        accountName: row.account_name,
        projectId: row.project_id,
        projectCode: row.project_code,
        debit: fromDbNumeric(row.debit),
        credit: fromDbNumeric(row.credit),
        description: row.description,
      })),
    };
  });
}
