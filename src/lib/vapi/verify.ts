import crypto from "crypto";

/**
 * Vérifie la signature du webhook Vapi.ai.
 *
 * En production, un secret est obligatoire : sans lui, le webhook est
 * rejeté (fail-closed) pour empêcher l'injection de faux rapports d'appels
 * (qui débitent le wallet et modifient commandes/leads).
 */
export function verifyVapiWebhook(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[vapi] VAPI_WEBHOOK_SECRET manquant : webhook rejeté en production"
      );
      return false;
    }
    return true; // En dev sans secret configuré
  }

  if (!signature) return false;

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    const expected = Buffer.from(computedHash, "hex");
    const received = Buffer.from(signature, "hex");
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
