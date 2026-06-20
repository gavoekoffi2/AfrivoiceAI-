import { loadEnvConfig } from "@next/env";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

loadEnvConfig(process.cwd());

type ImportedRecord = {
  secteur_pack: string;
  nom_entreprise: string;
  ville_commune?: string;
  telephone_1?: string;
  email_1?: string;
  site_web?: string;
  adresse?: string;
  url_source?: string;
  source?: string;
  score_prospect?: number;
  offre_recommandee?: string;
  description?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function priority(score: number) {
  if (score >= 70) return "A";
  if (score >= 45) return "B";
  return "C";
}

function sample(records: ImportedRecord[]) {
  return records.slice(0, 4).map((record) => ({
    company: record.nom_entreprise,
    city: record.ville_commune || "Côte d’Ivoire",
    sector: record.secteur_pack,
  }));
}

async function main() {
  const { db } = await import("../src/lib/db");
  const { leadDatabaseRecords, leadDatabases } = await import("../src/lib/db/schema");
  const jsonPath = process.argv[2] || "/root/base_donnees_cote_ivoire_elargie.json";
  const payload = JSON.parse(fs.readFileSync(path.resolve(jsonPath), "utf-8"));
  const records: ImportedRecord[] = payload.records ?? [];
  if (!records.length) throw new Error("Aucun record à importer.");

  const groups = new Map<string, ImportedRecord[]>();
  for (const record of records) {
    const sector = record.secteur_pack || "Entreprises";
    const current = groups.get(sector) ?? [];
    current.push(record);
    groups.set(sector, current);
  }

  let databaseCount = 0;
  let recordCount = 0;

  for (const [sector, group] of groups.entries()) {
    const slug = `ci-${slugify(sector)}`;
    const title = `Côte d’Ivoire · ${sector}`;
    const avgScore = Math.round(
      group.reduce((sum, record) => sum + Number(record.score_prospect || 0), 0) / group.length
    );
    const [database] = await db
      .insert(leadDatabases)
      .values({
        name: title,
        slug,
        sector,
        country: "CI",
        city: "Côte d’Ivoire",
        description: `Pack de ${group.length.toLocaleString("fr-FR")} entreprises ivoiriennes du secteur ${sector}. Données issues de sources publiques professionnelles, avec téléphone/site quand disponible.`,
        priceFcfa: "15000",
        recordCount: group.length,
        qualityScore: Math.max(45, Math.min(95, avgScore + 20)),
        dataSource: "Go Africa Online CI + enrichissement public",
        allowedUsage: "Prospection B2B responsable: appels, WhatsApp et email professionnel, avec respect du retrait à la demande.",
        sampleRecords: sample(group),
        isPublished: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: leadDatabases.slug,
        set: {
          name: title,
          sector,
          country: "CI",
          city: "Côte d’Ivoire",
          description: `Pack de ${group.length.toLocaleString("fr-FR")} entreprises ivoiriennes du secteur ${sector}. Données issues de sources publiques professionnelles, avec téléphone/site quand disponible.`,
          priceFcfa: "15000",
          recordCount: group.length,
          qualityScore: Math.max(45, Math.min(95, avgScore + 20)),
          dataSource: "Go Africa Online CI + enrichissement public",
          allowedUsage: "Prospection B2B responsable: appels, WhatsApp et email professionnel, avec respect du retrait à la demande.",
          sampleRecords: sample(group),
          isPublished: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    await db.delete(leadDatabaseRecords).where(eq(leadDatabaseRecords.databaseId, database.id));

    const uniqueGroup = Array.from(
      new Map(
        group.map((record) => [
          `${record.nom_entreprise || ""}::${record.telephone_1 || ""}`,
          record,
        ])
      ).values()
    );

    const inserts = uniqueGroup.map((record) => {
      const score = Number(record.score_prospect || 0);
      return {
        databaseId: database.id,
        companyName: record.nom_entreprise,
        sector,
        country: "CI",
        city: record.ville_commune || "Côte d’Ivoire",
        phone: record.telephone_1 || null,
        email: record.email_1 || null,
        website: record.site_web || null,
        address: record.adresse || null,
        sourceUrl: record.url_source || null,
        sourceName: record.source || "Go Africa Online CI",
        opportunityScore: Math.max(0, Math.min(100, score)),
        priorityBand: priority(score),
        recommendedOffer: record.offre_recommandee || "Agent vocal IA + campagne prospection",
        outreachAngle: record.description?.slice(0, 240) || `Proposer automatisation IA et prospection au secteur ${sector}.`,
        rawPayload: record,
      };
    });

    for (let i = 0; i < inserts.length; i += 500) {
      await db.insert(leadDatabaseRecords).values(inserts.slice(i, i + 500));
    }
    databaseCount += 1;
    recordCount += group.length;
    console.log(`Imported ${title}: ${group.length}`);
  }

  console.log(JSON.stringify({ databaseCount, recordCount }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
