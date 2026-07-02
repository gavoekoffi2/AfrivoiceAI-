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
import type { Transaction } from "@/lib/db/schema";

export default async function WalletPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const data = await getWalletWithTransactions(session.organizationId);

  const balance = parseFloat(data?.wallet.balanceFcfa ?? "0");
  const txList: Transaction[] = data?.transactions ?? [];

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

        {/* Informations de facturation */}
        <Card>
          <CardHeader>
            <CardTitle>Tarification</CardTitle>
            <CardDescription>
              Coût des appels IA (marge 30% incluse)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taux de change</span>
              <span className="font-medium">1 USD = 600 FCFA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Marge appliquée</span>
              <span className="font-medium">+30%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Coût estimé / appel (1 min)
              </span>
              <span className="font-medium">~52 FCFA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Coût estimé / appel (3 min)
              </span>
              <span className="font-medium">~156 FCFA</span>
            </div>
          </CardContent>
        </Card>
      </div>

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
