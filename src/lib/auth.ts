import { createSupabaseServerClient } from "./supabase/server";
import { db } from "./db";
import { users, organizations, wallets } from "./db/schema";
import { eq } from "drizzle-orm";
import { generateSlug } from "./utils";

export type UserSession = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
};

/**
 * Crée (de façon idempotente) l'organisation, l'utilisateur applicatif et le
 * wallet associés à un compte d'authentification Supabase.
 *
 * Indispensable car Supabase ne gère que `auth.users` : sans cette étape,
 * `getUserSession` ne trouverait jamais de ligne dans notre table `users`
 * et l'utilisateur resterait bloqué hors du dashboard.
 *
 * Conçu pour être ré-entrant (appelé à l'inscription ET en filet de sécurité
 * au premier chargement du dashboard) grâce à `onConflictDoNothing`.
 */
export async function provisionUserAndOrg(params: {
  authUserId: string;
  email: string;
  organizationName: string;
}): Promise<void> {
  const { authUserId, email, organizationName } = params;
  const safeName = organizationName?.trim() || email.split("@")[0] || "Organisation";

  await db.transaction(async (tx) => {
    // Slug déterministe et unique par utilisateur (évite les collisions).
    const baseSlug = generateSlug(safeName) || "org";
    const slug = `${baseSlug}-${authUserId.slice(0, 12)}`;

    const insertedOrg = await tx
      .insert(organizations)
      .values({ name: safeName, slug })
      .onConflictDoNothing({ target: organizations.slug })
      .returning();

    let organization = insertedOrg[0];
    if (!organization) {
      const existing = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      organization = existing[0];
    }

    if (!organization) {
      throw new Error("Échec de la création de l'organisation");
    }

    await tx
      .insert(users)
      .values({
        id: authUserId,
        email,
        organizationId: organization.id,
        role: "owner",
      })
      .onConflictDoNothing({ target: users.id });

    await tx
      .insert(wallets)
      .values({ organizationId: organization.id })
      .onConflictDoNothing({ target: wallets.organizationId });
  });
}

export async function getUserSession(): Promise<UserSession | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) return null;

    const select = () =>
      db
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

    let result = await select();

    // Filet de sécurité : provisionnement paresseux si la ligne applicative
    // n'existe pas encore (ex : compte confirmé après coup, trigger absent).
    if (!result[0] && authUser.email) {
      await provisionUserAndOrg({
        authUserId: authUser.id,
        email: authUser.email,
        organizationName:
          (authUser.user_metadata?.organization_name as string | undefined) ??
          authUser.email.split("@")[0],
      });
      result = await select();
    }

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
