import { hmacSha256Base64, safeCompare } from "@/lib/utils/hmac";
import { isProduction } from "@/lib/utils/env";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("woocommerce");

export function verifyWooCommerceWebhook(
  rawBody: string,
  signature: string | null,
  secretOverride?: string
): boolean {
  if (!signature) return false;

  const secret = secretOverride ?? process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  if (!secret) {
    if (isProduction()) {
      log.error("WOOCOMMERCE_WEBHOOK_SECRET manquant en production — webhook rejeté");
      return false;
    }
    log.warn("WOOCOMMERCE_WEBHOOK_SECRET non configuré (mode dev — webhook accepté)");
    return true;
  }

  const expected = hmacSha256Base64(secret, rawBody);
  return safeCompare(expected, signature);
}

export function isWooCommerceCOD(paymentMethod: string | null | undefined): boolean {
  if (!paymentMethod) return false;
  const codMethods = ["cod", "cash_on_delivery", "paiement_livraison"];
  const m = paymentMethod.toLowerCase();
  return codMethods.some((kw) => m.includes(kw));
}
