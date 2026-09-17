import type { PoolClient } from "pg";

type SeedAccount = {
  accountNo: string;
  name: string;
  group:
    | "ASET"
    | "LIABILITAS"
    | "EKUITAS"
    | "PENDAPATAN"
    | "BEBAN_POKOK_PROJECT"
    | "BEBAN_OPERASIONAL"
    | "LAIN_LAIN";
  normal: "DEBIT" | "KREDIT";
  cashFlow?: "OPERASI" | "INVESTASI" | "PENDANAAN" | "BUKAN_ARUS_KAS";
  isCash?: boolean;
  isPostable?: boolean;
  isSystem?: boolean;
  role?: string;
};

const KONSTRUKSI: SeedAccount[] = [
  { accountNo: "1-1000", name: "Aset Lancar", group: "ASET", normal: "DEBIT", isPostable: false },
  { accountNo: "1-1100", name: "Kas", group: "ASET", normal: "DEBIT", isCash: true, isSystem: true },
  { accountNo: "1-1200", name: "Bank", group: "ASET", normal: "DEBIT", isCash: true, isSystem: true },
  { accountNo: "1-1300", name: "Piutang Usaha", group: "ASET", normal: "DEBIT", isSystem: true, role: "PIUTANG_USAHA" },
  { accountNo: "1-1400", name: "Piutang Retensi", group: "ASET", normal: "DEBIT", isSystem: true, role: "PIUTANG_RETENSI" },
  { accountNo: "1-1450", name: "Pajak Dibayar Dimuka PPh", group: "ASET", normal: "DEBIT", isSystem: true },
  { accountNo: "1-1500", name: "PPN Masukan", group: "ASET", normal: "DEBIT", isSystem: true, role: "PPN_MASUKAN" },
  { accountNo: "2-1000", name: "Liabilitas Lancar", group: "LIABILITAS", normal: "KREDIT", isPostable: false },
  { accountNo: "2-1100", name: "Utang Usaha", group: "LIABILITAS", normal: "KREDIT", isSystem: true, role: "UTANG_USAHA" },
  { accountNo: "2-1310", name: "Utang PPN Keluaran", group: "LIABILITAS", normal: "KREDIT", isSystem: true, role: "PPN_KELUARAN" },
  { accountNo: "3-1100", name: "Modal Disetor", group: "EKUITAS", normal: "KREDIT", isSystem: true },
  { accountNo: "3-3000", name: "Laba Ditahan", group: "EKUITAS", normal: "KREDIT", isSystem: true, role: "LABA_DITAHAN" },
  { accountNo: "3-3100", name: "Ikhtisar Laba Rugi", group: "EKUITAS", normal: "KREDIT", isSystem: true, role: "IKHTISAR_LABA_RUGI" },
  { accountNo: "4-1100", name: "Pendapatan Jasa Konstruksi", group: "PENDAPATAN", normal: "KREDIT" },
  { accountNo: "5-1100", name: "Biaya Material", group: "BEBAN_POKOK_PROJECT", normal: "DEBIT" },
  { accountNo: "5-1200", name: "Biaya Upah Tukang", group: "BEBAN_POKOK_PROJECT", normal: "DEBIT" },
  { accountNo: "5-1300", name: "Biaya Subkontraktor", group: "BEBAN_POKOK_PROJECT", normal: "DEBIT" },
  { accountNo: "6-1100", name: "Gaji Kantor", group: "BEBAN_OPERASIONAL", normal: "DEBIT" },
  { accountNo: "6-2100", name: "Beban Sewa Kantor", group: "BEBAN_OPERASIONAL", normal: "DEBIT" },
  { accountNo: "7-2100", name: "Beban Administrasi Bank", group: "LAIN_LAIN", normal: "DEBIT" },
];

const KONSULTAN: SeedAccount[] = [
  ...KONSTRUKSI.filter((a) => !a.accountNo.startsWith("4-") && !a.accountNo.startsWith("5-")),
  { accountNo: "4-1100", name: "Pendapatan Jasa Konsultan", group: "PENDAPATAN", normal: "KREDIT" },
  { accountNo: "5-1100", name: "Biaya Tenaga Ahli", group: "BEBAN_POKOK_PROJECT", normal: "DEBIT" },
  { accountNo: "5-1200", name: "Biaya Perjalanan Project", group: "BEBAN_POKOK_PROJECT", normal: "DEBIT" },
];

function sortKey(accountNo: string): string {
  return accountNo.replace("-", ".");
}

export async function seedChartOfAccounts(
  client: PoolClient,
  orgId: string,
  template: "konstruksi" | "konsultan" | "kosong",
): Promise<void> {
  if (template === "kosong") return;

  const rows = template === "konstruksi" ? KONSTRUKSI : KONSULTAN;
  const idByNo = new Map<string, string>();

  for (const row of rows) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO accounts
         (org_id, account_no, name, "group", normal_balance, cash_flow_class,
          depth, is_postable, is_cash, is_system, sort_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        orgId,
        row.accountNo,
        row.name,
        row.group,
        row.normal,
        row.cashFlow ?? "OPERASI",
        row.accountNo.endsWith("000") && !row.isPostable ? 1 : 2,
        row.isPostable ?? true,
        row.isCash ?? false,
        row.isSystem ?? false,
        sortKey(row.accountNo),
      ],
    );
    idByNo.set(row.accountNo, inserted.rows[0]!.id);
  }

  for (const row of rows) {
    if (!row.role) continue;
    const accountId = idByNo.get(row.accountNo);
    if (!accountId) continue;
    await client.query(
      `INSERT INTO account_roles (org_id, role, account_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, role) DO UPDATE SET account_id = EXCLUDED.account_id`,
      [orgId, row.role, accountId],
    );
  }

  const kasId = idByNo.get("1-1100");
  if (kasId) {
    await client.query(
      `INSERT INTO cash_accounts (org_id, account_id, label)
       VALUES ($1, $2, 'Kas Kecil')`,
      [orgId, kasId],
    );
  }

  const ppnKeluaran = idByNo.get("2-1310");
  const ppnMasukan = idByNo.get("1-1500");
  if (ppnKeluaran) {
    const tax = await client.query<{ id: string }>(
      `INSERT INTO tax_codes (org_id, code, name, kind, account_id)
       VALUES ($1, 'PPN_KELUARAN', 'PPN Keluaran', 'PPN_KELUARAN', $2)
       RETURNING id`,
      [orgId, ppnKeluaran],
    );
    await client.query(
      `INSERT INTO tax_rates (tax_code_id, rate_percent, valid_from)
       VALUES ($1, 11, CURRENT_DATE)`,
      [tax.rows[0]!.id],
    );
  }
  if (ppnMasukan) {
    const tax = await client.query<{ id: string }>(
      `INSERT INTO tax_codes (org_id, code, name, kind, account_id)
       VALUES ($1, 'PPN_MASUKAN', 'PPN Masukan', 'PPN_MASUKAN', $2)
       RETURNING id`,
      [orgId, ppnMasukan],
    );
    await client.query(
      `INSERT INTO tax_rates (tax_code_id, rate_percent, valid_from)
       VALUES ($1, 11, CURRENT_DATE)`,
      [tax.rows[0]!.id],
    );
  }
}
