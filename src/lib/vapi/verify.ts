import crypto from "crypto";

/**
 * Vérifie la signature du webhook Vapi.ai
 */
export function verifyVapiWebhook(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) {
    // Fail-closed en production : sans secret, on REJETTE pour empêcher la
    // falsification de rapports d'appels (qui débitent le wallet). Toléré en dev.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[vapi] VAPI_WEBHOOK_SECRET non configuré : webhook rejeté"
      );
      return false;
    }
    console.warn("[vapi] VAPI_WEBHOOK_SECRET absent (toléré hors production)");
    return true;
  }

  const computedBuf = Buffer.from(computedHash(secret, rawBody), "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (computedBuf.length !== signatureBuf.length) return false;

  try {
    return crypto.timingSafeEqual(computedBuf, signatureBuf);
  } catch {
    return false;
  }
}

function computedHash(secret: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}
