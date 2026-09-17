"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DomainError } from "@/lib/server/errors";
import {
  clearSessionCookies,
  setSessionCookies,
  setUserCookie,
} from "@/lib/server/auth";
import {
  createOrganization,
  loginUser,
  registerUser,
  updateOrganizationProfile,
} from "@/lib/repositories/users";
import type { ActionResult } from "@/lib/server/action";
import { requireSession } from "@/lib/server/auth";

const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter."),
  email: z.string().email("Email tidak valid."),
  password: z.string().min(10, "Kata sandi minimal 10 karakter."),
});

const loginSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

const orgSchema = z.object({
  name: z.string().min(2, "Nama perusahaan wajib diisi."),
  companyCode: z
    .string()
    .regex(/^[A-Za-z0-9]{2,6}$/, "Kode 2–6 huruf/angka."),
  npwp: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  bankAccountLabel: z.string().optional(),
  coaTemplate: z.enum(["konstruksi", "konsultan", "kosong"]),
});

function flatten(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function registerAction(
  raw: unknown,
): Promise<ActionResult<{ userId: string }>> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Ada isian yang belum benar.",
      fieldErrors: flatten(parsed.error),
    };
  }

  try {
    const data = await registerUser(parsed.data);
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
}

export async function loginAction(
  raw: unknown,
): Promise<ActionResult<{ redirected: string }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Ada isian yang belum benar.",
      fieldErrors: flatten(parsed.error),
    };
  }

  try {
    const data = await loginUser(parsed.data);
    if (!data.orgId) {
      await setUserCookie(data.userId);
      return { ok: true, data: { redirected: "/onboarding" } };
    }
    await setSessionCookies(data.userId, data.orgId);
    return { ok: true, data: { redirected: "/dashboard" } };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function logoutAction() {
  await clearSessionCookies();
  redirect("/masuk");
}

export async function setUserCookieAfterRegister(userId: string) {
  await setUserCookie(userId);
}

export async function createOrgAction(
  raw: unknown,
): Promise<ActionResult<{ orgId: string }>> {
  const { getUserIdFromCookie } = await import("@/lib/server/auth");
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return { ok: false, message: "Sesi tidak ditemukan. Silakan masuk lagi." };
  }

  const parsed = orgSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Ada isian yang belum benar.",
      fieldErrors: flatten(parsed.error),
    };
  }

  try {
    const data = await createOrganization({
      userId,
      ...parsed.data,
      companyCode: parsed.data.companyCode.toUpperCase(),
    });
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
}

export async function updateOrgProfileAction(
  raw: unknown,
): Promise<ActionResult<{ saved: true }>> {
  const session = await requireSession();
  if (session.role !== "OWNER") {
    return {
      ok: false,
      message: "Hanya Owner yang boleh mengubah profil perusahaan.",
    };
  }

  const parsed = orgSchema.omit({ coaTemplate: true }).safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Ada isian yang belum benar.",
      fieldErrors: flatten(parsed.error),
    };
  }

  try {
    await updateOrganizationProfile({
      orgId: session.orgId,
      userId: session.userId,
      ...parsed.data,
      companyCode: parsed.data.companyCode.toUpperCase(),
    });
    return { ok: true, data: { saved: true } };
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
}
