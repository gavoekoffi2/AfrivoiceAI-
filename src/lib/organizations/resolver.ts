import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Résout l'organisation cible d'un webhook e-commerce.
 *
 * Stratégie :
 *  1. Si la query string contient `?token=<webhookToken>` → match par token (recommandé, isolation forte).
 *  2. Sinon, match par domaine (`x-shopify-shop-domain` ou `?shop=...`).
 *  3. Aucune correspondance → null (le webhook est rejeté).
 *
 * On n'utilise PLUS de fallback "première organisation trouvée" qui cassait
 * complètement l'isolation multi-tenant.
 */
export async function resolveOrganizationForShopify(
  url: URL,
  shopDomain: string | null
) {
  const token = url.searchParams.get("token");
  if (token) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.webhookToken, token))
      .limit(1);
    if (org) return org;
  }

  if (shopDomain) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.shopifyDomain, shopDomain))
      .limit(1);
    if (org) return org;
  }

  return null;
}

export async function resolveOrganizationForWooCommerce(
  url: URL,
  sourceDomain: string | null
) {
  const token = url.searchParams.get("token");
  if (token) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.webhookToken, token))
      .limit(1);
    if (org) return org;
  }

  if (sourceDomain) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.woocommerceDomain, sourceDomain))
      .limit(1);
    if (org) return org;
  }

  return null;
}
