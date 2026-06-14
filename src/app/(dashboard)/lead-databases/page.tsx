import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  BarChart3,
  Database,
  FileCheck2,
  Lock,
  Megaphone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  leadDatabasePurchases,
  leadDatabaseRecords,
  leadDatabases,
} from "@/lib/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PurchaseLeadDatabaseButton } from "@/components/shared/purchase-lead-database-button";
import { CreateCampaignFromDatabaseForm } from "@/components/shared/create-campaign-from-database-form";

function formatFcfa(value: string | number) {
  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
}

type SampleRecord = {
  company?: string;
  city?: string;
  sector?: string;
};

export default async function LeadDatabasesPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [databases, purchases] = await Promise.all([
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

  const purchasedIds = new Set(purchases.map((purchase) => purchase.databaseId));
  const unlockedDatabaseIds = databases
    .filter((database) => purchasedIds.has(database.id))
    .map((database) => database.id);

  const unlockedRecords = unlockedDatabaseIds.length
    ? await db
        .select()
        .from(leadDatabaseRecords)
        .where(inArray(leadDatabaseRecords.databaseId, unlockedDatabaseIds))
        .orderBy(desc(leadDatabaseRecords.opportunityScore))
        .limit(30)
    : [];

  const recordsByDatabase = new Map<string, typeof unlockedRecords>();
  for (const record of unlockedRecords) {
    const current = recordsByDatabase.get(record.databaseId) ?? [];
    if (current.length < 5) current.push(record);
    recordsByDatabase.set(record.databaseId, current);
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">
              Packs de prospection IA
            </h2>
          </div>
          <p className="text-muted-foreground">
            Achetez des bases B2B publiques, scorées par IA, puis transformez-les
            en campagnes d&apos;appels AfrivoiceAI.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1 px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Données professionnelles publiques
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck2 className="h-4 w-4 text-primary" />
              Base achetable
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Le client choisit un secteur et débloque uniquement les bases achetées.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Scoring + angles IA
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Chaque prospect peut inclure score, offre recommandée, email et script d&apos;appel.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" />
              Campagne en 1 clic
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Une base achetée devient directement une campagne de prospection IA.
          </CardContent>
        </Card>
      </div>

      {databases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">
              Aucune base publiée pour le moment
            </h3>
            <p className="max-w-lg text-muted-foreground">
              Le module marketplace est prêt. Il reste à importer/publier les premiers packs
              depuis l&apos;admin ou via les migrations/seed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {databases.map((database) => {
            const isPurchased = purchasedIds.has(database.id);
            const sampleRecords = Array.isArray(database.sampleRecords)
              ? (database.sampleRecords as SampleRecord[])
              : [];
            const previewRecords = recordsByDatabase.get(database.id) ?? [];

            return (
              <Card key={database.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{database.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {database.description}
                      </CardDescription>
                    </div>
                    <Badge variant={isPurchased ? "success" : "secondary"}>
                      {isPurchased ? "Débloquée" : "Premium"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Secteur</p>
                      <p className="font-semibold">{database.sector}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Zone</p>
                      <p className="font-semibold">
                        {[database.city, database.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Prospects</p>
                      <p className="font-semibold">{database.recordCount}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Qualité</p>
                      <p className="flex items-center gap-1 font-semibold">
                        <BarChart3 className="h-3.5 w-3.5" />
                        {database.qualityScore}/100
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">Usage autorisé</p>
                    <p className="mt-1 text-muted-foreground">{database.allowedUsage}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Source: {database.dataSource}
                    </p>
                  </div>

                  {!isPurchased && sampleRecords.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Aperçu masqué</p>
                      {sampleRecords.slice(0, 3).map((record, index) => (
                        <div
                          key={`${database.id}-sample-${index}`}
                          className="flex items-center justify-between rounded-md border p-2 text-sm"
                        >
                          <span>{record.company ?? "Entreprise premium"}</span>
                          <span className="text-muted-foreground">
                            {record.city ?? database.city ?? database.country} · {record.sector ?? database.sector}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isPurchased && (
                    <div className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Lock className="h-4 w-4 text-green-600" />
                        Prospects débloqués: aperçu des meilleurs scores
                      </div>
                      {previewRecords.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Base débloquée, mais aucun prospect détaillé n&apos;est encore importé.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {previewRecords.map((record) => (
                            <div key={record.id} className="rounded-md bg-muted/50 p-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{record.companyName}</span>
                                <Badge variant="outline">Score {record.opportunityScore}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {[record.city, record.phone, record.email].filter(Boolean).join(" · ")}
                              </p>
                              {record.outreachAngle && (
                                <p className="mt-1 text-xs">Angle: {record.outreachAngle}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <CreateCampaignFromDatabaseForm
                        databaseId={database.id}
                        databaseName={database.name}
                        disabled={previewRecords.length === 0}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-semibold">
                      Prix: {formatFcfa(database.priceFcfa)}
                    </div>
                    <PurchaseLeadDatabaseButton
                      databaseId={database.id}
                      isPurchased={isPurchased}
                      priceFcfa={Number(database.priceFcfa)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
