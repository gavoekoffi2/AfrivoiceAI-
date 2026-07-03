import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  leadDatabasePurchases,
  leadDatabaseRecords,
  leadDatabases,
} from "@/lib/db/schema";
import {
  PremiumLeadDatabaseMarketplace,
  type PremiumLeadDatabase,
} from "@/components/shared/premium-lead-database-marketplace";
import { isSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type SampleRecord = {
  company?: string;
  city?: string;
  sector?: string;
};

const DEMO_MARKETPLACE_DATABASES: PremiumLeadDatabase[] = [
  {
    id: "demo-togo-commerce-lome",
    name: "Pack commerces & PME - Lomé",
    sector: "Commerce / services",
    country: "TG",
    city: "Lomé",
    description:
      "Base de démonstration pour tester les campagnes AfrivoxAI auprès de commerces, boutiques et PME locales.",
    priceFcfa: 0,
    recordCount: 120,
    qualityScore: 92,
    dataSource: "Démonstration AfrivoxAI",
    allowedUsage: "Tests internes et démonstration commerciale",
    sampleRecords: [
      { company: "Boutique Akossiwa", city: "Lomé", sector: "Commerce" },
      { company: "Services Koffi", city: "Agoè", sector: "Services" },
    ],
    isPurchased: true,
    previewRecords: [
      {
        id: "demo-lead-1",
        companyName: "Boutique Akossiwa",
        city: "Lomé",
        phone: "+22890000000",
        email: "contact@exemple.tg",
        opportunityScore: 88,
        outreachAngle: "Présenter une solution d'appels automatiques pour relancer les clients.",
      },
      {
        id: "demo-lead-2",
        companyName: "Services Koffi",
        city: "Agoè",
        phone: "+22891000000",
        email: null,
        opportunityScore: 82,
        outreachAngle: "Proposer un assistant vocal pour qualifier les demandes entrantes.",
      },
    ],
  },
  {
    id: "demo-canada-business",
    name: "Pack test Canada francophone",
    sector: "B2B / services",
    country: "CA",
    city: "Montréal",
    description:
      "Base exemple pour montrer comment lancer un test rapide vers des entreprises francophones.",
    priceFcfa: 0,
    recordCount: 80,
    qualityScore: 89,
    dataSource: "Démonstration AfrivoxAI",
    allowedUsage: "Tests internes et présentation client",
    sampleRecords: [{ company: "Cabinet Tremblay", city: "Montréal", sector: "Services" }],
    isPurchased: true,
    previewRecords: [
      {
        id: "demo-lead-3",
        companyName: "Cabinet Tremblay",
        city: "Montréal",
        phone: "+15140000000",
        email: "demo@exemple.ca",
        opportunityScore: 85,
        outreachAngle: "Tester un message de prise de rendez-vous court et professionnel.",
      },
    ],
  },
];

export default async function LeadDatabasesPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  let databases: (typeof leadDatabases.$inferSelect)[] = [];
  let purchases: (typeof leadDatabasePurchases.$inferSelect)[] = [];

  try {
    [databases, purchases] = await Promise.all([
      db
        .select()
        .from(leadDatabases)
        .where(eq(leadDatabases.isPublished, true))
        .orderBy(desc(leadDatabases.qualityScore), desc(leadDatabases.createdAt)),
      db
        .select()
        .from(leadDatabasePurchases)
        .where(eq(leadDatabasePurchases.organizationId, session.organizationId)),
    ]);
  } catch (error) {
    console.warn("[demo] Bases prospects DB indisponibles, fallback démo:", error);
    return <PremiumLeadDatabaseMarketplace databases={DEMO_MARKETPLACE_DATABASES} />;
  }

  const superAdmin = isSuperAdmin(session);
  const purchasedIds = new Set(purchases.map((purchase) => purchase.databaseId));
  const unlockedDatabaseIds = databases
    .filter((database) => superAdmin || purchasedIds.has(database.id))
    .map((database) => database.id);

  const unlockedRecords = unlockedDatabaseIds.length
    ? await db
        .select()
        .from(leadDatabaseRecords)
        .where(inArray(leadDatabaseRecords.databaseId, unlockedDatabaseIds))
        .orderBy(desc(leadDatabaseRecords.opportunityScore))
        .limit(60)
    : [];

  const recordsByDatabase = new Map<string, typeof unlockedRecords>();
  for (const record of unlockedRecords) {
    const current = recordsByDatabase.get(record.databaseId) ?? [];
    if (current.length < 5) current.push(record);
    recordsByDatabase.set(record.databaseId, current);
  }

  const marketplaceDatabases: PremiumLeadDatabase[] = databases.map((database) => {
    const previewRecords = recordsByDatabase.get(database.id) ?? [];
    return {
      id: database.id,
      name: database.name,
      sector: database.sector,
      country: database.country,
      city: database.city,
      description: database.description,
      priceFcfa: Number(database.priceFcfa),
      recordCount: database.recordCount,
      qualityScore: database.qualityScore,
      dataSource: database.dataSource,
      allowedUsage: database.allowedUsage,
      sampleRecords: Array.isArray(database.sampleRecords)
        ? (database.sampleRecords as SampleRecord[])
        : [],
      isPurchased: superAdmin || purchasedIds.has(database.id),
      previewRecords: previewRecords.map((record) => ({
        id: record.id,
        companyName: record.companyName,
        city: record.city,
        phone: record.phone,
        email: record.email,
        opportunityScore: record.opportunityScore,
        outreachAngle: record.outreachAngle,
      })),
    };
  });

  return <PremiumLeadDatabaseMarketplace databases={marketplaceDatabases} />;
}
