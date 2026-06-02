import { db } from "@/lib/db";
import { organizations, type Organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Normalise un domaine de boutique (retire le protocole, le slash final,
 * passe en minuscules). Ex: "https://Ma-Boutique.com/" -> "ma-boutique.com".
 */
export function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const withProto = value.includes("://") ? value : `https://${value}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, "") || null;
  }
}

/**
 * Résout l'organisation cible d'un webhook e-commerce entrant.
 *
 * 1. Cherche une correspondance exacte sur le domaine configuré (multi-tenant).
 * 2. Repli mono-tenant SÛR : s'il n'existe qu'une seule organisation et qu'elle
 *    n'a pas encore configuré de domaine, on l'utilise. Dès qu'il y a plusieurs
 *    organisations, on EXIGE une correspondance de domaine (jamais de choix
 *    arbitraire « premier trouvé » qui provoquerait une fuite de données).
 */
export async function resolveWebhookOrganization(
  channel: "shopify" | "woocommerce",
  rawDomain: string | null
): Promise<Organization | null> {
  const domainColumn =
    channel === "shopify"
      ? organizations.shopifyDomain
      : organizations.wooDomain;

  const domain = normalizeDomain(rawDomain);

  if (domain) {
    const matched = await db
      .select()
      .from(organizations)
      .where(eq(domainColumn, domain))
      .limit(1);
    if (matched[0]) return matched[0];
  }

  // Repli mono-tenant : une seule organisation et aucun domaine configuré.
  const orgs = await db.select().from(organizations).limit(2);
  if (orgs.length === 1) {
    const only = orgs[0];
    const configured =
      channel === "shopify" ? only.shopifyDomain : only.wooDomain;
    if (!configured) return only;
  }

  return null;
}
