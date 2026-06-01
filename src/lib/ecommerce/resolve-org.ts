import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Détermine à quelle organisation rattacher une commande entrante depuis un
 * webhook e-commerce.
 *
 * - 0 organisation  -> null (rien à faire)
 * - 1 organisation  -> celle-ci (mode mono-tenant / démo)
 * - >1 organisation -> exige une correspondance explicite avec l'identifiant
 *   de la boutique (domaine Shopify / URL WooCommerce). En l'absence de
 *   correspondance fiable, on refuse plutôt que de router la commande (et donc
 *   un appel facturé) vers la mauvaise organisation.
 */
export async function resolveOrganizationForShop(
  shopIdentifier: string | null
): Promise<string | null> {
  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      shopName: organizations.shopName,
    })
    .from(organizations);

  if (orgs.length === 0) return null;
  if (orgs.length === 1) return orgs[0].id;
  if (!shopIdentifier) return null;

  // Ex: "ma-boutique.myshopify.com" ou "https://ma-boutique.com/"
  const needle = normalize(
    shopIdentifier.replace(/^https?:\/\//, "").replace(/\/$/, "")
  );
  const handle = needle.split(".")[0];

  const match = orgs.find((o) => {
    const candidates = [o.shopName, o.slug, o.name]
      .filter((v): v is string => Boolean(v))
      .map(normalize);
    return candidates.includes(needle) || candidates.includes(handle);
  });

  return match?.id ?? null;
}
