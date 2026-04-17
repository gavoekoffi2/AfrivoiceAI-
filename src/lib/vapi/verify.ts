import crypto from "crypto";

/**
 * Vérifie la signature du webhook Vapi.ai.
 * En production, un secret manquant provoque un refus ; en dev, tolérant.
 */
export function verifyVapiWebhook(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}
