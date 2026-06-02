import Link from "next/link";
import {
  Activity,
  CreditCard,
  PhoneCall,
  CheckCircle,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserSession } from "@/lib/auth";
import {
  getOrganizationStats,
  getRecentCalls,
  getCallsChartData,
} from "@/lib/db/queries";
import { formatDuration, getCallStatusLabel } from "@/lib/utils";
import { CallsChart } from "@/components/shared/calls-chart";
import { Reveal } from "@/components/landing/reveal";
import { StatCounter } from "@/components/landing/stat-counter";
import { redirect } from "next/navigation";

export default async function DashboardOverview() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [stats, recentCalls, chartData] = await Promise.all([
    getOrganizationStats(session.organizationId),
    getRecentCalls(session.organizationId, 8),
    getCallsChartData(session.organizationId),
  ]);

  const kpiCards = [
    {
      title: "Appels Totaux",
      to: stats.totalCalls,
      suffix: "",
      description: "Tous les appels lancés",
      icon: PhoneCall,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Commandes Confirmées",
      to: stats.confirmedOrders,
      suffix: "",
      description: `Taux de succès : ${stats.confirmationRate}%`,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Solde Wallet",
      to: stats.walletBalance,
      suffix: " FCFA",
      description:
        stats.walletBalance < 5000 ? "Recharge recommandée" : "Solde disponible",
      icon: CreditCard,
      color: stats.walletBalance < 5000 ? "text-yellow-500" : "text-purple-500",
      bgColor:
        stats.walletBalance < 5000
          ? "bg-yellow-50 dark:bg-yellow-950"
          : "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Campagnes Actives",
      to: stats.activeCampaigns,
      suffix: "",
      description: "En cours d'exécution",
      icon: Activity,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  const statusColors: Record<string, string> = {
    completed: "success",
    failed: "destructive",
    "no-answer": "warning",
    queued: "secondary",
    "in-progress": "info",
    ringing: "info",
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Tableau de bord
          </h2>
          <p className="text-muted-foreground">
            Bienvenue sur AfrivoiceAI — {session.organizationName}
          </p>
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.07}>
            <Card className="relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <div className={`rounded-full p-2 ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <StatCounter to={card.to} suffix={card.suffix} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* Graphique + Appels récents */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Graphique des appels */}
        <Reveal delay={0.1} className="lg:col-span-2">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Activité des 7 derniers jours
            </CardTitle>
            <CardDescription>
              Volume d&apos;appels quotidiens (total vs terminés)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <CallsChart data={chartData} />
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <PhoneCall className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aucun appel pour l&apos;instant
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lancez votre première campagne
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          </Card>
        </Reveal>

        {/* Appels récents */}
        <Reveal delay={0.18}>
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Appels récents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCalls.length > 0 ? (
              recentCalls.map((call) => (
                <Link
                  key={call.id}
                  href={`/dashboard/calls/${call.id}`}
                  className="flex items-center justify-between py-1 rounded px-1 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <PhoneCall className="h-3 w-3 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {call.type === "ecommerce_confirmation"
                          ? "Confirmation"
                          : "Prospection"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.durationSeconds
                          ? formatDuration(call.durationSeconds)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      (statusColors[call.status] as
                        | "success"
                        | "destructive"
                        | "warning"
                        | "secondary"
                        | "info") ?? "secondary"
                    }
                    className="shrink-0 text-xs"
                  >
                    {getCallStatusLabel(call.status)}
                  </Badge>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <PhoneCall className="h-6 w-6 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucun appel récent
                </p>
              </div>
            )}
          </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
