const EXCHANGE_RATE_USD_TO_FCFA = parseFloat(
  process.env.EXCHANGE_RATE_USD_TO_FCFA || "600"
);
const PROFIT_MARGIN =
  parseFloat(process.env.PROFIT_MARGIN_PERCENTAGE || "30") / 100;

/**
 * Calcule le coût final facturé au client en FCFA
 * à partir du coût brut de l'API en USD.
 *
 * @param apiCostUsd - Le coût facturé par Vapi/ElevenLabs en dollars
 * @returns Le coût final en FCFA, marge 30% incluse
 */
export function calculateClientCostFcfa(apiCostUsd: number): number {
  if (!apiCostUsd || apiCostUsd <= 0) return 0;

  // 1. Conversion en FCFA
  const baseCostFcfa = apiCostUsd * EXCHANGE_RATE_USD_TO_FCFA;

  // 2. Application de la marge (ex: +30%)
  const finalCostFcfa = baseCostFcfa * (1 + PROFIT_MARGIN);

  // Arrondir à l'entier supérieur (les centimes de FCFA ne sont pas utilisés)
  return Math.ceil(finalCostFcfa);
}

/**
 * Calcule une estimation du coût minimum requis dans le wallet
 * pour un appel (basé sur une durée estimée de 2 minutes)
 */
export function estimateMinimumCallCost(): number {
  // Estimation : ~0.05 USD pour 2 min avec Vapi + ElevenLabs
  return calculateClientCostFcfa(0.05);
}

/**
 * Vérifie si le solde est suffisant pour lancer un appel
 */
export function hasSufficientBalance(balanceFcfa: number | string): boolean {
  const balance =
    typeof balanceFcfa === "string" ? parseFloat(balanceFcfa) : balanceFcfa;
  return balance >= estimateMinimumCallCost();
}

export function hasCallAllowance(input: {
  balanceFcfa: number | string;
  includedMinutesMonthly: number;
  usedMinutesThisCycle: number | string;
  bonusMinutesBalance: number | string;
}): boolean {
  const used = Number(input.usedMinutesThisCycle);
  const bonus = Number(input.bonusMinutesBalance);
  const monthlyRemaining = Math.max(0, input.includedMinutesMonthly - used);
  return monthlyRemaining + Math.max(0, bonus) > 0 || hasSufficientBalance(input.balanceFcfa);
}

/**
 * Formate le taux de change actuel
 */
export function getExchangeRateInfo(): {
  rateUsdToFcfa: number;
  marginPercentage: number;
} {
  return {
    rateUsdToFcfa: EXCHANGE_RATE_USD_TO_FCFA,
    marginPercentage: PROFIT_MARGIN * 100,
  };
}
