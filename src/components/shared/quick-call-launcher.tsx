"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PhoneCall, Rocket, Sparkles } from "lucide-react";
import { createQuickCallCampaignAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type QuickCallTestLead = {
  phone: string;
  name?: string | null;
  company?: string | null;
};

const DEFAULT_TEST_OBJECTIVE =
  "Tester AfrivoiceAI avec un prospect canadien réel de la base et vérifier que l'agent peut présenter la solution clairement.";

const DEFAULT_TEST_SCRIPT =
  "Tu es l'agent vocal AfrivoiceAI. Appelle en français, salue poliment, précise que c'est un court appel de test pour présenter un assistant IA capable de gérer les appels clients. Vérifie si la personne peut écouter 30 secondes, explique la valeur pour automatiser les appels entrants/sortants, demande si elle souhaite une démo plus tard, puis remercie et termine proprement.";

function todayLabel() {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

export function QuickCallLauncher() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isLaunching, setIsLaunching] = useState(false);
  const [isFillingTest, setIsFillingTest] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [numbers, setNumbers] = useState("");
  const [scriptTemplate, setScriptTemplate] = useState("");
  const [launchNow, setLaunchNow] = useState(true);

  function applyCanadaTestLead(lead: QuickCallTestLead) {
    const leadName = lead.name?.trim() || "Prospect Canada test";
    const company = lead.company?.trim() || "Entreprise canadienne";

    setName(`Test Canada automatique - ${todayLabel()}`);
    setObjective(DEFAULT_TEST_OBJECTIVE);
    setNumbers(`${lead.phone}, ${leadName}, ${company}`);
    setScriptTemplate(DEFAULT_TEST_SCRIPT);
    setLaunchNow(true);
  }

  async function fillCanadaTestData() {
    setIsFillingTest(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("/api/campaigns/test-canada-lead", {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => ({}))) as {
        lead?: QuickCallTestLead;
        error?: string;
      };

      if (response.ok && result.lead?.phone) {
        applyCanadaTestLead(result.lead);
        toast.success("Données de test remplies avec un vrai numéro Canada de la base.");
        return;
      }

      setName(`Test Canada automatique - ${todayLabel()}`);
      setObjective(DEFAULT_TEST_OBJECTIVE);
      setNumbers("");
      setScriptTemplate(DEFAULT_TEST_SCRIPT);
      setLaunchNow(false);
      toast.error(result.error ?? "Aucun numéro Canada disponible pour pré-remplir le test.");
    } catch (error) {
      setName(`Test Canada automatique - ${todayLabel()}`);
      setObjective(DEFAULT_TEST_OBJECTIVE);
      setNumbers("");
      setScriptTemplate(DEFAULT_TEST_SCRIPT);
      setLaunchNow(false);
      toast.error(
        error instanceof DOMException && error.name === "AbortError"
          ? "La récupération du numéro Canada a pris trop de temps. La page reste utilisable."
          : "La page reste utilisable, mais la récupération du numéro Canada a échoué."
      );
    } finally {
      window.clearTimeout(timeout);
      setIsFillingTest(false);
    }
  }

  function handleSubmit(formData: FormData) {
    const shouldLaunchNow = formData.get("launchNow") === "on";

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
      setName("");
      setObjective("");
      setNumbers("");
      setScriptTemplate("");
      setLaunchNow(true);

      if (!shouldLaunchNow) {
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

  const busy = isPending || isLaunching || isFillingTest;

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-foreground">Test prêt en 1 clic</p>
            <p className="text-sm text-muted-foreground">
              Remplit automatiquement la campagne, le script et un numéro canadien issu de la base si disponible.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2 rounded-xl bg-background/90"
            onClick={fillCanadaTestData}
            disabled={busy}
          >
            {isFillingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Remplir un test Canada
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quick-campaign-name">Nom du test</Label>
          <Input
            id="quick-campaign-name"
            name="name"
            placeholder="Ex: Test appel rapide"
            disabled={busy}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick-objective">Objectif rapide</Label>
          <Input
            id="quick-objective"
            name="objective"
            placeholder="Qualifier l’intérêt et proposer une démo"
            disabled={busy}
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
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
          placeholder={`Un numéro par ligne. Ex:\n+228****0000\n+151****0000, Koffi Mensah, Boutique Afi`}
          disabled={busy}
          value={numbers}
          onChange={(event) => setNumbers(event.target.value)}
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
          value={scriptTemplate}
          onChange={(event) => setScriptTemplate(event.target.value)}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <input
          type="checkbox"
          name="launchNow"
          className="mt-1"
          checked={launchNow}
          onChange={(event) => setLaunchNow(event.target.checked)}
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
