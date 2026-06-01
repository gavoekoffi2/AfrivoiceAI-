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
      shopDomain: organizations.shopDomain,
    })
    .from(organizations);

  if (orgs.length === 0) return null;

  // Ex: "ma-boutique.myshopify.com" ou "https://ma-boutique.com/"
  const needle = shopIdentifier
    ? normalize(shopIdentifier.replace(/^https?:\/\//, "").replace(/\/$/, ""))
    : null;
  const handle = needle ? needle.split(".")[0] : null;

  // 1) Correspondance explicite et fiable sur le domaine configuré (multi-tenant).
  if (needle) {
    const byDomain = orgs.find(
      (o) => o.shopDomain && normalize(o.shopDomain) === needle
    );
    if (byDomain) return byDomain.id;
  }

  // 2) Mono-tenant / démo : une seule organisation -> on l'utilise.
  if (orgs.length === 1) return orgs[0].id;

  // 3) Repli prudent : correspondance sur le nom/slug. En l'absence de
  //    correspondance, on refuse plutôt que de router vers la mauvaise org.
  if (!needle) return null;
  const match = orgs.find((o) => {
    const candidates = [o.shopName, o.slug, o.name]
      .filter((v): v is string => Boolean(v))
      .map(normalize);
    return candidates.includes(needle) || (handle ? candidates.includes(handle) : false);
  });

  return match?.id ?? null;
}
