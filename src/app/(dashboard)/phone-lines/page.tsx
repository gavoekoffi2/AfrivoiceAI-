import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  PhoneCall,
  Plus,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import { getUserSession } from "@/lib/auth";
import { BILLING_PLANS, getBillingPlan } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { organizationBillingProfiles, phoneLines } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PhoneLineRequestForm } from "@/components/shared/phone-line-request-form";
import { PhoneLineActions } from "@/components/shared/phone-line-actions";

export const dynamic = "force-dynamic";

const connectionLabels: Record<string, string> = {
  platform: "Ligne gérée par AfrivoxAI",
  sim_gateway: "SIM mobile connectée",
  sip_trunk: "Standard / trunk SIP",
  twilio: "Numéro Twilio",
  telnyx: "Numéro Telnyx",
};

const statusLabels: Record<string, string> = {
  pending: "Vérification en attente",
  provisioning: "Configuration en cours",
  active: "Active",
  degraded: "À vérifier",
  disabled: "Désactivée",
};

function maskPhone(value: string | null) {
  if (!value) return "Numéro attribué lors de l’activation";
  if (value.length <= 7) return value;
  return `${value.slice(0, 4)}••••${value.slice(-3)}`;
}

export default async function PhoneLinesPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [lines, billingProfile] = await Promise.all([
    db
      .select()
      .from(phoneLines)
      .where(
        and(
          eq(phoneLines.organizationId, session.organizationId),
          ne(phoneLines.status, "disabled")
        )
      )
      .orderBy(desc(phoneLines.isDefault), desc(phoneLines.createdAt)),
    db.query.organizationBillingProfiles.findFirst({
      where: eq(organizationBillingProfiles.organizationId, session.organizationId),
    }),
  ]);

  const currentPlan = getBillingPlan(billingProfile?.planCode);
  const customerLineCount = lines.filter((line) => line.connectionType !== "platform").length;

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mes lignes téléphoniques</h2>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Appelez avec le véritable numéro de votre entreprise. Chaque ligne est vérifiée et isolée de celles des autres organisations.
          </p>
        </div>
        <Badge variant="outline" className="gap-2 px-3 py-1.5">
          <RadioTower className="h-4 w-4" />
          {customerLineCount}/{currentPlan.phoneLineLimit} ligne(s) connectée(s)
        </Badge>
      </div>

      <Alert variant="info">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          AfrivoxAI n’usurpe jamais un numéro. Une SIM, un trunk SIP ou un compte opérateur contrôlé par votre entreprise est obligatoire avant l’activation.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        {lines.map((line) => {
          const ready = line.status === "active" && line.verificationStatus === "verified";
          return (
            <Card key={line.id} className={line.isDefault ? "border-emerald-400/40 bg-emerald-400/5" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <PhoneCall className="h-5 w-5 text-primary" />
                      {line.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {connectionLabels[line.connectionType] ?? line.connectionType}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={ready ? "success" : "warning"}>
                      {statusLabels[line.status] ?? line.status}
                    </Badge>
                    {line.isDefault && <Badge variant="outline">Par défaut</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-xl border bg-background/60 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Numéro présenté</p>
                    <p className="font-medium">{maskPhone(line.phoneNumber)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Opérateur</p>
                    <p className="font-medium capitalize">{line.provider}</p>
                  </div>
                  {line.externalReference && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Référence d’activation</p>
                      <p className="font-mono text-sm">{line.externalReference}</p>
                    </div>
                  )}
                </div>
                <PhoneLineActions
                  lineId={line.id}
                  canSetDefault={ready}
                  isDefault={line.isDefault}
                  canDisable={line.connectionType !== "platform"}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Connecter un numéro existant
          </CardTitle>
          <CardDescription>
            Votre forfait {currentPlan.name} autorise jusqu’à {currentPlan.phoneLineLimit} ligne(s) client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhoneLineRequestForm />
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Forfaits proportionnels à votre utilisation</h3>
          <p className="text-sm text-muted-foreground">
            Les entreprises à fort volume paient davantage au total, mais bénéficient d’un prix par minute plus bas.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.values(BILLING_PLANS).map((plan) => {
            const selected = plan.code === currentPlan.code;
            return (
              <Card key={plan.code} className={selected ? "border-violet-400/50 shadow-md" : undefined}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {selected && <Badge variant="success">Votre forfait</Badge>}
                  </div>
                  <CardDescription>{plan.audience}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-2xl font-bold">
                      {plan.monthlyPriceFcfa === null
                        ? "Sur devis"
                        : `${plan.monthlyPriceFcfa.toLocaleString("fr-TG")} FCFA`}
                    </p>
                    {plan.monthlyPriceFcfa !== null && <p className="text-xs text-muted-foreground">par mois</p>}
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-sm font-semibold">{plan.minuteRateFcfa} FCFA / minute IA</p>
                    <p className="text-xs text-muted-foreground">hors coût opérateur apporté par AfrivoxAI</p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />{plan.phoneLineLimit} ligne(s)</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />{plan.concurrencyLimit} appel(s) simultané(s)</li>
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />{feature}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5" />Installation d’une SIM</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            À partir de {currentPlan.setupSimFcfa.toLocaleString("fr-TG")} FCFA par ligne, hors téléphone et forfait opérateur.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-5 w-5" />Sécurité contre les pertes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Si le coût réel d’un opérateur international dépasse le tarif IA, le coût fournisseur majoré est appliqué automatiquement avant l’appel.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
