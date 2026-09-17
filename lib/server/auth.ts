import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MemberRole, SessionUser } from "./types";
import { DomainError } from "./errors";
import { pool } from "@/lib/db/client";

const COOKIE_USER = "mk_user_id";
const COOKIE_ORG = "mk_org_id";

export type AppSession = {
  userId: string;
  user: SessionUser;
  orgId: string;
  orgName: string;
  companyCode: string;
  role: MemberRole;
  membershipId: string;
};

export async function setUserCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_USER, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function setSessionCookies(userId: string, orgId: string) {
  const jar = await cookies();
  jar.set(COOKIE_USER, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.set(COOKIE_ORG, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(COOKIE_USER);
  jar.delete(COOKIE_ORG);
}

export async function getUserIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_USER)?.value ?? null;
}

export async function getSession(): Promise<AppSession | null> {
  const jar = await cookies();
  const userId = jar.get(COOKIE_USER)?.value;
  const orgId = jar.get(COOKIE_ORG)?.value;
  if (!userId || !orgId) return null;

  const result = await pool.query<{
    user_id: string;
    email: string;
    name: string;
    org_id: string;
    org_name: string;
    company_code: string;
    role: MemberRole;
    membership_id: string;
  }>(
    `SELECT u.id AS user_id, u.email, u.name,
            o.id AS org_id, o.name AS org_name, o.company_code,
            m.role, m.id AS membership_id
     FROM users u
     JOIN memberships m ON m.user_id = u.id AND m.is_active = true
     JOIN organizations o ON o.id = m.org_id
     WHERE u.id = $1 AND o.id = $2`,
    [userId, orgId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    userId: row.user_id,
    user: { id: row.user_id, email: row.email, name: row.name },
    orgId: row.org_id,
    orgName: row.org_name,
    companyCode: row.company_code,
    role: row.role,
    membershipId: row.membership_id,
  };
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    const userId = await getUserIdFromCookie();
    if (userId) redirect("/onboarding");
    redirect("/masuk");
  }
  return session;
}

export async function requireRole(roles: MemberRole[]): Promise<AppSession> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new DomainError("Peran Anda tidak boleh membuka halaman ini.");
  }
  return session;
}
