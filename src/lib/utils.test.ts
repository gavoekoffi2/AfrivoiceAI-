import { describe, it, expect } from "vitest";
import {
  normalizePhoneNumber,
  generateSlug,
  formatDuration,
  truncateText,
  getOrderStatusLabel,
} from "./utils";

describe("normalizePhoneNumber", () => {
  it("normalise un numéro local togolais en E.164", () => {
    const r = normalizePhoneNumber("90112233", "TG");
    expect(r).toMatch(/^\+228\d{8}$/);
  });

  it("normalise un numéro déjà international (espaces inclus)", () => {
    expect(normalizePhoneNumber("+228 90 11 22 33", "TG")).toBe("+22890112233");
  });

  it("retourne null pour un numéro invalide", () => {
    expect(normalizePhoneNumber("123", "TG")).toBeNull();
    expect(normalizePhoneNumber("abc", "TG")).toBeNull();
    expect(normalizePhoneNumber("", "TG")).toBeNull();
  });
});

describe("generateSlug", () => {
  it("met en minuscules, retire les accents et remplace les séparateurs", () => {
    expect(generateSlug("Ma Boutique Lomé!")).toBe("ma-boutique-lome");
  });

  it("gère les espaces multiples et le trim", () => {
    expect(generateSlug("  Hello   World  ")).toBe("hello-world");
  });

  it("ne laisse pas de tirets en début/fin", () => {
    expect(generateSlug("--Éàü--")).toBe("eau");
  });
});

describe("formatDuration", () => {
  it("formate mm:ss avec padding", () => {
    expect(formatDuration(0)).toBe("0m 00s");
    expect(formatDuration(65)).toBe("1m 05s");
    expect(formatDuration(125)).toBe("2m 05s");
  });
});

describe("truncateText", () => {
  it("ne tronque pas en dessous de la limite", () => {
    expect(truncateText("hello", 10)).toBe("hello");
  });

  it("tronque et ajoute une ellipse au-delà", () => {
    expect(truncateText("hello world", 5)).toBe("hello…");
  });
});

describe("getOrderStatusLabel", () => {
  it("traduit les statuts connus et conserve les inconnus", () => {
    expect(getOrderStatusLabel("confirmed")).toBe("Confirmée");
    expect(getOrderStatusLabel("no_answer")).toBe("Sans réponse");
    expect(getOrderStatusLabel("inconnu")).toBe("inconnu");
  });
});
