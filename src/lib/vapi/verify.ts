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
  if (!secret) return true; // En dev sans secret configuré

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
