import { createSupabaseServerClient } from "./supabase/server";
import { db } from "./db";
import { users, organizations } from "./db/schema";
import { eq } from "drizzle-orm";

export type UserSession = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
};

export async function getUserSession(): Promise<UserSession | null> {
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
        organizationId: users.organizationId,
        organizationName: organizations.name,
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, authUser.id))
      .limit(1);

    return result[0] ?? null;
  } catch (error) {
    console.error("[auth] Erreur lors de la récupération de session:", error);
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
