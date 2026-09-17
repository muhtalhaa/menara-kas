import { requireSession } from "@/lib/server/auth";
import { AppShell } from "@/components/layout/app-shell";
import { pool } from "@/lib/db/client";

async function currentPeriodLabel(orgId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const result = await pool.query<{ month: number; year: number }>(
    `SELECT month, year FROM periods
     WHERE org_id = $1 AND year = $2 AND month = $3
     LIMIT 1`,
    [orgId, year, month],
  );
  if (!result.rows[0]) return `Periode ${month}/${year}`;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return `Periode ${months[result.rows[0].month - 1]} ${result.rows[0].year}`;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const periodLabel = await currentPeriodLabel(session.orgId);

  return (
    <AppShell session={session} periodLabel={periodLabel}>
      {children}
    </AppShell>
  );
}
