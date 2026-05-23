import { hmacSha256Base64, safeCompare } from "@/lib/utils/hmac";
import { isProduction } from "@/lib/utils/env";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("shopify");

/**
 * Vérifie la signature HMAC-SHA256 du webhook Shopify.
 * - En production : échec systématique si le secret n'est pas configuré.
 * - En dev : log d'avertissement uniquement (pour faciliter les tests locaux).
 */
export function verifyShopifyWebhook(
  rawBody: string,
  signature: string | null,
  secretOverride?: string
): boolean {
  if (!signature) return false;

  const secret = secretOverride ?? process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    if (isProduction()) {
      log.error("SHOPIFY_WEBHOOK_SECRET manquant en production — webhook rejeté");
      return false;
    }
    log.warn("SHOPIFY_WEBHOOK_SECRET non configuré (mode dev — webhook accepté)");
    return true;
  }

  const expected = hmacSha256Base64(secret, rawBody);
  return safeCompare(expected, signature);
}

export function isCashOnDelivery(gateway: string | null | undefined): boolean {
  if (!gateway) return false;
  const codKeywords = [
    "cash on delivery",
    "cod",
    "paiement à la livraison",
    "livraison",
    "cash",
  ];
  const g = gateway.toLowerCase();
  return codKeywords.some((kw) => g.includes(kw));
}
