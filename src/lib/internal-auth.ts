import crypto from "crypto";

/**
 * Vérifie qu'une requête interne provient bien d'un service de confiance.
 * Utilise INTERNAL_WEBHOOK_SECRET (jamais la service role key Supabase).
 */
export function verifyInternalSecret(provided: string | null): boolean {
  if (!provided) return false;
  const expected = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!expected || expected.length < 16) return false;

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function internalHeader(): Record<string, string> {
  return {
    "x-internal-secret": process.env.INTERNAL_WEBHOOK_SECRET ?? "",
  };
}
