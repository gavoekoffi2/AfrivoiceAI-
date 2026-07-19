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
    console.error("[lead-databases] Bases prospects indisponibles:", error);
    return <PremiumLeadDatabaseMarketplace databases={[]} />;
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
