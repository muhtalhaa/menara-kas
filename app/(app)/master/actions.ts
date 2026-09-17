"use server";

import { z } from "zod";
import { defineAction } from "@/lib/server/action";
import { createContact, createProject } from "@/lib/repositories/masters";

export const createProjectAction = defineAction({
  input: z.object({
    code: z.string().min(1, "Kode project wajib diisi."),
    name: z.string().min(1, "Nama project wajib diisi."),
    contractValue: z.string().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  audit: "PROJECT_CREATED",
  handler: async (input, ctx) => createProject(ctx, input),
});

export const createContactAction = defineAction({
  input: z.object({
    name: z.string().min(1, "Nama kontak wajib diisi."),
    code: z.string().optional(),
    isCustomer: z.boolean().optional(),
    isVendor: z.boolean().optional(),
  }),
  roles: ["OWNER", "ADMIN_KEUANGAN"],
  audit: "CONTACT_CREATED",
  handler: async (input, ctx) => createContact(ctx, input),
});
