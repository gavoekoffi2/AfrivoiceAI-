import { hmacSha256Hex, safeCompare } from "@/lib/utils/hmac";
import { isProduction } from "@/lib/utils/env";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("vapi");

/**
 * Vérifie la signature du webhook Vapi.ai
 * Vapi peut envoyer un secret partagé (header `x-vapi-secret`) ou un HMAC.
 * Cette fonction supporte les deux modes.
 */
export function verifyVapiWebhook(
  rawBody: string,
  signatureOrSecret: string | null
): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  if (!secret) {
    if (isProduction()) {
      log.error("VAPI_WEBHOOK_SECRET manquant en production — webhook rejeté");
      return false;
    }
    log.warn("VAPI_WEBHOOK_SECRET non configuré (mode dev — webhook accepté)");
    return true;
  }

  if (!signatureOrSecret) return false;

  // Mode 1 : secret partagé direct (Vapi)
  if (safeCompare(secret, signatureOrSecret)) return true;

  // Mode 2 : HMAC-SHA256 hex
  const expected = hmacSha256Hex(secret, rawBody);
  return safeCompare(expected, signatureOrSecret);
}
