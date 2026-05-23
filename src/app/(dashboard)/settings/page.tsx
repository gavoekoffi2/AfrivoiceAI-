import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mic2,
  Globe,
  PhoneCall,
  Key,
  Building,
  Webhook,
  CheckCircle,
  AlertTriangle,
  User,
  Info,
  Lock,
} from "lucide-react";
import { getExchangeRateInfo } from "@/lib/utils/billing";
import { SettingsForm } from "@/components/shared/settings-form";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { WebhookUrls } from "@/components/shared/webhook-urls";
import { isStripeConfigured } from "@/lib/stripe/client";

export default async function SettingsPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.organizationId))
    .limit(1);

  const rateInfo = getExchangeRateInfo();
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://votre-domaine.com";
  const stripeConfigured = isStripeConfigured();

  const apiKeys = [
    {
      label: "Vapi.ai API Key",
      env: "VAPI_API_KEY",
      status: !!process.env.VAPI_API_KEY,
      description: "Orchestration des appels vocaux",
    },
    {
      label: "ElevenLabs API Key",
      env: "ELEVENLABS_API_KEY",
      status: !!process.env.ELEVENLABS_API_KEY,
      description: "Génération de voix réalistes",
    },
    {
      label: "Google Gemini API Key",
      env: "GEMINI_API_KEY",
      status: !!process.env.GEMINI_API_KEY,
      description: "Modèle de langage conversationnel",
    },
    {
      label: "Vapi Webhook Secret",
      env: "VAPI_WEBHOOK_SECRET",
      status: !!process.env.VAPI_WEBHOOK_SECRET,
      description: "Vérification des callbacks Vapi",
    },
    {
      label: "Shopify Webhook Secret",
      env: "SHOPIFY_WEBHOOK_SECRET",
      status: !!process.env.SHOPIFY_WEBHOOK_SECRET,
      description: "Vérification HMAC des webhooks Shopify",
    },
    {
      label: "WooCommerce Webhook Secret",
      env: "WOOCOMMERCE_WEBHOOK_SECRET",
      status: !!process.env.WOOCOMMERCE_WEBHOOK_SECRET,
      description: "Vérification des webhooks WooCommerce",
    },
    {
      label: "Stripe (paiement)",
      env: "STRIPE_SECRET_KEY",
      status: !!process.env.STRIPE_SECRET_KEY,
      description: "Recharge wallet par carte bancaire",
    },
  ];

  const configuredCount = apiKeys.filter((k) => k.status).length;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Paramètres</h2>
        <p className="text-muted-foreground">
          Configurez votre compte et vos intégrations
        </p>
      </div>

      {configuredCount < apiKeys.length && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {apiKeys.length - configuredCount} clé(s) API non configurée(s).
            Modifiez votre fichier <code>.env.local</code> pour activer toutes
            les fonctionnalités.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4 md:w-auto md:grid-cols-none md:flex">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
          <TabsTrigger value="integrations">Intégrations</TabsTrigger>
          <TabsTrigger value="billing">Facturation</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Organisation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SettingsForm
                initialName={organization?.name ?? ""}
                initialShopName={organization?.shopName ?? ""}
                initialShopifyDomain={organization?.shopifyDomain ?? ""}
                initialWoocommerceDomain={organization?.woocommerceDomain ?? ""}
                initialLowBalanceThreshold={parseFloat(
                  organization?.lowBalanceThresholdFcfa ?? "5000"
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Compte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="text-sm font-medium">{session.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Rôle</Label>
                  <div>
                    <Badge variant="secondary" className="capitalize">
                      {session.role}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Fonctionnalités à venir
                <Badge variant="comingSoon">Bientôt</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: Mic2,
                    title: "Marketplace de Voix Africaines",
                    description:
                      "Bibliothèque de voix locales avec royalties pour les créateurs vocaux africains.",
                  },
                  {
                    icon: User,
                    title: "Clonage Vocal Personnalisé",
                    description:
                      "Clonez votre voix pour des appels ultra-personnalisés.",
                  },
                  {
                    icon: Globe,
                    title: "Support des Langues Locales",
                    description:
                      "Éwé, Wolof, Fon, Dioula, Twi, Haoussa et bien d'autres.",
                  },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-lg border border-dashed p-3 opacity-60"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <feature.icon className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">{feature.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Changer de mot de passe
              </CardTitle>
              <CardDescription>
                Choisissez un mot de passe robuste (8 caractères min., majuscule, chiffre)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Clés API ({configuredCount}/{apiKeys.length} configurées)
              </CardTitle>
              <CardDescription>
                Configurez dans{" "}
                <code className="text-xs bg-muted px-1 rounded">.env.local</code>{" "}
                à la racine du projet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {apiKeys.map((api) => (
                <div
                  key={api.env}
                  className="flex items-center justify-between rounded-md border p-3 gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {api.status ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                      )}
                      <p className="text-sm font-medium">{api.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      {api.description}
                    </p>
                    <code className="text-xs text-muted-foreground ml-6 font-mono">
                      {api.env}
                    </code>
                  </div>
                  <Badge
                    variant={api.status ? "success" : "warning"}
                    className="shrink-0 ml-2"
                  >
                    {api.status ? "Configuré" : "Manquant"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" />
                URLs des Webhooks
              </CardTitle>
              <CardDescription>
                Copiez ces URLs dans vos plateformes pour activer les
                intégrations. Le token URL identifie votre organisation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebhookUrls
                baseUrl={baseUrl}
                webhookToken={organization?.webhookToken ?? ""}
                stripeConfigured={stripeConfigured}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5 text-primary" />
                Configuration de facturation
              </CardTitle>
              <CardDescription>
                Paramètres de conversion et de marge appliqués à vos appels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="info">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Les paramètres de facturation sont définis dans les variables
                  d&apos;environnement <code>EXCHANGE_RATE_USD_TO_FCFA</code> et{" "}
                  <code>PROFIT_MARGIN_PERCENTAGE</code>.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    label: "Taux USD → FCFA",
                    value: `1 USD = ${rateInfo.rateUsdToFcfa} FCFA`,
                    env: "EXCHANGE_RATE_USD_TO_FCFA",
                  },
                  {
                    label: "Marge appliquée",
                    value: `+${rateInfo.marginPercentage}%`,
                    env: "PROFIT_MARGIN_PERCENTAGE",
                  },
                ].map((item) => (
                  <div
                    key={item.env}
                    className="rounded-md border p-3 space-y-1"
                  >
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-lg font-bold">{item.value}</p>
                    <code className="text-xs font-mono text-muted-foreground">
                      {item.env}
                    </code>
                  </div>
                ))}
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-3">
                  Exemples de coûts (marge incluse)
                </p>
                <div className="space-y-2">
                  {[
                    { duration: "30 secondes", usd: 0.01 },
                    { duration: "1 minute", usd: 0.02 },
                    { duration: "2 minutes", usd: 0.04 },
                    { duration: "5 minutes", usd: 0.1 },
                  ].map((ex) => {
                    const fcfa = Math.ceil(
                      ex.usd *
                        rateInfo.rateUsdToFcfa *
                        (1 + rateInfo.marginPercentage / 100)
                    );
                    return (
                      <div
                        key={ex.duration}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {ex.duration}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">
                            ${ex.usd.toFixed(2)} brut
                          </span>
                          <span className="font-medium">
                            {fcfa.toLocaleString("fr-TG")} FCFA
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
