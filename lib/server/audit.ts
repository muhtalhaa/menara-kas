import type { PoolClient } from "pg";
import { withOrg, type OrgContext } from "@/lib/db/tenant";

export async function recordAudit(
  ctx: OrgContext,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
  client?: PoolClient,
) {
  const run = async (c: PoolClient) => {
    await c.query(
      `INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, before, after)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        ctx.orgId,
        ctx.userId,
        action,
        entityType,
        entityId,
        before === null || before === undefined
          ? null
          : JSON.stringify(before),
        after === null || after === undefined
          ? null
          : JSON.stringify(after),
      ],
    );
  };

  if (client) {
    await run(client);
    return;
  }

  await withOrg(ctx, run);
}
