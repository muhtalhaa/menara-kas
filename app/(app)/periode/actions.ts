"use server";

import { z } from "zod";
import { defineAction } from "@/lib/server/action";
import { lockPeriod, unlockPeriod } from "@/lib/repositories/periods";

export const lockPeriodAction = defineAction({
  input: z.object({ periodId: z.string().min(1) }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  handler: async (input, ctx) => lockPeriod(ctx, input.periodId),
});

export const unlockPeriodAction = defineAction({
  input: z.object({
    periodId: z.string().min(1),
    reason: z.string().min(1, "Alasan membuka periode wajib diisi."),
  }),
  roles: ["OWNER"],
  handler: async (input, ctx) => unlockPeriod(ctx, input.periodId, input.reason),
});
