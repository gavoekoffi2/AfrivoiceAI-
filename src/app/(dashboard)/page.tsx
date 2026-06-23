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
import { formatFcfa, formatDuration, getCallStatusLabel } from "@/lib/utils";
import { CallsChart } from "@/components/shared/calls-chart";
import { PublicLandingPage } from "@/components/shared/public-landing-page";

export default async function DashboardOverview() {
  const session = await getUserSession();
  if (!session) return <PublicLandingPage />;

  const [stats, recentCalls, chartData] = await Promise.all([
    getOrganizationStats(session.organizationId),
    getRecentCalls(session.organizationId, 8),
    getCallsChartData(session.organizationId),
  ]);

  const kpiCards = [
    {
      title: "Appels Totaux",
      value: stats.totalCalls.toLocaleString("fr-TG"),
      description: "Tous les appels lancés",
      icon: PhoneCall,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Espace Entreprises",
      value: "Actif",
      description: "Prospection téléphonique B2B",
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Solde Wallet",
      value: formatFcfa(stats.walletBalance),
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
      value: stats.activeCampaigns.toLocaleString("fr-TG"),
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
      <div className="relative overflow-hidden rounded-[32px] border border-white/50 bg-gradient-to-br from-white/90 via-violet-50/90 to-emerald-50/70 p-6 shadow-2xl shadow-violet-200/35 backdrop-blur-xl dark:border-white/10 dark:from-white/[0.08] dark:via-violet-500/10 dark:to-emerald-400/10 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-100">
              Centre de contrôle IA
            </p>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.06em] md:text-5xl">
              Pilotez vos appels, campagnes et prospects depuis un espace premium.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Bienvenue sur AfrivoiceAI — {session.organizationName}. Lancez un test, achetez une base ou suivez vos résultats en temps réel.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[360px]">
            <Link href="/campaigns" className="rounded-2xl bg-slate-950 px-4 py-3 text-white transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-white dark:text-slate-950">
              Lancer appels
            </Link>
            <Link href="/lead-databases" className="rounded-2xl border bg-white/70 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-white/10">
              Bases prospects
            </Link>
            <Link href="/wallet" className="rounded-2xl border bg-white/70 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-white/10">
              Recharger
            </Link>
          </div>
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Graphique + Appels récents */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Graphique des appels */}
        <Card className="lg:col-span-2">
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

        {/* Appels récents */}
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
                  href={`/calls/${call.id}`}
                  className="flex items-center justify-between py-1 rounded px-1 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <PhoneCall className="h-3 w-3 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {call.type === "ecommerce_confirmation"
                          ? "Appel automatisé"
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
      </div>
    </div>
  );
}
