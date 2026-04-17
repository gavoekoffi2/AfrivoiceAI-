"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { completeOnboardingAction } from "@/app/actions/onboarding";

const COUNTRIES = [
  { code: "TG", label: "Togo", timezone: "Africa/Lome" },
  { code: "BJ", label: "Bénin", timezone: "Africa/Porto-Novo" },
  { code: "CI", label: "Côte d'Ivoire", timezone: "Africa/Abidjan" },
  { code: "SN", label: "Sénégal", timezone: "Africa/Dakar" },
  { code: "ML", label: "Mali", timezone: "Africa/Bamako" },
  { code: "BF", label: "Burkina Faso", timezone: "Africa/Ouagadougou" },
  { code: "NE", label: "Niger", timezone: "Africa/Niamey" },
  { code: "CM", label: "Cameroun", timezone: "Africa/Douala" },
  { code: "GA", label: "Gabon", timezone: "Africa/Libreville" },
  { code: "CG", label: "Congo", timezone: "Africa/Brazzaville" },
  { code: "FR", label: "France (test)", timezone: "Europe/Paris" },
];

const STEPS = [
  { key: "welcome", title: "Bienvenue" },
  { key: "shop", title: "Votre boutique" },
  { key: "location", title: "Pays & fuseau" },
  { key: "integrations", title: "Intégrations" },
  { key: "done", title: "Finalisation" },
];

export function OnboardingWizard({
  organizationName,
  userEmail,
}: {
  organizationName: string;
  userEmail: string;
}) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [shopName, setShopName] = useState(organizationName);
  const [country, setCountry] = useState("TG");
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [woocommerceDomain, setWoocommerceDomain] = useState("");

  const progress = ((step + 1) / STEPS.length) * 100;
  const selectedCountry =
    COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];

  const canProceed = () => {
    if (step === 1) return shopName.trim().length >= 2;
    return true;
  };

  const submit = () => {
    const fd = new FormData();
    fd.set("shopName", shopName);
    fd.set("countryCode", country);
    fd.set("timezone", selectedCountry.timezone);
    if (shopifyDomain.trim()) fd.set("shopifyDomain", shopifyDomain.trim());
    if (woocommerceDomain.trim())
      fd.set("woocommerceDomain", woocommerceDomain.trim());

    startTransition(async () => {
      const res = await completeOnboardingAction(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Configuration terminée — bienvenue sur AfrivoiceAI !");
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <Card className="overflow-hidden border-border/60 shadow-xl">
      <div className="relative h-2 w-full bg-muted">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Étape {step + 1} / {STEPS.length}
          </Badge>
          <span className="text-xs text-muted-foreground">{userEmail}</span>
        </div>
        <CardTitle className="text-2xl">{STEPS[step].title}</CardTitle>
        <CardDescription>
          {step === 0 &&
            "Quelques informations pour personnaliser votre espace et connecter votre boutique."}
          {step === 1 && "Le nom visible par vos clients lors des appels IA."}
          {step === 2 && "Utilisé pour normaliser les numéros et horaires d'appel."}
          {step === 3 && "Optionnel — vous pourrez les configurer plus tard."}
          {step === 4 &&
            "Vérifiez les informations et activez votre compte."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div
          key={step}
          className="animate-in fade-in slide-in-from-right-2 duration-300"
        >
          {step === 0 && <StepWelcome />}
          {step === 1 && (
            <StepShop shopName={shopName} setShopName={setShopName} />
          )}
          {step === 2 && (
            <StepLocation country={country} setCountry={setCountry} />
          )}
          {step === 3 && (
            <StepIntegrations
              shopifyDomain={shopifyDomain}
              setShopifyDomain={setShopifyDomain}
              woocommerceDomain={woocommerceDomain}
              setWoocommerceDomain={setWoocommerceDomain}
            />
          )}
          {step === 4 && (
            <StepReview
              shopName={shopName}
              country={selectedCountry.label}
              timezone={selectedCountry.timezone}
              shopifyDomain={shopifyDomain}
              woocommerceDomain={woocommerceDomain}
            />
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || isPending}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>

          <div className="flex-1">
            <Progress value={progress} className="mx-6 h-1" />
          </div>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed() || isPending}
            >
              Continuer
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={isPending}>
              {isPending ? "Activation…" : "Activer mon compte"}
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StepWelcome() {
  return (
    <div className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">
            Confirmez vos commandes COD et prospectez, automatiquement.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            AfrivoiceAI lance des appels IA en français, wolof, mina ou bambara
            pour confirmer vos commandes Shopify / WooCommerce et qualifier
            vos prospects B2B — en moins de 3 minutes par appel.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepShop({
  shopName,
  setShopName,
}: {
  shopName: string;
  setShopName: (v: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <Label htmlFor="shopName">Nom affiché aux clients</Label>
      <Input
        id="shopName"
        value={shopName}
        onChange={(e) => setShopName(e.target.value)}
        placeholder="Ex. Mira Cosmétiques"
        autoFocus
      />
      <p className="text-xs text-muted-foreground">
        L'IA dira : « Bonjour, c'est Amina de la boutique <b>{shopName || "…"}</b> »
      </p>
    </div>
  );
}

function StepLocation({
  country,
  setCountry,
}: {
  country: string;
  setCountry: (v: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <Label>Pays principal</Label>
      <Select value={country} onValueChange={setCountry}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.label} — {c.timezone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Les numéros de téléphone sans préfixe seront normalisés au format
        international selon ce pays.
      </p>
    </div>
  );
}

function StepIntegrations({
  shopifyDomain,
  setShopifyDomain,
  woocommerceDomain,
  setWoocommerceDomain,
}: {
  shopifyDomain: string;
  setShopifyDomain: (v: string) => void;
  woocommerceDomain: string;
  setWoocommerceDomain: (v: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="shopify">Domaine Shopify (optionnel)</Label>
        <Input
          id="shopify"
          value={shopifyDomain}
          onChange={(e) => setShopifyDomain(e.target.value)}
          placeholder="ma-boutique.myshopify.com"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="woo">Domaine WooCommerce (optionnel)</Label>
        <Input
          id="woo"
          value={woocommerceDomain}
          onChange={(e) => setWoocommerceDomain(e.target.value)}
          placeholder="maboutique.com"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Ajoutez ensuite le webhook <code>orders/create</code> (Shopify) ou
        <code> order.created</code> (WooCommerce) pointant vers votre URL
        AfrivoiceAI. Vous trouverez les instructions dans Paramètres.
      </p>
    </div>
  );
}

function StepReview({
  shopName,
  country,
  timezone,
  shopifyDomain,
  woocommerceDomain,
}: {
  shopName: string;
  country: string;
  timezone: string;
  shopifyDomain: string;
  woocommerceDomain: string;
}) {
  const rows: Array<[string, string]> = [
    ["Boutique", shopName],
    ["Pays", country],
    ["Fuseau", timezone],
    ["Shopify", shopifyDomain || "—"],
    ["WooCommerce", woocommerceDomain || "—"],
  ];
  return (
    <dl className="grid gap-2 rounded-lg border border-border/60 p-4">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
