import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { getWalletWithTransactions } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  CreditCard,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { formatFcfa } from "@/lib/utils";
import { WalletDepositButton } from "@/components/shared/wallet-deposit-button";
import { StripeCheckoutButton } from "@/components/shared/stripe-checkout-button";
import { isStripeConfigured } from "@/lib/stripe/client";
import { getExchangeRateInfo } from "@/lib/utils/billing";
import type { Transaction } from "@/lib/db/schema";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: { stripe?: string };
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [data, orgResult] = await Promise.all([
    getWalletWithTransactions(session.organizationId),
    db
      .select({ threshold: organizations.lowBalanceThresholdFcfa })
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1),
  ]);

  const balance = parseFloat(data?.wallet.balanceFcfa ?? "0");
  const threshold = parseFloat(orgResult[0]?.threshold ?? "5000");
  const isLowBalance = balance < threshold;
  const txList: Transaction[] = data?.transactions ?? [];
  const stripeConfigured = isStripeConfigured();
  const rateInfo = getExchangeRateInfo();
  const stripeStatus = searchParams.stripe;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wallet</h2>
        <p className="text-muted-foreground">
          Gérez vos crédits AfrivoiceAI en FCFA
        </p>
      </div>

      {stripeStatus === "success" && (
        <Alert variant="success">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Paiement reçu ! Le crédit est appliqué dès que Stripe confirme la
            transaction.
          </AlertDescription>
        </Alert>
      )}
      {stripeStatus === "cancelled" && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Paiement annulé. Aucun montant n&apos;a été débité.
          </AlertDescription>
        </Alert>
      )}

      {isLowBalance && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Solde faible.</strong> Vous avez moins de{" "}
            {formatFcfa(threshold)} sur votre wallet. Rechargez avant de lancer
            de nouveaux appels.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
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
              ≈ {(balance / rateInfo.rateUsdToFcfa).toFixed(2)} USD (taux : 1 USD ={" "}
              {rateInfo.rateUsdToFcfa} FCFA)
            </p>
            <div className="mt-4">
              <WalletDepositButton />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Paiement par carte
            </CardTitle>
            <CardDescription>
              {stripeConfigured
                ? "Recharge sécurisée par Stripe (Visa, MasterCard)"
                : "Stripe n'est pas configuré. Voir Paramètres > Intégrations."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stripeConfigured ? (
              <StripeCheckoutButton />
            ) : (
              <p className="text-sm text-muted-foreground">
                Pour activer le paiement par carte, configurez{" "}
                <code>STRIPE_SECRET_KEY</code> et{" "}
                <code>STRIPE_WEBHOOK_SECRET</code>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tarification</CardTitle>
          <CardDescription>
            Coût des appels IA — marge {rateInfo.marginPercentage}% incluse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taux de change</span>
            <span className="font-medium">
              1 USD = {rateInfo.rateUsdToFcfa} FCFA
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Marge appliquée</span>
            <span className="font-medium">+{rateInfo.marginPercentage}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Coût estimé / appel (1 min)
            </span>
            <span className="font-medium">
              ~
              {Math.ceil(
                0.02 *
                  rateInfo.rateUsdToFcfa *
                  (1 + rateInfo.marginPercentage / 100)
              ).toLocaleString("fr-TG")}{" "}
              FCFA
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Coût estimé / appel (3 min)
            </span>
            <span className="font-medium">
              ~
              {Math.ceil(
                0.06 *
                  rateInfo.rateUsdToFcfa *
                  (1 + rateInfo.marginPercentage / 100)
              ).toLocaleString("fr-TG")}{" "}
              FCFA
            </span>
          </div>
        </CardContent>
      </Card>

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
                const isCredit = amount > 0;

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-full p-1.5 ${
                          isCredit
                            ? "bg-green-100 dark:bg-green-950"
                            : "bg-red-100 dark:bg-red-950"
                        }`}
                      >
                        {isCredit ? (
                          <ArrowUpCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {tx.description ??
                            (isCredit ? "Recharge" : "Débit appel")}
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
                          isCredit ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatFcfa(Math.abs(amount))}
                      </span>
                      <div>
                        <Badge
                          variant={isCredit ? "success" : "destructive"}
                          className="text-xs"
                        >
                          {isCredit ? "Crédit" : "Débit"}
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
