import { z } from "zod";
import { DomainError } from "./errors";
import type { MemberRole } from "./types";
import type { OrgContext } from "@/lib/db/tenant";
import { recordAudit } from "./audit";
import { requireSession } from "./auth";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

type HandlerCtx = OrgContext & { role: MemberRole };

function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function defineAction<I extends z.ZodType, O>(config: {
  input: I;
  roles: MemberRole[];
  audit?: string;
  handler: (input: z.infer<I>, ctx: HandlerCtx) => Promise<O>;
}) {
  return async (raw: unknown): Promise<ActionResult<O>> => {
    const session = await requireSession();

    if (!config.roles.includes(session.role)) {
      return {
        ok: false,
        message: "Peran Anda tidak boleh melakukan aksi ini.",
      };
    }

    const parsed = config.input.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        message: "Ada isian yang belum benar.",
        fieldErrors: flattenZodErrors(parsed.error),
      };
    }

    try {
      const data = await config.handler(parsed.data, {
        orgId: session.orgId,
        userId: session.userId,
        role: session.role,
      });
      if (config.audit) {
        await recordAudit(
          { orgId: session.orgId, userId: session.userId },
          config.audit,
          "action",
          null,
          null,
          data,
        );
      }
      return { ok: true, data };
    } catch (error) {
      if (error instanceof DomainError) {
        return {
          ok: false,
          message: error.message,
          fieldErrors: error.fieldErrors,
        };
      }
      throw error;
    }
  };
}
