import { createSupabaseServerClient } from "./supabase/server";
import { db } from "./db";
import { users, organizations } from "./db/schema";
import { eq } from "drizzle-orm";

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

function getDemoSession(): UserSession {
  return DEMO_SESSION;
}

export async function getUserSession(): Promise<UserSession | null> {
  if (process.env.AFRIVOXAI_DEMO_AUTH === "true") {
    return getDemoSession();
  }

  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) return null;

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
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, authUser.id))
      .limit(1);

    const session = result[0];
    if (!session || !session.isActive) return null;

    return {
      ...session,
      adminPermissions: Array.isArray(session.adminPermissions)
        ? (session.adminPermissions as string[])
        : null,
    };
  } catch (error) {
    console.warn("[auth] Session réelle indisponible:", error);
    return null;
  }
}

export async function requireSession(): Promise<UserSession> {
  const session = await getUserSession();
  if (!session) {
    throw new Error("Non autorisé - Session requise");
  }
  return session;
}

// Pour les API Routes (Request object)
export async function checkAuthFromRequest(req: Request): Promise<UserSession | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  // Utiliser le cookie de session depuis les headers
  return getUserSession();
}
