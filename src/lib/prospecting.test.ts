import { describe, expect, it } from "vitest";
import {
  classifyProspectingOutcome,
  parseLeadsCsv,
  buildProspectingFirstMessage,
} from "./prospecting";

describe("parseLeadsCsv", () => {
  it("parse les CSV francophones avec point-virgule, guillemets et dédoublonne les téléphones", () => {
    const csv = `nom;téléphone;entreprise;email\n"Koffi";"90 00 00 00";"Boutique Alpha";"koffi@example.com"\nAma;+22890000000;Beta SARL;ama@example.com\nSans tel;;;`;

    const result = parseLeadsCsv(csv, "TG");

    expect(result.validLeads).toHaveLength(1);
    expect(result.validLeads[0]).toMatchObject({
      name: "Koffi",
      phone: "+22890000000",
      company: "Boutique Alpha",
      email: "koffi@example.com",
    });
    expect(result.duplicates).toBe(1);
    expect(result.invalidRows).toBe(1);
  });
});

describe("classifyProspectingOutcome", () => {
  it("ne confond pas 'pas intéressé' avec un lead qualifié", () => {
    expect(
      classifyProspectingOutcome({
        summary: "Le prospect n'est pas intéressé par la solution.",
        transcript: "Merci mais pas intéressé.",
        endedReason: "customer-ended-call",
      })
    ).toBe("not_interested");
  });

  it("détecte un prospect qualifié et intéressé", () => {
    expect(
      classifyProspectingOutcome({
        summary: "Le prospect est intéressé et accepte un rendez-vous demain.",
        transcript: "Oui envoyez-moi une démo et planifions un rendez-vous.",
      })
    ).toBe("qualified");
  });

  it("détecte les rappels et sans réponse", () => {
    expect(
      classifyProspectingOutcome({
        summary: "La personne demande de rappeler demain matin.",
        transcript: "Rappelez-moi demain.",
      })
    ).toBe("callback");

    expect(
      classifyProspectingOutcome({
        summary: "Pas de réponse, messagerie vocale.",
        transcript: "",
        endedReason: "no-answer",
      })
    ).toBe("no_answer");
  });
});

describe("buildProspectingFirstMessage", () => {
  it("personnalise l'ouverture sans être agressif", () => {
    expect(buildProspectingFirstMessage({ leadName: "Afi", companyName: "Afi Shop" })).toContain("Afi");
    expect(buildProspectingFirstMessage({ companyName: "Afi Shop" })).toContain("Afi Shop");
  });
});
