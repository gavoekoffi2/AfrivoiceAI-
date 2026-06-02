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

  const computedBuf = Buffer.from(computedHash);
  const signatureBuf = Buffer.from(signature);

  // timingSafeEqual lève une exception si les longueurs diffèrent : on garde
  // une comparaison en temps constant uniquement à longueur égale.
  if (computedBuf.length !== signatureBuf.length) return false;

  try {
    return crypto.timingSafeEqual(computedBuf, signatureBuf);
  } catch {
    return false;
  }
}

export function isCashOnDelivery(gateway: string | undefined | null): boolean {
  if (!gateway) return false;
  const value = gateway.toLowerCase();
  const codKeywords = [
    "cash on delivery",
    "cod",
    "paiement à la livraison",
    "livraison",
    "cash",
  ];
  return codKeywords.some((kw) => value.includes(kw));
}
