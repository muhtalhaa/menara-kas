import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { requireSession } from "@/lib/server/auth";
import { pool } from "@/lib/db/client";
import { CompanySettingsForm } from "./company-form";
import { Notice } from "@/components/ui/notice";

export default async function PerusahaanSettingsPage() {
  const session = await requireSession();

  if (session.role !== "OWNER") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-ink">
          <Emoji>{emoji.pengaturan}</Emoji>
          Pengaturan Perusahaan
        </h1>
        <Notice
          tone="error"
          message="Hanya Owner yang boleh mengubah profil perusahaan."
          dismissible={false}
        />
      </div>
    );
  }

  const result = await pool.query<{
    name: string;
    company_code: string;
    npwp: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    bank_account_label: string | null;
  }>(
    `SELECT name, company_code, npwp, address, phone, email, bank_account_label
     FROM organizations WHERE id = $1`,
    [session.orgId],
  );
  const org = result.rows[0];
  if (!org) {
    return (
      <Notice
        tone="error"
        message="Data perusahaan tidak ditemukan. Muat ulang halaman atau masuk kembali."
        dismissible={false}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Profil cetak dokumen
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.pengaturan}</Emoji>
        Pengaturan Perusahaan
      </h1>
      <CompanySettingsForm
        initial={{
          name: org.name,
          companyCode: org.company_code,
          npwp: org.npwp ?? "",
          address: org.address ?? "",
          phone: org.phone ?? "",
          email: org.email ?? "",
          bankAccountLabel: org.bank_account_label ?? "",
        }}
      />
    </div>
  );
}
