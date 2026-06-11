import { describe, expect, it } from "vitest";
import { analyzeOrderOutcome, mapEndedReasonToCallStatus } from "./orders";

describe("analyzeOrderOutcome", () => {
  it("confirme quand le client confirme explicitement", () => {
    expect(
      analyzeOrderOutcome({
        summary: "Le client a confirmé sa commande et sera disponible demain.",
        transcript: "Oui je confirme, livrez-moi demain matin.",
      })
    ).toBe("confirmed");
  });

  it("ne se laisse pas piéger par un 'non' anodin dans une confirmation", () => {
    expect(
      analyzeOrderOutcome({
        summary:
          "Le client a confirmé la commande. Numéro non modifié, adresse inchangée.",
        transcript: "C'est confirmé pour demain.",
      })
    ).toBe("confirmed");
  });

  it("annule quand le client refuse", () => {
    expect(
      analyzeOrderOutcome({
        summary: "Le client a annulé sa commande, il n'est plus intéressé.",
        transcript: "Non merci, annulez la commande.",
      })
    ).toBe("cancelled");
  });

  it("détecte un refus poli", () => {
    expect(
      analyzeOrderOutcome({
        summary: "La cliente ne veut plus de l'article.",
        transcript: null,
      })
    ).toBe("cancelled");
  });

  it("classe sans réponse via endedReason même sans transcript", () => {
    expect(
      analyzeOrderOutcome({
        summary: null,
        transcript: null,
        endedReason: "customer-did-not-answer",
      })
    ).toBe("no_answer");
  });

  it("classe sans réponse quand la messagerie a décroché", () => {
    expect(
      analyzeOrderOutcome({
        summary: "L'appel est tombé sur la messagerie vocale.",
        transcript: "",
        endedReason: "assistant-ended-call",
      })
    ).toBe("no_answer");
  });

  it("classe sans réponse quand il n'y a aucune donnée", () => {
    expect(analyzeOrderOutcome({ summary: "", transcript: "" })).toBe(
      "no_answer"
    );
  });

  it("fonctionne avec le summary seul (sans transcript)", () => {
    expect(
      analyzeOrderOutcome({
        summary: "Commande confirmée, adresse validée.",
        transcript: null,
      })
    ).toBe("confirmed");
  });
});

describe("mapEndedReasonToCallStatus", () => {
  it("mappe les non-réponses", () => {
    expect(mapEndedReasonToCallStatus("customer-did-not-answer")).toBe(
      "no-answer"
    );
    expect(mapEndedReasonToCallStatus("customer-busy")).toBe("no-answer");
    expect(mapEndedReasonToCallStatus("voicemail")).toBe("no-answer");
  });

  it("mappe les erreurs", () => {
    expect(mapEndedReasonToCallStatus("assistant-error")).toBe("failed");
    expect(mapEndedReasonToCallStatus("call.start.error-vapifault")).toBe(
      "failed"
    );
  });

  it("mappe les fins normales vers completed", () => {
    expect(mapEndedReasonToCallStatus("customer-ended-call")).toBe("completed");
    expect(mapEndedReasonToCallStatus("assistant-ended-call")).toBe(
      "completed"
    );
    expect(mapEndedReasonToCallStatus(null)).toBe("completed");
  });
});
