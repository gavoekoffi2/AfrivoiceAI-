import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  campaigns,
  leadDatabasePurchases,
  leadDatabases,
  phoneLines,
} from "@/lib/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  Plus,
  Users,
  CheckCircle,
  Clock,
  Play,
  Pause,
  PhoneCall,
  Database,
  Sparkles,
} from "lucide-react";
import { CreateCampaignDialog } from "@/components/shared/create-campaign-dialog";
import { QuickCallLauncher } from "@/components/shared/quick-call-launcher";
import { CreateCampaignFromDatabaseForm } from "@/components/shared/create-campaign-from-database-form";

export const dynamic = "force-dynamic";

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const, icon: Clock },
  active: { label: "Active", variant: "success" as const, icon: Play },
  paused: { label: "En pause", variant: "warning" as const, icon: Pause },
  completed: {
    label: "Terminée",
    variant: "outline" as const,
    icon: CheckCircle,
  },
};

export default async function CampaignsPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  let allCampaigns: any[] = [];
  let purchasedDatabases: any[] = [];
  let availablePhoneLines: Array<{
    id: string;
    name: string;
    phoneNumber: string | null;
    isDefault: boolean;
  }> = [];

  try {
    availablePhoneLines = await db
      .select({
        id: phoneLines.id,
        name: phoneLines.name,
        phoneNumber: phoneLines.phoneNumber,
        isDefault: phoneLines.isDefault,
      })
      .from(phoneLines)
      .where(
        and(
          eq(phoneLines.organizationId, session.organizationId),
          eq(phoneLines.status, "active"),
          eq(phoneLines.verificationStatus, "verified")
        )
      )
      .orderBy(desc(phoneLines.isDefault), desc(phoneLines.createdAt));

    allCampaigns = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.organizationId, session.organizationId))
      .orderBy(desc(campaigns.createdAt));

    const purchasedDatabaseRows = await db
      .select({ databaseId: leadDatabasePurchases.databaseId })
      .from(leadDatabasePurchases)
      .where(eq(leadDatabasePurchases.organizationId, session.organizationId));

    const purchasedDatabaseIds = purchasedDatabaseRows.map((row) => row.databaseId);
    purchasedDatabases = purchasedDatabaseIds.length
      ? await db
          .select()
          .from(leadDatabases)
          .where(inArray(leadDatabases.id, purchasedDatabaseIds))
          .orderBy(desc(leadDatabases.qualityScore))
          .limit(4)
      : [];
  } catch (error) {
    console.warn("[demo] Données campagnes indisponibles, affichage démo vide:", error);
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Campagnes de prospection
          </h2>
          <p className="text-muted-foreground">
            Testez quelques appels rapidement ou lancez une campagne avec une base complète.
          </p>
        </div>
        <CreateCampaignDialog phoneLines={availablePhoneLines} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-primary/20 bg-primary/5 premium-card-sheen animate-soft-rise">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              Lancement d’appel rapide
            </CardTitle>
            <CardDescription>
              Pour tester la plateforme avec 1 à 20 numéros sans préparer une grande campagne.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickCallLauncher phoneLines={availablePhoneLines} />
          </CardContent>
        </Card>

        <Card className="animate-soft-rise">
          <CardHeader>
            <CardTitle>Deux façons de lancer</CardTitle>
            <CardDescription>
              Rapide pour tester, campagne pour un volume sérieux.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <p className="font-medium">1. Test rapide</p>
              <p className="mt-1 text-muted-foreground">
                Collez quelques numéros, créez une campagne automatique et lancez directement si le wallet est prêt.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="font-medium">2. Campagne complète</p>
              <p className="mt-1 text-muted-foreground">
                Créez une campagne, ajoutez des prospects un par un, importez un CSV ou utilisez une base prospects achetée.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 via-white/70 to-violet-400/10 dark:from-emerald-400/10 dark:via-white/[0.04] dark:to-violet-400/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-500" />
            Créer une campagne depuis une base achetée
          </CardTitle>
          <CardDescription>
            Les bases débloquées apparaissent ici : choisissez une base, confirmez l’objectif, puis lancez les appels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchasedDatabases.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-muted-foreground/25 bg-background/55 p-5 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">Aucune base achetée pour le moment.</p>
                <p className="text-muted-foreground">
                  Achetez une base prospects, puis elle viendra ici pour créer une campagne en un clic.
                </p>
              </div>
              <Button asChild className="gap-2 rounded-xl">
                <Link href="/lead-databases">
                  <Sparkles className="h-4 w-4" />
                  Acheter une base
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {purchasedDatabases.map((database) => (
                <div key={database.id} className="rounded-2xl border bg-background/65 p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold leading-tight">{database.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {database.country} · {database.sector} · {database.recordCount.toLocaleString("fr-FR")} prospects
                      </p>
                    </div>
                    <Badge variant="success">Débloquée</Badge>
                  </div>
                  <CreateCampaignFromDatabaseForm
                    databaseId={database.id}
                    databaseName={database.name}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {allCampaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Aucune campagne pour l&apos;instant
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Créez votre première campagne de prospection pour automatiser
              vos appels sortants avec l&apos;IA.
            </p>
            <CreateCampaignDialog phoneLines={availablePhoneLines} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allCampaigns.map((campaign) => {
            const config = statusConfig[
              campaign.status as keyof typeof statusConfig
            ] ?? statusConfig.draft;
            const StatusIcon = config.icon;

            const successRate =
              campaign.calledLeads > 0
                ? Math.round(
                    (campaign.qualifiedLeads / campaign.calledLeads) * 100
                  )
                : 0;

            return (
              <Card
                key={campaign.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-1">
                      {campaign.name}
                    </CardTitle>
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <Badge variant={config.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                      <Badge variant="outline">
                        {campaign.voiceLanguage === "ewe" ? "Éwé/local" : "Français"}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {campaign.objective}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div>
                      <p className="text-xl font-bold">
                        {campaign.totalLeads}
                      </p>
                      <p className="text-xs text-muted-foreground">Leads</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {campaign.calledLeads}
                      </p>
                      <p className="text-xs text-muted-foreground">Appelés</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-green-600">
                        {successRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Qualifiés</p>
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link href={`/campaigns/${campaign.id}`}>
                      Voir les détails
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
