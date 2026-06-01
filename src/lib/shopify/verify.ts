import crypto from "crypto";

/**
 * Vérifie la signature HMAC-SHA256 du webhook Shopify
 */
export function verifyShopifyWebhook(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[shopify] SHOPIFY_WEBHOOK_SECRET non configuré");
    return false;
  }

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  // Comparaison en temps constant pour éviter les timing attacks.
  // timingSafeEqual lève une exception si les longueurs diffèrent → on
  // retourne false proprement (401) au lieu d'une erreur 500.
  try {
    const a = Buffer.from(computedHash);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isCashOnDelivery(gateway: string): boolean {
  const codKeywords = [
    "cash on delivery",
    "cod",
    "paiement à la livraison",
    "livraison",
    "cash",
  ];
  return codKeywords.some((kw) => gateway.toLowerCase().includes(kw));
}
