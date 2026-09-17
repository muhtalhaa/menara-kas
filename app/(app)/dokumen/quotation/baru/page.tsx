import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { requireSession } from "@/lib/server/auth";
import { listContacts, listProjects } from "@/lib/repositories/masters";
import { QuotationForm } from "../../quotation-form";

export default async function QuotationBaruPage() {
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const [contacts, projects] = await Promise.all([
    listContacts(ctx),
    listProjects(ctx),
  ]);

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Quotation baru
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.cetak}</Emoji>
        Buat Quotation
      </h1>
      <QuotationForm
        customers={contacts
          .filter((row) => row.is_customer)
          .map((row) => ({ id: row.id, label: row.name }))}
        projects={projects.map((row) => ({
          id: row.id,
          label: `${row.code} ${row.name}`,
        }))}
      />
    </div>
  );
}
