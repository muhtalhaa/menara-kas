import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { requireSession } from "@/lib/server/auth";
import { listContacts } from "@/lib/repositories/masters";
import { CreateContactForm } from "./create-contact-form";

export default async function KontakPage() {
  const session = await requireSession();
  const contacts = await listContacts({
    orgId: session.orgId,
    userId: session.userId,
  });

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Pelanggan & vendor
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.kontak}</Emoji>
        Kontak
      </h1>

      {(session.role === "OWNER" || session.role === "ADMIN_KEUANGAN") && (
        <CreateContactForm />
      )}

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-mist-300 bg-mint p-8 text-center">
          <p className="font-hand text-[22px] text-ink-muted">
            Belum ada kontak di sini
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-mist-300">
          <table className="w-full text-sm">
            <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Peran</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-t border-mist-300">
                  <td className="px-3 py-2">{contact.code ?? "-"}</td>
                  <td className="px-3 py-2">{contact.name}</td>
                  <td className="px-3 py-2">
                    {[
                      contact.is_customer ? "Pelanggan" : null,
                      contact.is_vendor ? "Vendor" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
