"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PhoneCall, Rocket } from "lucide-react";
import { createQuickCallCampaignAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function QuickCallLauncher() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isLaunching, setIsLaunching] = useState(false);

  function handleSubmit(formData: FormData) {
    const launchNow = formData.get("launchNow") === "on";

    startTransition(async () => {
      const result = await createQuickCallCampaignAction(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (!result.campaignId) {
        toast.error("Campagne rapide non créée.");
        return;
      }

      toast.success(`${result.count} numéro(s) ajouté(s) à une campagne rapide.`);
      formRef.current?.reset();

      if (!launchNow) {
        router.push(`/campaigns/${result.campaignId}`);
        return;
      }

      setIsLaunching(true);
      try {
        const response = await fetch(`/api/campaigns/${result.campaignId}/launch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();

        if (!response.ok) {
          toast.error(data.error ?? "Campagne créée, mais appel non lancé.");
          router.push(`/campaigns/${result.campaignId}`);
          return;
        }

        toast.success(data.message ?? `${data.launched} appel(s) lancé(s).`);
        router.push(`/campaigns/${result.campaignId}`);
      } catch {
        toast.error("Campagne créée, mais erreur réseau au lancement des appels.");
        router.push(`/campaigns/${result.campaignId}`);
      } finally {
        setIsLaunching(false);
      }
    });
  }

  const busy = isPending || isLaunching;

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quick-campaign-name">Nom du test</Label>
          <Input
            id="quick-campaign-name"
            name="name"
            placeholder="Ex: Test appel rapide"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick-objective">Objectif rapide</Label>
          <Input
            id="quick-objective"
            name="objective"
            placeholder="Qualifier l’intérêt et proposer une démo"
            disabled={busy}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quick-numbers">Numéros à appeler *</Label>
        <Textarea
          id="quick-numbers"
          name="numbers"
          required
          rows={5}
          placeholder={`Un numéro par ligne. Ex:\n+22890000000\n+15145550000, Koffi Mensah, Boutique Afi`}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">
          Pour tester vite : collez 1 à 20 numéros. Format accepté : numéro seul, ou numéro, nom, entreprise.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quick-script">Consigne de l’agent IA</Label>
        <Textarea
          id="quick-script"
          name="scriptTemplate"
          rows={4}
          placeholder="L’agent doit saluer, expliquer brièvement AfrivoiceAI, vérifier si la personne est intéressée et résumer la réponse."
          disabled={busy}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <input
          type="checkbox"
          name="launchNow"
          className="mt-1"
          defaultChecked
          disabled={busy}
        />
        <span>
          <span className="font-medium">Créer et lancer immédiatement</span>
          <span className="block text-xs text-muted-foreground">
            Si le wallet est insuffisant, la campagne sera créée et les numéros resteront prêts à appeler.
          </span>
        </span>
      </label>

      <Button type="submit" disabled={busy} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
        {isLaunching ? "Lancement des appels..." : "Lancer un test rapide"}
      </Button>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Rocket className="h-3.5 w-3.5" />
        Pour les gros volumes, utilisez une campagne classique, un CSV ou une base prospects achetée.
      </div>
    </form>
  );
}
