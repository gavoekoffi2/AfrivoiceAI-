import { describe, expect, it } from "vitest";
import {
  calculateClientCostFcfa,
  hasSufficientBalance,
  estimateMinimumCallCost,
} from "./billing";

// Les valeurs par défaut sont : 1 USD = 600 FCFA, marge 30 %
describe("calculateClientCostFcfa", () => {
  it("convertit et applique la marge, arrondi à l'entier supérieur", () => {
    // 0.05 USD * 600 = 30 FCFA, +30% = 39 FCFA
    expect(calculateClientCostFcfa(0.05)).toBe(39);
  });

  it("retourne 0 pour un coût nul ou négatif", () => {
    expect(calculateClientCostFcfa(0)).toBe(0);
    expect(calculateClientCostFcfa(-1)).toBe(0);
  });

  it("arrondit toujours au FCFA supérieur", () => {
    // 0.001 USD * 600 = 0.6 FCFA, +30% = 0.78 → 1 FCFA
    expect(calculateClientCostFcfa(0.001)).toBe(1);
  });
});

describe("hasSufficientBalance", () => {
  it("accepte un solde au-dessus du minimum estimé", () => {
    expect(hasSufficientBalance(estimateMinimumCallCost())).toBe(true);
    expect(hasSufficientBalance("5000")).toBe(true);
  });

  it("refuse un solde nul ou insuffisant", () => {
    expect(hasSufficientBalance(0)).toBe(false);
    expect(hasSufficientBalance("0")).toBe(false);
  });
});
