import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { authSessions, organizations, users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./auth-crypto";
export const AUTH_COOKIE_NAME = "afrivox_session";
const SESSION_DAYS = 7;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}


export async function createAuthSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(authSessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  cookies().set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyAuthSession() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)));
  }
  cookies().set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getLocalAuthUser() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionExpiresAt: users.subscriptionExpiresAt,
      isActive: users.isActive,
      adminPermissions: users.adminPermissions,
      organizationId: users.organizationId,
      organizationName: organizations.name,
      sessionId: authSessions.id,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(
      and(
        eq(authSessions.tokenHash, hashToken(token)),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  const session = result[0];
  if (!session || !session.isActive) return null;

  return {
    id: session.id,
    email: session.email,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
    subscriptionExpiresAt: session.subscriptionExpiresAt,
    isActive: session.isActive,
    adminPermissions: Array.isArray(session.adminPermissions)
      ? (session.adminPermissions as string[])
      : null,
    organizationId: session.organizationId,
    organizationName: session.organizationName,
  };
}
