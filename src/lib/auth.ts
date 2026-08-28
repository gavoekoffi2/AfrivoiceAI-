import { getLocalAuthUser } from "./auth-local";

export type UserSession = {
  id: string;
  email: string;
  role: string;
  subscriptionPlan: string;
  subscriptionExpiresAt: Date | null;
  isActive: boolean;
  adminPermissions: string[] | null;
  organizationId: string;
  organizationName: string;
};

const DEMO_SESSION: UserSession = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@afrivoxai.com",
  role: "admin",
  subscriptionPlan: "premium",
  subscriptionExpiresAt: null,
  isActive: true,
  adminPermissions: ["demo", "admin"],
  organizationId: "00000000-0000-4000-8000-000000000010",
  organizationName: "AfrivoxAI Demo",
};

export async function getUserSession(): Promise<UserSession | null> {
  if (process.env.AFRIVOXAI_DEMO_AUTH === "true") return DEMO_SESSION;

  try {
    return await getLocalAuthUser();
  } catch (error) {
    console.warn("[auth] Session locale indisponible:", error);
    return null;
  }
}

export async function requireSession(): Promise<UserSession> {
  const session = await getUserSession();
  if (!session) throw new Error("Non autorisé - Session requise");
  return session;
}

export async function checkAuthFromRequest(_req: Request): Promise<UserSession | null> {
  return getUserSession();
}
