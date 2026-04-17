const EXCHANGE_RATE_USD_TO_FCFA = parseFloat(
  process.env.EXCHANGE_RATE_USD_TO_FCFA || "600"
);
const PROFIT_MARGIN =
  parseFloat(process.env.PROFIT_MARGIN_PERCENTAGE || "30") / 100;

// Seuil de solde faible en FCFA — affiché dans l'UI et utilisé pour les alertes.
export const LOW_BALANCE_THRESHOLD_FCFA = parseFloat(
  process.env.LOW_BALANCE_THRESHOLD_FCFA || "5000"
);

// Estimation du coût minimum garanti pour tenter un appel de 3 minutes.
// Vapi (~$0.05/min) + ElevenLabs (~$0.03/min) + buffer = 0.12 USD/min
const ESTIMATED_USD_PER_MINUTE = 0.12;
const MIN_CALL_DURATION_MIN = 3;

export function calculateClientCostFcfa(apiCostUsd: number): number {
  if (!apiCostUsd || apiCostUsd <= 0) return 0;
  const baseCostFcfa = apiCostUsd * EXCHANGE_RATE_USD_TO_FCFA;
  const finalCostFcfa = baseCostFcfa * (1 + PROFIT_MARGIN);
  return Math.ceil(finalCostFcfa);
}

/**
 * Estimation réaliste du coût minimum requis pour lancer un appel (3 min avec marge).
 */
export function estimateMinimumCallCost(): number {
  return calculateClientCostFcfa(
    ESTIMATED_USD_PER_MINUTE * MIN_CALL_DURATION_MIN
  );
}

export function hasSufficientBalance(balanceFcfa: number | string): boolean {
  const balance =
    typeof balanceFcfa === "string" ? parseFloat(balanceFcfa) : balanceFcfa;
  return balance >= estimateMinimumCallCost();
}

export function isLowBalance(balanceFcfa: number | string): boolean {
  const balance =
    typeof balanceFcfa === "string" ? parseFloat(balanceFcfa) : balanceFcfa;
  return balance < LOW_BALANCE_THRESHOLD_FCFA;
}

export function getExchangeRateInfo(): {
  rateUsdToFcfa: number;
  marginPercentage: number;
  lowBalanceThresholdFcfa: number;
  minimumCallCostFcfa: number;
} {
  return {
    rateUsdToFcfa: EXCHANGE_RATE_USD_TO_FCFA,
    marginPercentage: PROFIT_MARGIN * 100,
    lowBalanceThresholdFcfa: LOW_BALANCE_THRESHOLD_FCFA,
    minimumCallCostFcfa: estimateMinimumCallCost(),
  };
}
