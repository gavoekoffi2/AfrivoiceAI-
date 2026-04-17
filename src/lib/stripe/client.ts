import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY non configurée");
  }
  cached = new Stripe(key);
  return cached;
}

// Taux appliqué aux rechargements : 1 USD = EXCHANGE_RATE_USD_TO_FCFA FCFA
// (identique au taux utilisé pour la facturation des appels).
export function usdToFcfa(usd: number): number {
  const rate = parseFloat(process.env.EXCHANGE_RATE_USD_TO_FCFA || "600");
  return Math.floor(usd * rate);
}

export function fcfaToUsdCents(fcfa: number): number {
  const rate = parseFloat(process.env.EXCHANGE_RATE_USD_TO_FCFA || "600");
  return Math.ceil((fcfa / rate) * 100);
}
