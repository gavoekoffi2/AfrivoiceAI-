import crypto from "crypto";

/**
 * Comparaison à temps constant qui ne crashe JAMAIS, même si les buffers
 * ont des tailles différentes (ce qui ferait planter `crypto.timingSafeEqual`).
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  try {
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

/**
 * HMAC SHA256 → hex
 */
export function hmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * HMAC SHA256 → base64 (utilisé par Shopify/WooCommerce)
 */
export function hmacSha256Base64(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("base64");
}
