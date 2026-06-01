import { describe, it, expect } from "vitest";
import {
  analyzeCallOutcome,
  parseStructuredOutcome,
  resolveOrderOutcome,
  resolveLeadQualified,
  mentions,
} from "./outcome";

describe("mentions (frontières de mots)", () => {
  it("matche un mot isolé", () => {
    expect(mentions("le client a confirmé", ["confirmé"])).toBe(true);
  });

  it("ne matche pas un mot contenu dans un autre (annonce ≠ non)", () => {
    expect(mentions("il a vu une annonce", ["non"])).toBe(false);
  });

  it("matche une expression multi-mots via includes", () => {
    expect(mentions("pas de réponse du client", ["pas de réponse"])).toBe(true);
  });
});

describe("parseStructuredOutcome", () => {
  it("accepte une valeur valide", () => {
    expect(parseStructuredOutcome({ outcome: "confirmed" })).toBe("confirmed");
  });

  it("normalise espaces/casse/tirets", () => {
    expect(parseStructuredOutcome({ outcome: "No Answer" })).toBe("no_answer");
    expect(parseStructuredOutcome({ outcome: "no-answer" })).toBe("no_answer");
  });

  it("rejette une valeur inconnue ou un type invalide", () => {
    expect(parseStructuredOutcome({ outcome: "maybe" })).toBeNull();
    expect(parseStructuredOutcome({})).toBeNull();
    expect(parseStructuredOutcome(null)).toBeNull();
    expect(parseStructuredOutcome("confirmed")).toBeNull();
  });
});

describe("analyzeCallOutcome (heuristique de repli)", () => {
  it("confirme sur résumé explicite", () => {
    expect(
      analyzeCallOutcome("Le client a confirmé la commande.", "")
    ).toBe("confirmed");
  });

  it("annule sur refus explicite", () => {
    expect(
      analyzeCallOutcome("Le client n'est pas intéressé, commande annulée.", "")
    ).toBe("cancelled");
  });

  it("détecte l'absence de réponse / messagerie", () => {
    expect(analyzeCallOutcome("Tombé sur la messagerie vocale.", "")).toBe(
      "no_answer"
    );
  });

  it("DÉFAUT SÛR : ambigu => no_answer (jamais d'auto-confirmation)", () => {
    expect(analyzeCallOutcome("", "")).toBe("no_answer");
    expect(analyzeCallOutcome("appel terminé normalement", "")).toBe(
      "no_answer"
    );
  });

  it("priorise l'annulation sur la confirmation en cas de signaux mixtes", () => {
    expect(
      analyzeCallOutcome("le client annule, ne souhaite pas confirmer", "")
    ).toBe("cancelled");
  });
});

describe("resolveOrderOutcome (déterministe > heuristique)", () => {
  it("utilise la structured data quand présente", () => {
    expect(
      resolveOrderOutcome({
        structuredData: { outcome: "cancelled" },
        summary: "le client a confirmé", // contredit volontairement
        transcript: "",
      })
    ).toBe("cancelled");
  });

  it("retombe sur l'heuristique si structured data absente/invalide", () => {
    expect(
      resolveOrderOutcome({
        structuredData: undefined,
        summary: "Le client a confirmé la commande.",
        transcript: "",
      })
    ).toBe("confirmed");
  });
});

describe("resolveLeadQualified", () => {
  it("lit le booléen de la structured data", () => {
    expect(resolveLeadQualified({ structuredData: { qualified: true } })).toBe(
      true
    );
    expect(resolveLeadQualified({ structuredData: { qualified: false } })).toBe(
      false
    );
  });

  it("repli heuristique sur le résumé", () => {
    expect(resolveLeadQualified({ summary: "prospect très intéressé" })).toBe(
      true
    );
    expect(resolveLeadQualified({ summary: "a raccroché" })).toBe(false);
  });
});
