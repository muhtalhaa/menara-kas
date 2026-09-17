import { withOrg, type OrgContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/server/errors";

export type ProjectRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  contract_value: string;
  customer_name: string | null;
};

export async function listProjects(ctx: OrgContext): Promise<ProjectRow[]> {
  return withOrg(ctx, async (client) => {
    const result = await client.query<ProjectRow>(
      `SELECT p.id, p.code, p.name, p.status, p.contract_value::text,
              c.name AS customer_name
       FROM projects p
       LEFT JOIN contacts c ON c.id = p.customer_id
       WHERE p.org_id = $1
       ORDER BY p.code`,
      [ctx.orgId],
    );
    return result.rows;
  });
}

export async function createProject(
  ctx: OrgContext,
  input: {
    code: string;
    name: string;
    contractValue?: string;
    status?: string;
  },
): Promise<{ id: string }> {
  const code = input.code.trim().toUpperCase();
  if (!code) {
    throw new DomainError("Kode project wajib diisi.", {
      code: "Kode project wajib diisi.",
    });
  }

  return withOrg(ctx, async (client) => {
    try {
      const result = await client.query<{ id: string }>(
        `INSERT INTO projects (org_id, code, name, contract_value, status)
         VALUES ($1, $2, $3, $4::numeric, $5::project_status)
         RETURNING id`,
        [
          ctx.orgId,
          code,
          input.name.trim(),
          input.contractValue || "0",
          input.status || "BERJALAN",
        ],
      );
      return { id: result.rows[0]!.id };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new DomainError("Kode project sudah dipakai.", {
          code: "Kode project sudah dipakai.",
        });
      }
      throw error;
    }
  });
}

export async function listAccounts(ctx: OrgContext) {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{
      id: string;
      account_no: string;
      name: string;
      group: string;
      is_postable: boolean;
      is_active: boolean;
    }>(
      `SELECT id, account_no, name, "group", is_postable, is_active
       FROM accounts
       WHERE org_id = $1
       ORDER BY sort_key`,
      [ctx.orgId],
    );
    return result.rows;
  });
}

export async function listContacts(ctx: OrgContext) {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{
      id: string;
      code: string | null;
      name: string;
      is_customer: boolean;
      is_vendor: boolean;
    }>(
      `SELECT id, code, name, is_customer, is_vendor
       FROM contacts
       WHERE org_id = $1 AND is_active = true
       ORDER BY name`,
      [ctx.orgId],
    );
    return result.rows;
  });
}

export async function createContact(
  ctx: OrgContext,
  input: {
    name: string;
    code?: string;
    isCustomer?: boolean;
    isVendor?: boolean;
  },
) {
  return withOrg(ctx, async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO contacts (org_id, code, name, is_customer, is_vendor)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        ctx.orgId,
        input.code?.trim() || null,
        input.name.trim(),
        input.isCustomer ?? false,
        input.isVendor ?? false,
      ],
    );
    return { id: result.rows[0]!.id };
  });
}
