import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, organizations } from "@/lib/db/schema";

/**
 * Clés API de l'API publique (Partie F).
 *
 * - La clé complète (`avk_live_<48 hex>`) n'est montrée qu'UNE fois, à la
 *   création. Seul son hash SHA-256 est stocké.
 * - Le préfixe (non secret) permet d'identifier la clé dans l'UI.
 * - Vérification en O(1) par lookup sur le hash (index unique).
 */

const KEY_PREFIX = "avk_live_";

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = crypto.randomBytes(24).toString("hex"); // 48 hex chars
  const key = `${KEY_PREFIX}${secret}`;
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 8), hash: hashApiKey(key) };
}

export function isWellFormedApiKey(key: string): boolean {
  return /^avk_live_[0-9a-f]{48}$/.test(key);
}

export interface ApiKeyContext {
  apiKeyId: string;
  organizationId: string;
  plan: string;
  scopes: string[];
}

/**
 * Résout une clé API portée par `Authorization: Bearer avk_live_...`.
 * Retourne le contexte organisation ou null (clé absente/invalide/révoquée).
 */
export async function resolveApiKey(req: Request): Promise<ApiKeyContext | null> {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!key || !isWellFormedApiKey(key)) return null;

  const rows = await db
    .select({
      id: apiKeys.id,
      organizationId: apiKeys.organizationId,
      scopes: apiKeys.scopes,
      plan: organizations.plan,
    })
    .from(apiKeys)
    .innerJoin(organizations, eq(apiKeys.organizationId, organizations.id))
    .where(and(eq(apiKeys.hashedKey, hashApiKey(key)), isNull(apiKeys.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Mise à jour non bloquante du dernier usage.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .then(
      () => {},
      () => {}
    );

  return {
    apiKeyId: row.id,
    organizationId: row.organizationId,
    plan: row.plan ?? "free",
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
  };
}
