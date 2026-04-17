import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Résout l'organisation à partir du domaine Shopify ou WooCommerce reçu dans
 * l'entête du webhook. Évite le bug de l'ancienne implémentation qui prenait
 * la première organisation de la table.
 */
export async function resolveOrganizationByShopifyDomain(
  domain: string | null
) {
  if (!domain) return null;
  const result = await db
    .select()
    .from(organizations)
    .where(eq(organizations.shopifyDomain, domain.toLowerCase()))
    .limit(1);
  return result[0] ?? null;
}

export async function resolveOrganizationByWoocommerceDomain(
  domain: string | null
) {
  if (!domain) return null;
  const result = await db
    .select()
    .from(organizations)
    .where(eq(organizations.woocommerceDomain, domain.toLowerCase()))
    .limit(1);
  return result[0] ?? null;
}
