import { redirect, notFound } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaigns, leads, calls } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
  PhoneCall,
  Users,
  CheckCircle,
  ArrowLeft,
  Upload,
  Play,
  Pause,
} from "lucide-react";
import Link from "next/link";
import { formatFcfa, formatDuration, getCallStatusLabel } from "@/lib/utils";
import { LeadsImporter } from "@/components/shared/leads-importer";
import { CampaignBatchCaller } from "@/components/shared/campaign-batch-caller";

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  // Récupérer la campagne
  const campaignResult = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, params.id),
        eq(campaigns.organizationId, session.organizationId)
      )
    )
    .limit(1);

  if (!campaignResult[0]) notFound();

  const campaign = campaignResult[0];

  // Récupérer les leads et leurs appels
  const campaignLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.campaignId, params.id))
    .orderBy(desc(leads.createdAt))
    .limit(50);

  // Récupérer les appels de cette campagne
  const campaignCalls = await db
    .select()
    .from(calls)
    .where(
      and(
        eq(calls.organizationId, session.organizationId),
      )
    )
    .orderBy(desc(calls.createdAt))
    .limit(20);

  const newLeads = campaignLeads.filter((l) => l.status === "new").length;
  const calledLeads = campaignLeads.filter((l) => l.status !== "new").length;
  const qualifiedLeads = campaignLeads.filter(
    (l) => l.status === "qualified"
  ).length;

  const statusColors: Record<string, string> = {
    new: "secondary",
    called: "info",
    qualified: "success",
    not_interested: "destructive",
    no_answer: "warning",
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/campaigns">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Campagnes
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{campaign.name}</span>
      </div>

      {/* En-tête campagne */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
          <p className="text-muted-foreground">{campaign.objective}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={campaign.status === "active" ? "success" : "secondary"}
          >
            {campaign.status === "active"
              ? "Active"
              : campaign.status === "paused"
              ? "En pause"
              : campaign.status === "completed"
              ? "Terminée"
              : "Brouillon"}
          </Badge>
          <CampaignBatchCaller
            campaignId={campaign.id}
            status={campaign.status}
            pendingLeads={newLeads}
          />
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total leads",
            value: campaignLeads.length,
            icon: Users,
            color: "text-blue-500",
          },
          {
            label: "Nouveaux",
            value: newLeads,
            icon: PhoneCall,
            color: "text-yellow-500",
          },
          {
            label: "Appelés",
            value: calledLeads,
            icon: PhoneCall,
            color: "text-purple-500",
          },
          {
            label: "Qualifiés",
            value: qualifiedLeads,
            icon: CheckCircle,
            color: "text-green-500",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Import de leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Importer des leads
            </CardTitle>
            <CardDescription>
              Importez un fichier CSV avec les colonnes : nom, téléphone, entreprise
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsImporter campaignId={campaign.id} />
          </CardContent>
        </Card>

        {/* Liste des leads */}
        <Card>
          <CardHeader>
            <CardTitle>Leads ({campaignLeads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {campaignLeads.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Aucun lead importé
                </p>
              ) : (
                campaignLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {lead.name ?? "Inconnu"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.phone}
                        {lead.company && ` · ${lead.company}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        (statusColors[lead.status] as
                          | "secondary"
                          | "info"
                          | "success"
                          | "destructive"
                          | "warning") ?? "secondary"
                      }
                      className="shrink-0 text-xs"
                    >
                      {lead.status === "new"
                        ? "Nouveau"
                        : lead.status === "called"
                        ? "Appelé"
                        : lead.status === "qualified"
                        ? "Qualifié"
                        : lead.status === "not_interested"
                        ? "Non intéressé"
                        : "Sans réponse"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historique des appels */}
      {campaignCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des appels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {campaignCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PhoneCall className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {call.summary ?? "Appel de prospection"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.durationSeconds
                          ? formatDuration(call.durationSeconds)
                          : "—"}{" "}
                        ·{" "}
                        {new Date(call.createdAt).toLocaleDateString("fr-TG")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {call.costFcfa && (
                      <span className="text-xs text-muted-foreground">
                        {formatFcfa(parseFloat(call.costFcfa))}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {getCallStatusLabel(call.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
