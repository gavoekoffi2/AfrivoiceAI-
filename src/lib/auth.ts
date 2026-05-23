import { createSupabaseServerClient, createSupabaseServiceClient } from "./supabase/server";
import { db } from "./db";
import { users, organizations, wallets } from "./db/schema";
import { eq } from "drizzle-orm";
import { safeCompare } from "./utils/hmac";
import { generateSlug } from "./utils";
import { createLogger } from "./utils/logger";

const log = createLogger("auth");

export type UserSession = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
};

/**
 * Récupère la session utilisateur depuis Supabase puis la mappe sur la DB.
 * Si la ligne `users` n'existe pas encore (cas où le trigger Supabase n'a pas
 * encore tourné — déploiement local Postgres ou nouvelle migration), on
 * provisionne automatiquement organization + user + wallet.
 */
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

    if (result[0]) return result[0];

    // Fallback : trigger absent → on provisionne nous-mêmes
    return await provisionUser({
      authUserId: authUser.id,
      email: authUser.email ?? "",
      organizationName:
        (authUser.user_metadata?.organization_name as string | undefined) ??
        (authUser.email ? authUser.email.split("@")[0] : "Mon Organisation"),
    });
  } catch (err) {
    log.error("Erreur récupération session", { error: String(err) });
    return null;
  }
}

export async function requireSession(): Promise<UserSession> {
  const session = await getUserSession();
  if (!session) {
    throw new Error("Non autorisé — session requise");
  }
  return session;
}

/**
 * Vérifie un appel interne (server-to-server) via le secret partagé
 * INTERNAL_API_SECRET. Ne JAMAIS utiliser la service-role Supabase pour ça.
 */
export function isAuthorizedInternalCall(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  const provided = req.headers.get("x-internal-secret");
  if (!provided) return false;
  return safeCompare(secret, provided);
}

/**
 * Provisionne organization + user + wallet pour un utilisateur Supabase
 * qui vient de s'inscrire (utile si les triggers SQL n'ont pas pu s'exécuter).
 *
 * Idempotent : si l'utilisateur existe déjà, retourne la session existante.
 */
export async function provisionUser(params: {
  authUserId: string;
  email: string;
  organizationName: string;
}): Promise<UserSession | null> {
  const { authUserId, email, organizationName } = params;

  // Fast-path : déjà provisionné
  const existing = await loadSessionForUser(authUserId);
  if (existing) return existing;

  try {
    await db.transaction(async (tx) => {
      // Re-check atomique : un autre process a-t-il créé l'utilisateur entre-temps ?
      // PostgreSQL n'a pas de FOR UPDATE sur "row inexistante", on doit donc
      // s'appuyer sur la contrainte unique (users.id) qui sera détectée par
      // ON CONFLICT lors de l'INSERT.
      const slug = await generateUniqueSlug(tx, organizationName);
      const webhookToken = generateWebhookToken();

      const [org] = await tx
        .insert(organizations)
        .values({ name: organizationName, slug, webhookToken })
        .returning();

      // Si l'user existe déjà (race avec un autre provisionUser parallèle),
      // ON CONFLICT DO NOTHING : on rollback la transaction côté caller.
      const userInsert = await tx
        .insert(users)
        .values({
          id: authUserId,
          organizationId: org.id,
          email,
          role: "owner",
        })
        .onConflictDoNothing({ target: users.id })
        .returning({ id: users.id });

      if (userInsert.length === 0) {
        // Un autre process a gagné — on annule cette transaction pour ne pas
        // laisser une organization orpheline.
        throw new ProvisionRaceError();
      }

      await tx
        .insert(wallets)
        .values({ organizationId: org.id, balanceFcfa: "0" })
        .onConflictDoNothing({ target: wallets.organizationId });
    });

    return await loadSessionForUser(authUserId);
  } catch (err) {
    if (err instanceof ProvisionRaceError) {
      // L'autre process a gagné la course — on retourne sa session
      return await loadSessionForUser(authUserId);
    }
    log.error("Échec provisionUser", { error: String(err), userId: authUserId });
    return null;
  }
}

class ProvisionRaceError extends Error {
  constructor() {
    super("provision_race");
    this.name = "ProvisionRaceError";
  }
}

async function loadSessionForUser(authUserId: string): Promise<UserSession | null> {
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
    .where(eq(users.id, authUserId))
    .limit(1);
  return result[0] ?? null;
}

async function generateUniqueSlug(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationName: string
): Promise<string> {
  const baseSlug = generateSlug(organizationName) || "org";
  let slug = baseSlug;
  let attempt = 0;
  while (
    await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1)
      .then((r) => r.length > 0)
  ) {
    attempt++;
    slug = `${baseSlug}-${attempt}`;
    if (attempt > 100) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 10)}`;
      break;
    }
  }
  return slug;
}

function generateWebhookToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "")
    );
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Met à jour l'email côté DB après changement Supabase Auth.
 */
export async function syncUserEmail(authUserId: string, newEmail: string) {
  await db.update(users).set({ email: newEmail }).where(eq(users.id, authUserId));
}

export { createSupabaseServerClient, createSupabaseServiceClient };
