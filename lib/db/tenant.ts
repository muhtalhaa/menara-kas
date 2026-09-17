import type { PoolClient } from "pg";
import { pool } from "./client";

export type OrgContext = {
  orgId: string;
  userId: string;
};

export async function withOrg<T>(
  ctx: OrgContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.org_id', $1, true)", [
      ctx.orgId,
    ]);
    await client.query("SELECT set_config('app.user_id', $1, true)", [
      ctx.userId,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
