export type BillingPlanCode =
  | "essential"
  | "growth"
  | "business"
  | "enterprise";

export type BillingPlan = {
  code: BillingPlanCode;
  name: string;
  audience: string;
  monthlyPriceFcfa: number | null;
  includedMinutes: number;
  minuteRateFcfa: number;
  phoneLineLimit: number;
  concurrencyLimit: number;
  includedSeats: number;
  setupSimFcfa: number;
  setupSipFcfa: number;
  features: string[];
};

export const BILLING_PLANS: Record<BillingPlanCode, BillingPlan> = {
  essential: {
    code: "essential",
    name: "Essentiel",
    audience: "Indépendants et petites équipes",
    monthlyPriceFcfa: 15_000,
    includedMinutes: 60,
    minuteRateFcfa: 150,
    phoneLineLimit: 1,
    concurrencyLimit: 1,
    includedSeats: 2,
    setupSimFcfa: 25_000,
    setupSipFcfa: 50_000,
    features: ["60 minutes incluses", "1 ligne professionnelle", "Support standard"],
  },
  growth: {
    code: "growth",
    name: "Croissance",
    audience: "PME avec des campagnes régulières",
    monthlyPriceFcfa: 45_000,
    includedMinutes: 250,
    minuteRateFcfa: 125,
    phoneLineLimit: 3,
    concurrencyLimit: 3,
    includedSeats: 10,
    setupSimFcfa: 20_000,
    setupSipFcfa: 40_000,
    features: ["250 minutes incluses", "3 appels simultanés", "Support prioritaire"],
  },
  business: {
    code: "business",
    name: "Business",
    audience: "Entreprises à fort volume",
    monthlyPriceFcfa: 120_000,
    includedMinutes: 900,
    minuteRateFcfa: 105,
    phoneLineLimit: 10,
    concurrencyLimit: 10,
    includedSeats: 25,
    setupSimFcfa: 15_000,
    setupSipFcfa: 30_000,
    features: ["900 minutes incluses", "10 appels simultanés", "Accompagnement dédié"],
  },
  enterprise: {
    code: "enterprise",
    name: "Entreprise",
    audience: "Centres d’appels et réseaux multi-sites",
    monthlyPriceFcfa: null,
    includedMinutes: 5_000,
    minuteRateFcfa: 90,
    phoneLineLimit: 100,
    concurrencyLimit: 50,
    includedSeats: 100,
    setupSimFcfa: 0,
    setupSipFcfa: 0,
    features: ["Volume contractuel", "SLA et sécurité renforcée", "Tarification négociée"],
  },
};

export const MINUTE_PACKS = {
  boost30: {
    code: "boost30",
    name: "Dépannage",
    minutes: 30,
    priceFcfa: 5_000,
  },
  boost60: {
    code: "boost60",
    name: "1 heure",
    minutes: 60,
    priceFcfa: 10_000,
  },
  boost250: {
    code: "boost250",
    name: "PME",
    minutes: 250,
    priceFcfa: 30_000,
  },
  boost500: {
    code: "boost500",
    name: "Volume",
    minutes: 500,
    priceFcfa: 55_000,
  },
  boost1000: {
    code: "boost1000",
    name: "Grand volume",
    minutes: 1_000,
    priceFcfa: 100_000,
  },
} as const;

export type MinutePackCode = keyof typeof MINUTE_PACKS;

export function getMinutePack(code: string) {
  return code in MINUTE_PACKS ? MINUTE_PACKS[code as MinutePackCode] : null;
}

export function getBillingPlan(code?: string | null): BillingPlan {
  if (code && code in BILLING_PLANS) {
    return BILLING_PLANS[code as BillingPlanCode];
  }
  return BILLING_PLANS.essential;
}

export function allocateBillableMinutes(input: {
  billableMinutes: number;
  monthlyMinutesRemaining: number;
  bonusMinutesBalance: number;
}) {
  const billable = Math.max(0, input.billableMinutes);
  const monthlyMinutesUsed = Math.min(
    billable,
    Math.max(0, input.monthlyMinutesRemaining)
  );
  const afterMonthly = billable - monthlyMinutesUsed;
  const bonusMinutesUsed = Math.min(
    afterMonthly,
    Math.max(0, input.bonusMinutesBalance)
  );
  const overageMinutes = Math.max(0, afterMonthly - bonusMinutesUsed);

  return { monthlyMinutesUsed, bonusMinutesUsed, overageMinutes };
}

export function calculateCallChargeFcfa(input: {
  planCode?: string | null;
  durationSeconds: number;
  providerCostUsd: number;
  exchangeRateUsdToFcfa: number;
  providerSafetyMultiplier?: number;
}) {
  const plan = getBillingPlan(input.planCode);
  const billableMinutes = Math.max(0.5, input.durationSeconds / 60);
  const usageChargeFcfa = Math.ceil(billableMinutes * plan.minuteRateFcfa);
  const providerFloorFcfa = Math.ceil(
    Math.max(0, input.providerCostUsd) *
      input.exchangeRateUsdToFcfa *
      (input.providerSafetyMultiplier ?? 1.67)
  );

  return {
    plan,
    billableMinutes,
    usageChargeFcfa,
    providerFloorFcfa,
    clientChargeFcfa: Math.max(usageChargeFcfa, providerFloorFcfa),
    billedMinuteRateFcfa: plan.minuteRateFcfa,
  };
}
