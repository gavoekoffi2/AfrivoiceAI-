import { db } from "./index";
import { organizations, users, wallets } from "./schema";
import { eq } from "drizzle-orm";
import { generateSlug } from "@/lib/utils";

export type ProvisionResult = {
  organizationId: string;
  organizationName: string;
  created: boolean;
};

/**
 * Provisionne une nouvelle organisation pour un utilisateur fraîchement inscrit
 * via Supabase Auth.
 *
 * Crée de façon atomique et idempotente :
 *   1. l'organisation (avec un slug unique),
 *   2. la ligne `users` (id = identifiant Supabase Auth),
 *   3. le wallet associé (solde initial à 0).
 *
 * Idempotent : si l'utilisateur possède déjà une organisation (webhook/redite,
 * double soumission, etc.), la fonction renvoie l'organisation existante sans
 * rien dupliquer.
 */
export async function provisionNewOrganization(params: {
  userId: string;
  email: string;
  organizationName: string;
}): Promise<ProvisionResult> {
  const { userId, email, organizationName } = params;

  // L'utilisateur est-il déjà rattaché à une organisation ?
  const existing = await db
    .select({
      organizationId: users.organizationId,
      organizationName: organizations.name,
    })
    .from(users)
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (existing[0]) {
    return {
      organizationId: existing[0].organizationId,
      organizationName: existing[0].organizationName,
      created: false,
    };
  }

  const baseSlug = generateSlug(organizationName) || "org";

  return db.transaction(async (tx) => {
    // Garantir l'unicité du slug (le slug est contraint UNIQUE en base).
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      if (!clash[0]) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
    }

    const [org] = await tx
      .insert(organizations)
      .values({ name: organizationName, slug })
      .returning();

    // L'id provient de Supabase Auth : insertion idempotente par sécurité.
    await tx
      .insert(users)
      .values({
        id: userId,
        organizationId: org.id,
        email,
        role: "owner",
      })
      .onConflictDoNothing({ target: users.id });

    await tx
      .insert(wallets)
      .values({ organizationId: org.id, balanceFcfa: "0" })
      .onConflictDoNothing({ target: wallets.organizationId });

    return {
      organizationId: org.id,
      organizationName: org.name,
      created: true,
    };
  });
}
