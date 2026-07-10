import { describe, expect, it } from "vitest";
import { analyzeOrderCallOutcome } from "./outcome";

describe("analyzeOrderCallOutcome", () => {
  it("retourne 'uncertain' quand aucun signal clair (plus de confirmation par défaut)", () => {
    expect(analyzeOrderCallOutcome("", "")).toBe("uncertain");
    expect(analyzeOrderCallOutcome(null, null)).toBe("uncertain");
    expect(
      analyzeOrderCallOutcome("appel terminé", "bonjour, merci, au revoir")
    ).toBe("uncertain");
  });

  it("détecte une confirmation", () => {
    expect(
      analyzeOrderCallOutcome("Le client confirme la commande", "")
    ).toBe("confirmed");
    expect(analyzeOrderCallOutcome("", "c'est parfait, je serai disponible")).toBe(
      "confirmed"
    );
  });

  it("détecte une annulation", () => {
    expect(analyzeOrderCallOutcome("le client souhaite annuler", "")).toBe(
      "cancelled"
    );
    expect(analyzeOrderCallOutcome("", "je refuse cette commande")).toBe(
      "cancelled"
    );
  });

  it("détecte une non-réponse (priorité la plus haute)", () => {
    expect(
      analyzeOrderCallOutcome("tombé sur la messagerie", "confirme")
    ).toBe("no_answer");
  });

  it("ne produit pas de faux positif par sous-chaîne", () => {
    // « stock » ne doit pas matcher, « téléphone » ne doit pas matcher un
    // ancien mot-clé « non ». Rien de décisif ⇒ uncertain.
    expect(
      analyzeOrderCallOutcome("vérification du stock au téléphone", "")
    ).toBe("uncertain");
  });

  it("gère les accents (annulé, confirmé)", () => {
    expect(analyzeOrderCallOutcome("commande annulée", "")).toBe("cancelled");
    expect(analyzeOrderCallOutcome("commande confirmée", "")).toBe("confirmed");
  });
});
