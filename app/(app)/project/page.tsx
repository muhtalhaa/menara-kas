import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { requireSession } from "@/lib/server/auth";
import { listProjects } from "@/lib/repositories/masters";
import { CreateProjectForm } from "./create-project-form";
import { formatRupiah, fromDbNumeric } from "@/lib/accounting/money";

export default async function ProjectPage() {
  const session = await requireSession();
  const projects = await listProjects({
    orgId: session.orgId,
    userId: session.userId,
  });

  return (
    <div className="space-y-4">
      <p className="font-hand text-[20px] font-semibold text-teal-600">
        Portofolio project
      </p>
      <h1 className="text-2xl font-bold text-ink">
        <Emoji>{emoji.project}</Emoji>
        Project
      </h1>

      {(session.role === "OWNER" || session.role === "ADMIN_KEUANGAN") && (
        <CreateProjectForm />
      )}

      {projects.length === 0 ? (
        <div className="rounded-xl border border-mist-300 bg-mint p-8 text-center">
          <p className="font-hand text-[22px] text-ink-muted">
            Belum ada project di sini
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Tambahkan project agar biaya dan penerimaan bisa dipantau.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-mist-300">
          <table className="w-full text-sm">
            <thead className="bg-mist-100 text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Nilai Kontrak</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-mist-300">
                  <td className="px-3 py-2 font-semibold">{project.code}</td>
                  <td className="px-3 py-2">{project.name}</td>
                  <td className="px-3 py-2">{project.status}</td>
                  <td className="num px-3 py-2">
                    {formatRupiah(fromDbNumeric(project.contract_value))}
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
