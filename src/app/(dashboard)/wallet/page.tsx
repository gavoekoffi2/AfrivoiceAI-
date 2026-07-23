import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { getWalletWithTransactions } from "@/lib/db/queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Plus } from "lucide-react";
import { formatFcfa } from "@/lib/utils";
import { WalletDepositButton } from "@/components/shared/wallet-deposit-button";
import { MinutePackPicker } from "@/components/shared/minute-pack-picker";
import { db } from "@/lib/db";
import { organizationBillingProfiles, type Transaction } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getBillingPlan } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [data, billingProfile] = await Promise.all([
    getWalletWithTransactions(session.organizationId),
    db.query.organizationBillingProfiles.findFirst({
      where: eq(organizationBillingProfiles.organizationId, session.organizationId),
    }),
  ]);

  const balance = parseFloat(data?.wallet.balanceFcfa ?? "0");
  const txList: Transaction[] = data?.transactions ?? [];
  const plan = getBillingPlan(billingProfile?.planCode);
  const includedMinutes = billingProfile?.includedMinutesMonthly ?? plan.includedMinutes;
  const usedMinutes = Number(billingProfile?.usedMinutesThisCycle ?? 0);
  const bonusMinutes = Number(billingProfile?.bonusMinutesBalance ?? 0);
  const monthlyMinutesRemaining = Math.max(0, includedMinutes - usedMinutes);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wallet</h2>
        <p className="text-muted-foreground">
          Gérez vos crédits AfrivoxAI en FCFA
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Solde principal */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Solde disponible
            </CardTitle>
            <CardDescription>Crédits pour vos appels IA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {formatFcfa(balance)}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              ≈ {(balance / 600).toFixed(2)} USD (taux : 1 USD = 600 FCFA)
            </p>
            <div className="mt-4">
              <WalletDepositButton />
            </div>
          </CardContent>
        </Card>

        {/* Minutes du forfait */}
        <Card>
          <CardHeader>
            <CardTitle>Minutes disponibles</CardTitle>
            <CardDescription>
              Forfait {plan.name} — votre activité continue avec les packs bonus
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Incluses ce mois</span>
              <span className="font-medium">{includedMinutes.toLocaleString("fr-TG")} min</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Utilisées</span>
              <span className="font-medium">{usedMinutes.toFixed(1)} min</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Restantes du forfait</span>
              <span className="font-medium text-emerald-600">{monthlyMinutesRemaining.toFixed(1)} min</span>
            </div>
            <div className="flex justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Minutes bonus achetées</span>
              <span className="font-semibold text-primary">{bonusMinutes.toFixed(1)} min</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter des minutes à tout moment</CardTitle>
          <CardDescription>
            Les minutes bonus ne remplacent pas votre forfait et restent disponibles jusqu’à leur utilisation. Le montant est débité de votre wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MinutePackPicker />
        </CardContent>
      </Card>

      {/* Historique des transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des transactions</CardTitle>
          <CardDescription>
            20 dernières transactions de votre wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {txList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                Aucune transaction pour l&apos;instant
              </p>
              <p className="text-sm text-muted-foreground">
                Rechargez votre wallet pour commencer
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {txList.map((tx) => {
                const amount = parseFloat(tx.amountFcfa);
                const isDeposit = tx.type === "deposit";

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-full p-1.5 ${
                          isDeposit
                            ? "bg-green-100 dark:bg-green-950"
                            : "bg-red-100 dark:bg-red-950"
                        }`}
                      >
                        {isDeposit ? (
                          <ArrowUpCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {tx.description ?? (isDeposit ? "Recharge" : "Appel")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("fr-TG", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-semibold ${
                          isDeposit ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {isDeposit ? "+" : "-"}
                        {formatFcfa(Math.abs(amount))}
                      </span>
                      <div>
                        <Badge
                          variant={isDeposit ? "success" : "destructive"}
                          className="text-xs"
                        >
                          {isDeposit ? "Recharge" : "Débit"}
                        </Badge>
                      </div>
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
