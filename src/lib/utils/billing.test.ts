import { describe, it, expect } from "vitest";
import {
  calculateClientCostFcfa,
  estimateMinimumCallCost,
  hasSufficientBalance,
  getExchangeRateInfo,
} from "./billing";

// Valeurs par défaut : 1 USD = 600 FCFA, marge 30%.

describe("calculateClientCostFcfa", () => {
  it("applique conversion + marge et arrondit au supérieur", () => {
    // 0.05 USD * 600 = 30 FCFA, +30% = 39 -> ceil 39
    expect(calculateClientCostFcfa(0.05)).toBe(39);
  });

  it("retourne 0 pour un coût nul/négatif/invalide", () => {
    expect(calculateClientCostFcfa(0)).toBe(0);
    expect(calculateClientCostFcfa(-1)).toBe(0);
    expect(calculateClientCostFcfa(NaN)).toBe(0);
  });

  it("est monotone croissant avec le coût USD", () => {
    expect(calculateClientCostFcfa(0.1)).toBeGreaterThan(
      calculateClientCostFcfa(0.05)
    );
  });
});

describe("hasSufficientBalance", () => {
  const min = estimateMinimumCallCost();

  it("accepte un solde >= minimum estimé", () => {
    expect(hasSufficientBalance(min)).toBe(true);
    expect(hasSufficientBalance(min + 1000)).toBe(true);
  });

  it("refuse un solde insuffisant", () => {
    expect(hasSufficientBalance(0)).toBe(false);
    expect(hasSufficientBalance(min - 1)).toBe(false);
  });

  it("accepte une string (colonne decimal Postgres)", () => {
    expect(hasSufficientBalance(String(min + 100))).toBe(true);
    expect(hasSufficientBalance("0")).toBe(false);
  });
});

describe("getExchangeRateInfo", () => {
  it("expose le taux et la marge en pourcentage", () => {
    const info = getExchangeRateInfo();
    expect(info.rateUsdToFcfa).toBe(600);
    expect(info.marginPercentage).toBe(30);
  });
});
