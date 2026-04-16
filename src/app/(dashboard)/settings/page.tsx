import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Mic2,
  Globe,
  PhoneCall,
  Key,
  Building,
  User,
  Webhook,
} from "lucide-react";
import { getExchangeRateInfo } from "@/lib/utils/billing";

export default async function SettingsPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const rateInfo = getExchangeRateInfo();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Paramètres</h2>
        <p className="text-muted-foreground">
          Configurez votre compte AfrivoiceAI
        </p>
      </div>

      {/* Organisation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Organisation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nom de l&apos;organisation</Label>
              <Input value={session.organizationName} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Email du compte</Label>
              <Input value={session.email} readOnly />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{session.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Clés API
          </CardTitle>
          <CardDescription>
            Configurez vos clés API dans le fichier .env.local
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Vapi.ai API Key", env: "VAPI_API_KEY", status: !!process.env.VAPI_API_KEY },
            { label: "ElevenLabs API Key", env: "ELEVENLABS_API_KEY", status: !!process.env.ELEVENLABS_API_KEY },
            { label: "Google Gemini API Key", env: "GEMINI_API_KEY", status: !!process.env.GEMINI_API_KEY },
            { label: "Shopify Webhook Secret", env: "SHOPIFY_WEBHOOK_SECRET", status: !!process.env.SHOPIFY_WEBHOOK_SECRET },
          ].map((api) => (
            <div key={api.env} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{api.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{api.env}</p>
              </div>
              <Badge variant={api.status ? "success" : "destructive"}>
                {api.status ? "Configuré" : "Non configuré"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            URLs des Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Shopify Webhook", path: "/api/webhooks/shopify" },
            { label: "Vapi.ai Webhook", path: "/api/webhooks/vapi" },
          ].map((wh) => (
            <div key={wh.path}>
              <p className="text-sm font-medium mb-1">{wh.label}</p>
              <div className="rounded-md bg-muted p-2 font-mono text-xs break-all">
                {`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://votre-domaine.com"}${wh.path}`}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Facturation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Configuration de facturation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taux de change USD/FCFA</span>
            <span className="font-medium">1 USD = {rateInfo.rateUsdToFcfa} FCFA</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Marge appliquée</span>
            <span className="font-medium">{rateInfo.marginPercentage}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Formule de calcul</span>
            <span className="font-medium text-xs font-mono">
              coût_fcfa = coût_usd × {rateInfo.rateUsdToFcfa} × 1.{rateInfo.marginPercentage}
            </span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Coming Soon */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Fonctionnalités à venir</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Mic2,
              title: "Marketplace de Voix Africaines",
              description:
                "Bibliothèque de voix locales (Togo, Sénégal, Bénin, Côte d'Ivoire...) avec royalties pour les créateurs.",
            },
            {
              icon: User,
              title: "Clonage Vocal Personnalisé",
              description:
                "Clonez votre voix ou celle d'un ambassadeur de marque pour des appels ultra-personnalisés.",
            },
            {
              icon: Globe,
              title: "Support des Langues Locales",
              description:
                "Éwé, Wolof, Fon, Dioula, Twi... AfrivoiceAI parlera toutes les langues de l'Afrique.",
            },
          ].map((feature) => (
            <Card
              key={feature.title}
              className="opacity-75 border-dashed relative overflow-hidden"
            >
              <div className="absolute top-2 right-2">
                <Badge variant="comingSoon" className="text-xs">
                  Bientôt
                </Badge>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-primary/10 p-2">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
