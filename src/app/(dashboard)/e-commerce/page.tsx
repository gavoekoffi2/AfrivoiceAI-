import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, calls } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
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
  ShoppingCart,
  CheckCircle,
  XCircle,
  Phone,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatFcfa, getOrderStatusLabel } from "@/lib/utils";

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
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Commandes E-commerce
        </h2>
        <p className="text-muted-foreground">
          Confirmation automatique des commandes paiement à la livraison (COD)
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total commandes",
            value: stats.total,
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
            label: "Sans réponse",
            value: stats.noAnswer,
            color: "text-yellow-500",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Webhook */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Configuration Shopify Webhook
          </CardTitle>
          <CardDescription>
            Connectez votre boutique Shopify pour recevoir les commandes
            automatiquement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">
            {`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://votre-domaine.com"}/api/webhooks/shopify`}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Copiez cette URL dans Shopify → Paramètres → Notifications →
            Webhooks → Créer un webhook (événement : Création de commande)
          </p>
        </CardContent>
      </Card>

      {/* Liste des commandes */}
      <Card>
        <CardHeader>
          <CardTitle>Commandes ({allOrders.length})</CardTitle>
          <CardDescription>
            Suivi en temps réel des confirmations par IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="font-medium">Aucune commande reçue</p>
              <p className="text-sm text-muted-foreground">
                Configurez votre webhook Shopify pour commencer à recevoir des
                commandes
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allOrders.map((order) => {
                const config =
                  statusConfig[order.status as keyof typeof statusConfig] ??
                  statusConfig.pending;
                const StatusIcon = config.icon;

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
