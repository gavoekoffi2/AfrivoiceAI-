import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

/**
 * Normalise un domaine de boutique : minuscules, sans protocole,
 * sans chemin, sans port.
 * "https://www.MaBoutique.com/wc-api" → "www.maboutique.com"
 */
export function normalizeStoreDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const withProtocol = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const hostname = new URL(withProtocol).hostname;
    return hostname || null;
  } catch {
    return null;
  }
}

/**
 * Retrouve l'organisation propriétaire d'un domaine de boutique.
 * Retourne null si aucun domaine ne correspond — un webhook reçu
 * pour une boutique inconnue ne doit jamais être rattaché à une
 * autre organisation.
 */
export async function findOrganizationByStoreDomain(
  rawDomain: string | null | undefined
) {
  const domain = normalizeStoreDomain(rawDomain);
  if (!domain) return null;

  const result = await db
    .select()
    .from(organizations)
    .where(eq(organizations.storeDomain, domain))
    .limit(1);

  return result[0] ?? null;
}
