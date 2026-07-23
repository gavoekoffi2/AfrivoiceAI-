"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PhoneCall, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { requestPhoneLineAction } from "@/app/actions/phone-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const connectionOptions = [
  {
    value: "sim_gateway",
    label: "SIM Moov ou Togocom",
    help: "Pour un numéro mobile existant installé dans une passerelle Android dédiée.",
  },
  {
    value: "sip_trunk",
    label: "Standard ou trunk SIP",
    help: "Pour un numéro d’entreprise déjà relié à un standard IP.",
  },
  {
    value: "twilio",
    label: "Compte Twilio",
    help: "Pour importer un numéro Twilio contrôlé par votre entreprise.",
  },
  {
    value: "telnyx",
    label: "Compte Telnyx",
    help: "Pour importer un numéro Telnyx contrôlé par votre entreprise.",
  },
] as const;

export function PhoneLineRequestForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [connectionType, setConnectionType] = useState("sim_gateway");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await requestPhoneLineAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Demande enregistrée. Référence : ${result.reference}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="line-name">Nom de la ligne</Label>
          <Input
            id="line-name"
            name="name"
            placeholder="Ex. Service commercial Lomé"
            minLength={3}
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="line-number">Numéro professionnel</Label>
          <Input
            id="line-number"
            name="phoneNumber"
            type="tel"
            placeholder="+228XXXXXXXX"
            required
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="connection-type">Méthode de connexion</Label>
        <select
          id="connection-type"
          name="connectionType"
          value={connectionType}
          onChange={(event) => setConnectionType(event.target.value)}
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {connectionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {connectionOptions.find((item) => item.value === connectionType)?.help}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider">Opérateur ou fournisseur</Label>
        <select
          id="provider"
          name="provider"
          defaultValue="moov"
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="moov">Moov Africa Togo</option>
          <option value="togocom">Yas Togo / Togocom</option>
          <option value="sip">Autre opérateur SIP</option>
          <option value="twilio">Twilio</option>
          <option value="telnyx">Telnyx</option>
          <option value="other">Autre opérateur</option>
        </select>
      </div>

      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium">Connexion sécurisée</p>
            <p className="mt-1 text-muted-foreground">
              Ne saisissez aucun mot de passe SIP ici. Après la demande, AfrivoxAI vérifie la propriété du numéro et organise un échange sécurisé pour les paramètres techniques.
            </p>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full gap-2" disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PhoneCall className="h-4 w-4" />
        )}
        Demander la connexion de cette ligne
      </Button>
    </form>
  );
}
