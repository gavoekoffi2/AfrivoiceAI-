import { describe, expect, it } from "vitest";
import { normalizeLeadImportRows } from "../normalize";

describe("normalizeLeadImportRows", () => {
  it("maps French/English doctor columns into AfrivoxAI lead database records", () => {
    const { records, stats } = normalizeLeadImportRows(
      [
        {
          "Nom médecin": "Dr Exemple",
          Clinique: "Clinique Santé Montréal",
          Spécialité: "Médecine générale",
          Ville: "Montréal",
          Téléphone: "+15145550123",
          Courriel: "contact@clinique.example",
          Site: "https://clinique.example",
          Source: "CMQ + site clinique",
        },
        {
          physician: "Dr NB",
          practice_name: "Clinique Dieppe",
          specialty: "Family medicine",
          city: "Dieppe",
          phone_public: "+15065550123",
          formulaire_contact: "https://clinique-dieppe.example/contact",
        },
        {
          Nom: "Sans contact",
          Ville: "Québec",
        },
      ],
      { defaultCountry: "CA", defaultSector: "Santé / Médecins" }
    );

    expect(records).toHaveLength(2);
    expect(stats.rejectedRows).toBe(1);
    expect(stats.withPhone).toBe(2);
    expect(stats.withEmail).toBe(1);
    expect(stats.priorityA).toBe(2);
    expect(records[0]).toMatchObject({
      companyName: "Clinique Santé Montréal",
      contactName: "Dr Exemple",
      sector: "Médecine générale",
      country: "CA",
      city: "Montréal",
      phone: "+15145550123",
      email: "contact@clinique.example",
      priorityBand: "A",
    });
    expect(records[1].website).toBe("https://clinique-dieppe.example/contact");
  });
});
