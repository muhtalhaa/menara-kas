import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth";
import { getKwitansiPrint } from "@/lib/repositories/documents";
import { renderKwitansiHtml } from "@/lib/documents/render-html";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireSession();
  const data = await getKwitansiPrint(
    { orgId: session.orgId, userId: session.userId },
    id,
  );
  if (!data) notFound();
  return new Response(renderKwitansiHtml(data), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
