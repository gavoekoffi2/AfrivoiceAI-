import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaigns, leads, calls } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  PhoneCall,
  Users,
  CheckCircle,
  ArrowLeft,
  Upload,
  Play,
  Pause,
  Target,
} from "lucide-react";
import {
  formatFcfa,
  formatDuration,
  getCallStatusLabel,
  isUuid,
} from "@/lib/utils";
import { getCampaignLeadStats } from "@/lib/db/queries";
import { LeadsImporter } from "@/components/shared/leads-importer";
import { CampaignBatchCaller } from "@/components/shared/campaign-batch-caller";

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  if (!isUuid(params.id)) notFound();

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

  // Récupérer les leads de cette campagne
  const campaignLeads = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.campaignId, params.id),
        eq(leads.organizationId, session.organizationId)
      )
    )
    .orderBy(desc(leads.createdAt))
    .limit(50);

  // Récupérer les appels liés aux leads de cette campagne
  const leadIds = campaignLeads.map((l) => l.id);

  const campaignCalls =
    leadIds.length > 0
      ? await db
          .select()
          .from(calls)
          .where(
            and(
              eq(calls.organizationId, session.organizationId),
              eq(calls.type, "prospecting"),
              inArray(calls.leadId, leadIds)
            )
          )
          .orderBy(desc(calls.createdAt))
          .limit(30)
      : [];

  // Statistiques sur TOUS les leads (la liste affichée est limitée à 50)
  const leadStats = await getCampaignLeadStats(params.id);
  const newLeads = leadStats.newLeads;
  const calledLeads = leadStats.called;
  const qualifiedLeads = leadStats.qualified;
  const totalLeads = leadStats.total;

  const progressPercent =
    totalLeads > 0 ? Math.round((calledLeads / totalLeads) * 100) : 0;

  const successRate =
    calledLeads > 0 ? Math.round((qualifiedLeads / calledLeads) * 100) : 0;

  // Coût total de la campagne
  const totalCostFcfa = campaignCalls.reduce(
    (sum, c) => sum + (c.costFcfa ? parseFloat(c.costFcfa) : 0),
    0
  );

  const statusColors: Record<
    string,
    "secondary" | "info" | "success" | "destructive" | "warning"
  > = {
    new: "secondary",
    called: "info",
    qualified: "success",
    not_interested: "destructive",
    callback: "warning",
    no_answer: "warning",
  };

  const callStatusColors: Record<
    string,
    "success" | "destructive" | "warning" | "secondary" | "info"
  > = {
    completed: "success",
    failed: "destructive",
    "no-answer": "warning",
    queued: "secondary",
    "in-progress": "info",
    ringing: "info",
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/campaigns">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Campagnes
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium truncate max-w-xs">{campaign.name}</span>
      </div>

      {/* En-tête campagne */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">
              {campaign.name}
            </h2>
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
          </div>
          <p className="text-muted-foreground mt-1">{campaign.objective}</p>
        </div>
        <CampaignBatchCaller
          campaignId={campaign.id}
          status={campaign.status}
          pendingLeads={newLeads}
        />
      </div>

      {/* Progression */}
      {totalLeads > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progression</span>
              <span className="text-sm text-muted-foreground">
                {calledLeads} / {totalLeads} leads contactés
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {progressPercent}% de la campagne effectuée
            </p>
          </CardContent>
        </Card>
      )}

      {/* Statistiques */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Total leads",
            value: totalLeads,
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
          {
            label: "Taux de succès",
            value: `${successRate}%`,
            icon: Target,
            color: successRate >= 30 ? "text-green-500" : "text-yellow-500",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
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
              CSV avec colonnes : nom, téléphone, entreprise (optionnel)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsImporter campaignId={campaign.id} />
          </CardContent>
        </Card>

        {/* Liste des leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Leads ({totalLeads})</span>
              {totalCostFcfa > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  Coût total : {formatFcfa(totalCostFcfa)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {campaignLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucun lead importé
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Importez un CSV pour commencer
                  </p>
                </div>
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
                      {lead.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px] italic">
                          {lead.notes}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={statusColors[lead.status] ?? "secondary"}
                      className="shrink-0 text-xs ml-2"
                    >
                      {lead.status === "new"
                        ? "Nouveau"
                        : lead.status === "called"
                        ? "Appelé"
                        : lead.status === "qualified"
                        ? "Qualifié"
                        : lead.status === "not_interested"
                        ? "Non intéressé"
                        : lead.status === "callback"
                        ? "À rappeler"
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Historique des appels ({campaignCalls.length})
          </CardTitle>
          <CardDescription>
            Cliquez sur un appel pour voir la transcription
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaignCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PhoneCall className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucun appel pour l&apos;instant
              </p>
              <p className="text-xs text-muted-foreground">
                Activez la campagne et lancez des appels
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaignCalls.map((call) => (
                <Link
                  key={call.id}
                  href={`/calls/${call.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50 transition-colors"
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
                        {new Date(call.createdAt).toLocaleDateString("fr-TG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {call.costFcfa && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {formatFcfa(parseFloat(call.costFcfa))}
                      </span>
                    )}
                    <Badge
                      variant={callStatusColors[call.status] ?? "secondary"}
                      className="text-xs"
                    >
                      {getCallStatusLabel(call.status)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Script de l'IA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Script de l&apos;IA</CardTitle>
          <CardDescription>
            Prompt utilisé par l&apos;assistant vocal pour cette campagne
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted/50 p-4 text-xs leading-relaxed whitespace-pre-wrap font-sans overflow-auto max-h-48">
            {campaign.scriptTemplate}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
