import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calls, orders, leads } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
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
  ShoppingCart,
  Users,
  Clock,
  TrendingUp,
  Filter,
  Download,
} from "lucide-react";
import { formatFcfa, formatDuration, getCallStatusLabel } from "@/lib/utils";
import { CallsFilter } from "@/components/shared/calls-filter";

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

const VALID_TYPES = ["ecommerce_confirmation", "prospecting"] as const;
const VALID_STATUSES = [
  "completed",
  "failed",
  "no-answer",
  "queued",
  "in-progress",
  "ringing",
] as const;

export default async function CallsPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; page?: string };
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const typeFilter =
    searchParams.type &&
    VALID_TYPES.includes(searchParams.type as (typeof VALID_TYPES)[number])
      ? searchParams.type
      : undefined;
  const statusFilter =
    searchParams.status &&
    VALID_STATUSES.includes(
      searchParams.status as (typeof VALID_STATUSES)[number]
    )
      ? searchParams.status
      : undefined;

  const conditions = [eq(calls.organizationId, session.organizationId)];
  if (typeFilter) conditions.push(eq(calls.type, typeFilter));
  if (statusFilter) conditions.push(eq(calls.status, statusFilter));

  const whereClause = and(...conditions);

  const [allCalls, totalCountResult, statsResult, totalCostResult] =
    await Promise.all([
      db
        .select({
          id: calls.id,
          type: calls.type,
          status: calls.status,
          outcome: calls.outcome,
          durationSeconds: calls.durationSeconds,
          costFcfa: calls.costFcfa,
          summary: calls.summary,
          createdAt: calls.createdAt,
          orderCustomer: orders.customerName,
          orderPhone: orders.customerPhone,
          leadName: leads.name,
          leadPhone: leads.phone,
        })
        .from(calls)
        .leftJoin(orders, eq(calls.orderId, orders.id))
        .leftJoin(leads, eq(calls.leadId, leads.id))
        .where(whereClause)
        .orderBy(desc(calls.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(calls)
        .where(whereClause),
      db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where status = 'completed')::int`,
          ecommerceCount: sql<number>`count(*) filter (where type = 'ecommerce_confirmation')::int`,
          prospectingCount: sql<number>`count(*) filter (where type = 'prospecting')::int`,
        })
        .from(calls)
        .where(eq(calls.organizationId, session.organizationId)),
      // Coût total avec les filtres en cours (pas juste la page actuelle)
      db
        .select({
          sum: sql<string>`COALESCE(SUM(cost_fcfa), 0)::text`,
        })
        .from(calls)
        .where(whereClause),
    ]);

  const totalCount = totalCountResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / limit);
  const stats = statsResult[0];
  const totalFilteredCostFcfa = parseFloat(totalCostResult[0]?.sum ?? "0");

  const hasFilters = Boolean(typeFilter || statusFilter);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Historique des appels
          </h2>
          <p className="text-muted-foreground">
            Tous les appels passés via AfrivoiceAI — e-commerce et prospection
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href="/api/calls/export" download>
            <Download className="h-4 w-4" />
            Exporter en CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total appels",
            value: (stats?.total ?? 0).toLocaleString("fr-TG"),
            icon: PhoneCall,
            color: "text-blue-500",
          },
          {
            label: "Terminés",
            value: (stats?.completed ?? 0).toLocaleString("fr-TG"),
            icon: TrendingUp,
            color: "text-green-500",
          },
          {
            label: "E-commerce",
            value: (stats?.ecommerceCount ?? 0).toLocaleString("fr-TG"),
            icon: ShoppingCart,
            color: "text-purple-500",
          },
          {
            label: "Prospection",
            value: (stats?.prospectingCount ?? 0).toLocaleString("fr-TG"),
            icon: Users,
            color: "text-orange-500",
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CallsFilter currentType={typeFilter} currentStatus={statusFilter} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Appels ({totalCount.toLocaleString("fr-TG")})
          </CardTitle>
          {totalFilteredCostFcfa > 0 && (
            <CardDescription>
              Coût total {hasFilters ? "(filtres actifs)" : ""} :{" "}
              {formatFcfa(totalFilteredCostFcfa)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {allCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PhoneCall className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="font-medium">Aucun appel trouvé</p>
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? "Modifiez vos filtres pour voir plus de résultats"
                  : "Lancez votre première campagne pour commencer"}
              </p>
              {hasFilters && (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/dashboard/calls">Effacer les filtres</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {allCalls.map((call) => {
                const contactName =
                  call.orderCustomer ?? call.leadName ?? "—";
                const contactPhone = call.orderPhone ?? call.leadPhone ?? "";
                return (
                  <Link
                    key={call.id}
                    href={`/dashboard/calls/${call.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        {call.type === "ecommerce_confirmation" ? (
                          <ShoppingCart className="h-4 w-4 text-primary" />
                        ) : (
                          <Users className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {contactName}
                          </p>
                          <Badge
                            variant="outline"
                            className="hidden sm:flex text-xs shrink-0"
                          >
                            {call.type === "ecommerce_confirmation"
                              ? "E-commerce"
                              : "Prospection"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {contactPhone && (
                            <>
                              <span>{contactPhone}</span>
                              <span>·</span>
                            </>
                          )}
                          <Clock className="h-3 w-3" />
                          <span>
                            {call.durationSeconds
                              ? formatDuration(call.durationSeconds)
                              : "—"}
                          </span>
                          <span>·</span>
                          <span>
                            {new Date(call.createdAt).toLocaleDateString(
                              "fr-TG",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {call.costFcfa && parseFloat(call.costFcfa) > 0 && (
                        <span className="text-xs text-muted-foreground hidden md:block">
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
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages} — {totalCount} appels
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={{
                        pathname: "/dashboard/calls",
                        query: {
                          ...(typeFilter && { type: typeFilter }),
                          ...(statusFilter && { status: statusFilter }),
                          page: page - 1,
                        },
                      }}
                    >
                      Précédent
                    </Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={{
                        pathname: "/dashboard/calls",
                        query: {
                          ...(typeFilter && { type: typeFilter }),
                          ...(statusFilter && { status: statusFilter }),
                          page: page + 1,
                        },
                      }}
                    >
                      Suivant
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
