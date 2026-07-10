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

/**
 * Mode démo OPT-IN, cloisonné et NON-administrateur.
 *
 * Sécurité : contrairement à l'ancien comportement, aucune session n'est
 * jamais accordée « par défaut » en cas d'échec d'authentification. Le mode
 * démo n'est activé que si `DEMO_MODE=true` est explicitement défini, et il
 * renvoie un simple membre (jamais admin/super_admin) rattaché à une
 * organisation démo isolée. À ne PAS activer sur un domaine public.
 */
const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000010";

function getDemoSessionIfEnabled(): UserSession | null {
  if (process.env.DEMO_MODE !== "true") return null;
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "demo@afrivoxai.com",
    role: "member",
    subscriptionPlan: "free",
    subscriptionExpiresAt: null,
    isActive: true,
    adminPermissions: null,
    organizationId: DEMO_ORGANIZATION_ID,
    organizationName: "AfrivoxAI Demo",
  };
}

export async function getUserSession(): Promise<UserSession | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    // Aucune session valide : on refuse l'accès (pas de session démo admin).
    if (error || !authUser) return getDemoSessionIfEnabled();

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
    // Utilisateur authentifié mais sans profil actif : accès refusé.
    if (!session || !session.isActive) return null;

    return {
      ...session,
      adminPermissions: Array.isArray(session.adminPermissions)
        ? (session.adminPermissions as string[])
        : null,
    };
  } catch (error) {
    // Fail-closed : une panne d'infrastructure ne doit JAMAIS accorder d'accès.
    // On journalise et on renvoie « non authentifié » (401/redirection),
    // sans jamais retomber sur une session privilégiée.
    console.error("[auth] Échec de résolution de la session:", error);
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
