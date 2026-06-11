import crypto from "crypto";

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Vérifie l'authenticité d'un webhook Vapi.
 *
 * Vapi envoie par défaut le "Server URL Secret" en clair dans le header
 * `x-vapi-secret`. Certaines configurations utilisent à la place une
 * signature HMAC-SHA256 du body dans `x-vapi-signature`. On accepte les deux.
 */
export function verifyVapiWebhook(
  rawBody: string,
  headers: { secret?: string | null; signature?: string | null }
): boolean {
  const configuredSecret = process.env.VAPI_WEBHOOK_SECRET;
  // En dev sans secret configuré, on accepte tout
  if (!configuredSecret) return true;

  if (headers.secret) {
    return timingSafeEqualStrings(headers.secret, configuredSecret);
  }

  if (headers.signature) {
    const computedHex = crypto
      .createHmac("sha256", configuredSecret)
      .update(rawBody, "utf8")
      .digest("hex");
    const computedBase64 = crypto
      .createHmac("sha256", configuredSecret)
      .update(rawBody, "utf8")
      .digest("base64");

    return (
      timingSafeEqualStrings(headers.signature.toLowerCase(), computedHex) ||
      timingSafeEqualStrings(headers.signature, computedBase64)
    );
  }

  return false;
}
