import { db } from "@/lib/db";
import { organizations, type Organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isUuid } from "@/lib/utils";

/**
 * Résout l'organisation destinataire d'un webhook e-commerce.
 *
 * Chaque boutique configure son URL de webhook avec `?org=<id>` (affichée
 * dans Paramètres → Intégrations). En l'absence du paramètre, on retombe sur
 * l'unique organisation existante (mode mono-tenant historique) — mais on
 * refuse si plusieurs organisations existent, pour ne jamais attribuer une
 * commande au mauvais client.
 */
export async function resolveWebhookOrganization(
  requestUrl: string
): Promise<Organization | null> {
  const orgId = new URL(requestUrl).searchParams.get("org");

  if (orgId) {
    if (!isUuid(orgId)) return null;
    const result = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return result[0] ?? null;
  }

  const result = await db.select().from(organizations).limit(2);
  if (result.length !== 1) {
    if (result.length > 1) {
      console.error(
        "[webhooks] Paramètre ?org= manquant alors que plusieurs organisations existent — webhook refusé"
      );
    }
    return null;
  }
  return result[0];
}
