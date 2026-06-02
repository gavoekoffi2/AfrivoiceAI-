import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  CheckCircle,
  XCircle,
  Phone,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatFcfa, getOrderStatusLabel } from "@/lib/utils";
import { ManualCallButton } from "@/components/shared/manual-call-button";

const statusConfig = {
  pending: {
    label: "En attente",
    variant: "secondary" as const,
    icon: Clock,
  },
  calling: {
    label: "Appel en cours",
    variant: "info" as const,
    icon: Phone,
  },
  confirmed: {
    label: "Confirmée",
    variant: "success" as const,
    icon: CheckCircle,
  },
  cancelled: {
    label: "Annulée",
    variant: "destructive" as const,
    icon: XCircle,
  },
  no_answer: {
    label: "Sans réponse",
    variant: "warning" as const,
    icon: AlertTriangle,
  },
};

export default async function EcommercePage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const allOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.organizationId, session.organizationId))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  const stats = {
    total: allOrders.length,
    pending: allOrders.filter((o) => o.status === "pending").length,
    confirmed: allOrders.filter((o) => o.status === "confirmed").length,
    cancelled: allOrders.filter((o) => o.status === "cancelled").length,
    noAnswer: allOrders.filter((o) => o.status === "no_answer").length,
    calling: allOrders.filter((o) => o.status === "calling").length,
  };

  const confirmationRate =
    stats.total > 0
      ? Math.round(
          (stats.confirmed / (stats.total - stats.pending - stats.calling)) *
            100
        ) || 0
      : 0;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://votre-domaine.com";

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Commandes E-commerce
        </h2>
        <p className="text-muted-foreground">
          Confirmation automatique des commandes paiement à la livraison (COD)
          via Shopify et WooCommerce
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Total",
            value: stats.total,
            color: "text-foreground",
          },
          {
            label: "En cours",
            value: stats.calling,
            color: "text-blue-500",
          },
          {
            label: "Confirmées",
            value: stats.confirmed,
            color: "text-green-500",
          },
          {
            label: "Annulées",
            value: stats.cancelled,
            color: "text-red-500",
          },
          {
            label: "Taux de confirmation",
            value: `${confirmationRate}%`,
            color: confirmationRate >= 70 ? "text-green-500" : "text-yellow-500",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Webhooks */}
      <div className="grid gap-3 md:grid-cols-2">
        {[
          {
            label: "Shopify Webhook",
            path: "/api/webhooks/shopify",
            instructions: "Shopify → Paramètres → Notifications → Webhooks",
          },
          {
            label: "WooCommerce Webhook",
            path: "/api/webhooks/woocommerce",
            instructions:
              "WooCommerce → Paramètres → Avancé → Webhooks (Order created)",
          },
        ].map((wh) => (
          <Card key={wh.path} className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                {wh.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <code className="block rounded-md bg-muted p-2 text-xs font-mono break-all">
                {baseUrl}{wh.path}
              </code>
              <p className="mt-1 text-xs text-muted-foreground">
                {wh.instructions}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Liste des commandes */}
      <Card>
        <CardHeader>
          <CardTitle>Commandes ({allOrders.length})</CardTitle>
          <CardDescription>
            Suivi en temps réel des confirmations par IA — cliquez sur une
            commande pour voir les détails
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="font-medium">Aucune commande reçue</p>
              <p className="text-sm text-muted-foreground">
                Configurez vos webhooks Shopify ou WooCommerce pour recevoir
                des commandes automatiquement
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allOrders.map((order) => {
                const config =
                  statusConfig[order.status as keyof typeof statusConfig] ??
                  statusConfig.pending;
                const StatusIcon = config.icon;
                const canRetryCall =
                  order.status === "no_answer" ||
                  order.status === "pending";

                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.customerPhone} ·{" "}
                          {new Date(order.createdAt).toLocaleDateString(
                            "fr-TG",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                          {order.source && (
                            <span className="ml-1 capitalize opacity-60">
                              · {order.source}
                            </span>
                          )}
                        </p>
                        {order.customerAddress && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {order.customerAddress}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {order.totalAmount && (
                        <span className="hidden sm:block text-sm font-medium">
                          {formatFcfa(parseFloat(order.totalAmount))}
                        </span>
                      )}
                      <Badge variant={config.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                      {canRetryCall && (
                        <ManualCallButton orderId={order.id} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
