"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Agent } from "@/lib/db/schema";

type ActionResult = { success?: string; error?: string };

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "ee", label: "Éwé" },
  { value: "yo", label: "Yoruba" },
  { value: "ha", label: "Haoussa" },
];

const MODELS = [
  { value: "simple", label: "Simple — FAQ, prise de RDV (Haiku, économique)" },
  { value: "default", label: "Standard — conversations courantes (Sonnet)" },
  { value: "premium", label: "Premium — raisonnement complexe (Fable/Opus)" },
];

/** Formulaire de création/édition d'agent (studio no-code). */
export function AgentForm({
  agent,
  action,
  submitLabel,
}: {
  agent?: Agent;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className="space-y-4"
      action={(formData) =>
        startTransition(async () => setResult(await action(formData)))
      }
    >
      {agent && <input type="hidden" name="agentId" value={agent.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom de l&apos;agent *</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={agent?.name}
            placeholder="Awa, assistante de la mairie"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Statut</Label>
          <select
            id="status"
            name="status"
            defaultValue={agent?.status ?? "draft"}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="draft">Brouillon</option>
            <option value="active">Actif</option>
            <option value="archived">Archivé</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="speakLanguage">Langue parlée (avec l&apos;appelant)</Label>
          <select
            id="speakLanguage"
            name="speakLanguage"
            defaultValue={agent?.speakLanguage ?? "fr"}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">Niveau d&apos;intelligence</Label>
          <select
            id="model"
            name="model"
            defaultValue={agent?.model ?? "default"}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description (interne)</Label>
        <Input
          id="description"
          name="description"
          defaultValue={agent?.description ?? ""}
          placeholder="Agent d'accueil téléphonique du service état civil"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="greeting">Message d&apos;accueil</Label>
        <Input
          id="greeting"
          name="greeting"
          defaultValue={agent?.greeting ?? ""}
          placeholder="Bonjour, ici Awa de la mairie de Lomé. Comment puis-je vous aider ?"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="systemPrompt">Personnalité et instructions *</Label>
        <Textarea
          id="systemPrompt"
          name="systemPrompt"
          required
          rows={6}
          defaultValue={agent?.systemPrompt}
          placeholder="Tu es Awa, agente d'accueil chaleureuse et efficace. Tu renseignes sur les horaires, les documents nécessaires…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="callScenario">Scénario d&apos;appel (optionnel)</Label>
        <Textarea
          id="callScenario"
          name="callScenario"
          rows={4}
          defaultValue={agent?.callScenario ?? ""}
          placeholder={"1. Saluer et identifier le besoin\n2. Répondre à partir de la base de connaissances\n3. Proposer un rendez-vous si nécessaire"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="voiceId">Voix (id OpenVoice, optionnel)</Label>
          <Input
            id="voiceId"
            name="voiceId"
            defaultValue={agent?.voiceId ?? ""}
            placeholder="openvoice_xxx (voix clonée)"
          />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <input
            type="checkbox"
            id="widgetEnabled"
            name="widgetEnabled"
            defaultChecked={agent?.widgetEnabled ?? false}
            className="h-4 w-4"
          />
          <Label htmlFor="widgetEnabled">Exposer au widget web</Label>
        </div>
      </div>

      {result?.error && (
        <p className="text-sm text-destructive">{result.error}</p>
      )}
      {result?.success && (
        <p className="text-sm text-emerald-600">{result.success}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
  );
}
